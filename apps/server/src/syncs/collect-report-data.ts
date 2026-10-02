import { REPORT_DATA_VERSION, ReportData, SYNC_PHASES, type SyncProgress } from '@poc-intel/shared'
import {
  alertPageCount,
  collectAiTriage,
  collectCases,
  collectIngestion,
  collectTactics,
  countAlertsInPeriod,
  exactPageCount,
  periodCaseStats,
} from '../stellar/case-collectors.js'
import { StellarApiError, type StellarClient } from '../stellar/client.js'
import { PAGING } from '../stellar/endpoints.js'
import type { SyncMetrics } from '../stellar/request-stats.js'
import {
  collectAssets,
  collectCaseCounts,
  collectConnectors,
  collectDataSensors,
  collectVolume,
  type CollectContext,
} from '../stellar/collectors.js'

export interface SyncTarget {
  instanceUrl: string
  tenant: { id: string; name: string }
  period: { start: string; end: string }
  /** Collect AI Triage verdicts (the Owner marked it as tested in the PoC). */
  aiTriage?: boolean
}

type Logger = { warn: (obj: object, msg: string) => void }

/**
 * Runs every collector for one Tenant and period and condenses the results into Report Data.
 * Phase 1 runs the collectors in parallel; phase 2 pages the Alerts of the Key Cases.
 * A collector that fails becomes a gap; only an authentication failure, or every collector
 * failing, rejects. `client` must already be authenticated.
 */
export async function collectReportData(
  client: StellarClient,
  target: SyncTarget,
  {
    log,
    onProgress,
    onMetrics,
    onCollectorFailed,
  }: { log: Logger; onProgress: (p: SyncProgress) => Promise<void> | void; onMetrics?: (m: SyncMetrics) => void; onCollectorFailed?: (name: string, err: Error) => void },
): Promise<ReportData> {
  const t0 = performance.now()
  const phases: Record<string, number> = {}
  const timed = async <T,>(name: string, fn: () => Promise<T>): Promise<T> => {
    const s = performance.now()
    try {
      return await fn()
    } finally {
      phases[name] = Math.round(performance.now() - s)
    }
  }
const ctx: CollectContext = { client, tenantId: target.tenant.id, period: target.period }
  const gaps: ReportData['gaps'] = []
  const collectors = {
    caseCounts: () => collectCaseCounts(ctx),
    cases: () => collectCases(ctx),
    assets: () => collectAssets(ctx),
    volume: () => collectVolume(ctx),
    connectors: () => collectConnectors(ctx),
    dataSensors: () => collectDataSensors(ctx),
    ingestion: () => collectIngestion(ctx),
  }
  type Results = { [K in keyof typeof collectors]: Awaited<ReturnType<(typeof collectors)[K]>> | null }
  const names = Object.keys(collectors) as (keyof typeof collectors)[]

  // Progress as one percentage across the phases: collectors 5–40 %, alert pages 40–90 %, then
  // processing. The alert pages join once the Key Cases are known.
  const progress = { collectors: 0, pages: 0, pageTotal: 0 }
  let lastWrite = 0
  const report = async (step: 'collect' | 'alerts' | 'process', force = false) => {
    if (!force && Date.now() - lastWrite < 1000) return
    lastWrite = Date.now()
    const pct =
      step === 'collect'
        ? 5 + (35 * progress.collectors) / names.length
        : step === 'alerts'
          ? 40 + (50 * progress.pages) / Math.max(1, progress.pageTotal)
          : 92
    await onProgress({ step, phase: SYNC_PHASES.indexOf(step) + 1, done: Math.round(pct), total: 100 })
  }
  await report('collect', true)

  const guard = async <T,>(name: string, fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn()
    } catch (err) {
      if (err instanceof StellarApiError && err.code === 'auth_failed') throw err
      gaps.push({ collector: name, reason: err instanceof StellarApiError ? err.code : 'internal' })
      log.warn({ collector: name, err: (err as Error).message }, 'collector failed')
      onCollectorFailed?.(name, err as Error)
      return null
    }
  }

  const results = Object.fromEntries(
    await Promise.all(names.map(async (n) => [n, await guard(n, () => timed(n, collectors[n] as () => Promise<unknown>)).finally(() => {
          progress.collectors++
          return report('collect', true)
        })] as const)),
  ) as Results
  if (gaps.length === names.length) throw new StellarApiError('unavailable', 'every collector failed')

  const keyCases = results.cases?.keyCases ?? []
  const allCases = results.cases?.cases ?? []
  const from = Date.parse(`${ctx.period.start}T00:00:00.000Z`)
  const to = Date.parse(`${ctx.period.end}T23:59:59.999Z`)
  progress.pageTotal = alertPageCount(keyCases) + exactPageCount(allCases, from, to)
  if (progress.pageTotal) await report('alerts', true)
  const onPage = () => {
    progress.pages++
    void report('alerts')
  }
  const emptyTactics: ReportData['tactics'] = { mitre: { tactics: [], techniques: [] }, xdr: { tactics: [], techniques: [] }, byCase: {}, topAlerts: {}, pages: { fetched: 0, failed: 0, forbidden: 0 }, alertsMissing: 0, casesWithoutAlertAccess: 0 }
  // The key Cases' tactics and the exact Alert count of the period run side by side. collectTactics
  // plans its pages from the full Case sizes before the count changes them.
  const [tacticsResult, exact] = await Promise.all([
    keyCases.length ? guard('tactics', () => timed('tactics', () => collectTactics(ctx, keyCases, onPage))) : null,
    allCases.length ? guard('alertCount', () => timed('alertCount', () => countAlertsInPeriod(ctx, allCases, from, to, onPage))) : null,
  ])
  const tactics = tacticsResult ?? emptyTactics
  const stats = results.cases ? periodCaseStats(allCases, results.cases.total, exact) : null

  // /ingestion-stats/sensor only carries sensor ids: name them from /data_sensors.
  const sensorNames = new Map((results.dataSensors ?? []).map((s) => [s.id, s]))
  const connectorNames = new Set((results.connectors ?? []).map((c) => c.name))
  const ingestion = results.ingestion
    ? {
        ...results.ingestion,
        byConnector: results.ingestion.byConnector.map((e) => ({ ...e, known: connectorNames.has(e.name) })),
        bySensor: results.ingestion.bySensor.map((e) => {
          const s = sensorNames.get(e.id)
          // Ingestion history outlives removed sensors: keep the bytes, flag the entry.
          return s ? { ...e, name: s.name, type: s.kind } : { ...e, name: `Sensor ${e.id.slice(0, 8)}`, known: false }
        }),
      }
    : { bySensor: [], byConnector: [] }

  await report('process', true)
  const emptyCompliance = { stats: null, recommended: null, recommendedWindow: null, scenarios: [] }
  const aiTriage = target.aiTriage && keyCases.length ? await guard('aiTriage', () => timed('aiTriage', () => collectAiTriage(ctx, keyCases))) : null

  onMetrics?.({
    totalMs: Math.round(performance.now() - t0),
    phases,
    endpoints: client.stats.endpoints(),
    concurrency: PAGING.concurrency,
    peakInFlight: client.stats.peakInFlight,
    counts: {
      cases: stats?.cases ?? 0,
      keyCases: keyCases.length,
      alertPages: tactics.pages.fetched + tactics.pages.failed + tactics.pages.forbidden,
      alertPagesFailed: tactics.pages.failed,
      alertPagesForbidden: tactics.pages.forbidden,
    },
  })

  return ReportData.parse({
    version: REPORT_DATA_VERSION,
    collectedAt: new Date().toISOString(),
    instanceUrl: target.instanceUrl,
    tenant: target.tenant,
    period: ctx.period,
    cases: results.caseCounts ?? { total: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 } },
    assets: results.assets ?? { daily: [], compliance: emptyCompliance },
    volume: results.volume ?? { dailyGb: [], compliance: emptyCompliance },
    connectors: results.connectors ?? [],
    dataSensors: results.dataSensors ?? [],
    caseStats: stats,
    keyCases,
    tactics,
    ingestion,
    aiTriage: target.aiTriage ? (aiTriage ?? { available: false, verdicts: {} }) : null,
    gaps,
  } satisfies ReportData)
}

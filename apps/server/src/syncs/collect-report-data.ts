import { REPORT_DATA_VERSION, ReportData, type SyncProgress } from '@poc-intel/shared'
import { alertPageCount, collectCases, collectIngestion, collectTactics } from '../stellar/case-collectors.js'
import { StellarApiError, type StellarClient } from '../stellar/client.js'
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
  { log, onProgress }: { log: Logger; onProgress: (p: SyncProgress) => Promise<void> | void },
): Promise<ReportData> {
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

  // Progress: collectors first; the alert pages join the total once the Key Cases are known.
  const progress = { done: 0, total: names.length }
  let lastWrite = 0
  const tick = async (force = false) => {
    progress.done++
    if (force || Date.now() - lastWrite > 1000) {
      lastWrite = Date.now()
      await onProgress({ step: 'collect', ...progress })
    }
  }

  const guard = async <T,>(name: string, fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn()
    } catch (err) {
      if (err instanceof StellarApiError && err.code === 'auth_failed') throw err
      gaps.push({ collector: name, reason: err instanceof StellarApiError ? err.code : 'internal' })
      log.warn({ collector: name, err: (err as Error).message }, 'collector failed')
      return null
    }
  }

  const results = Object.fromEntries(
    await Promise.all(names.map(async (n) => [n, await guard(n, collectors[n] as () => Promise<unknown>).finally(() => tick(true))] as const)),
  ) as Results
  if (gaps.length === names.length) throw new StellarApiError('unavailable', 'every collector failed')

  const keyCases = results.cases?.keyCases ?? []
  progress.total += alertPageCount(keyCases)
  const emptyTactics: ReportData['tactics'] = { mitre: { tactics: [], techniques: [] }, xdr: { tactics: [], techniques: [] }, byCase: {}, topAlerts: {}, pages: { fetched: 0, failed: 0, forbidden: 0 }, alertsMissing: 0, casesWithoutAlertAccess: 0 }
  const tactics = keyCases.length ? ((await guard('tactics', () => collectTactics(ctx, keyCases, () => void tick()))) ?? emptyTactics) : emptyTactics

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

  const emptyCompliance = { stats: null, recommended: null, recommendedWindow: null, scenarios: [] }
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
    caseStats: results.cases?.caseStats ?? null,
    keyCases,
    tactics,
    ingestion,
    gaps,
  } satisfies ReportData)
}

import { AI_VERDICTS, type AiVerdict, type CaseSummary, type ReportData } from '@poc-intel/shared'
import { z } from 'zod'
import { runPool } from '../lib/pool.js'
import { caseStats, selectKeyCases, toCaseSummary } from '../metrics/case-stats.js'
import { TacticsAccumulator, type AlertSource } from '../metrics/tactics.js'
import { StellarApiError } from './client.js'
import { casesInRange, type CollectContext } from './collectors.js'
import { ENDPOINTS, PAGING } from './endpoints.js'
import { CaseAlertsResponse, CasesResponse, IngestionResponse } from './schemas.js'

const dayStart = (d: string) => Date.parse(`${d}T00:00:00.000Z`)
const dayEnd = (d: string) => Date.parse(`${d}T23:59:59.999Z`)

/** Every Case of the period is paged once and serves both the statistics and the Key Case selection. */
export const CASES_CAP = 10_000

export async function collectCases(ctx: CollectContext): Promise<{ cases: CaseSummary[]; total: number; keyCases: CaseSummary[] }> {
  const from = dayStart(ctx.period.start)
  const to = dayEnd(ctx.period.end)
  const [first, raw] = await Promise.all([
    ctx.client.get(ENDPOINTS.cases, { tenantid: ctx.tenantId, 'FROM~created_at': from, 'TO~created_at': to, limit: 1, skip: 0 }, CasesResponse),
    casesInRange(ctx, { sort: 'created_at', order: 'desc' }, from, to, CASES_CAP),
  ])
  const cases = raw.map(toCaseSummary).filter((c) => c.id)
  // Key Cases are chosen by Severity and recency, not by Alert count, so they can be picked before
  // the exact count; caseStats are computed once it is done (see periodCaseStats).
  return { cases, total: first.data.total, keyCases: selectKeyCases(cases) }
}

/** Statistics over every Case of the period, after countAlertsInPeriod. */
export function periodCaseStats(cases: CaseSummary[], total: number, exact: { outside: number; unverified: number } | null): ReportData['caseStats'] {
  const stats = caseStats(cases, total)
  return stats && (exact ? { ...stats, alertsOutsidePeriod: exact.outside, alertsUnverifiedCases: exact.unverified } : stats)
}

const crossesPeriod = (c: CaseSummary, from: number, to: number) => c.alerts > 0 && ((c.startedAt != null && c.startedAt < from) || (c.endedAt != null && c.endedAt > to))

/** Pages countAlertsInPeriod will fetch, for the progress bar. */
export function exactPageCount(cases: CaseSummary[], from: number, to: number): number {
  return cases.filter((c) => crossesPeriod(c, from, to)).reduce((n, c) => n + Math.min(EXACT_MAX_PAGES, Math.ceil(c.alerts / PAGING.caseAlertsPage)), 0)
}

/**
 * When the Instance received the Alert, in ms. Not `timestamp`: that is the event time at the source,
 * which for some products (e.g. CylancePROTECT) is weeks before Stellar Cyber saw the Alert.
 */
export const alertTime = (src: Record<string, unknown>): number | null => {
  for (const t of [src.receive_time, src.write_time, src.timestamp]) if (typeof t === 'number' && Number.isFinite(t)) return t
  return null
}

/** Pages one Case can need for its exact count: up to 100,000 Alerts. */
const EXACT_MAX_PAGES = 2_000

/**
 * A Case's `size` counts every Alert it holds, including those that arrived after the period while
 * the Case stayed open. Cases whose first or last Alert falls outside the period have their Alerts
 * paged and counted by time, so the Report shows the exact figure of the period; the others are
 * already exact. Changes `alerts` in place and keeps the full size in `alertsAll`.
 */
export async function countAlertsInPeriod(
  ctx: CollectContext,
  cases: CaseSummary[],
  from: number,
  to: number,
  onPage?: () => void,
): Promise<{ outside: number; unverified: number }> {
  const crossing = cases.filter((c) => crossesPeriod(c, from, to))
  const inside = new Map<string, number>()
  const broken = new Set<string>()
  const pages = crossing.flatMap((c) => {
    const n = Math.ceil(c.alerts / PAGING.caseAlertsPage)
    if (n > EXACT_MAX_PAGES) {
      broken.add(c.id)
      return []
    }
    return Array.from({ length: n }, (_, k) => ({ caseId: c.id, skip: k * PAGING.caseAlertsPage }))
  })
  await runPool(pages, PAGING.concurrency, async ({ caseId, skip }) => {
    if (broken.has(caseId)) return
    try {
      const res = await ctx.client.get(ENDPOINTS.caseAlerts(caseId), { limit: PAGING.caseAlertsPage, skip }, CaseAlertsResponse, 20_000)
      // An Alert without a readable time is kept: only Alerts known to be outside are left out.
      const n = res.data.docs.filter((d) => {
        const t = d._source ? alertTime(d._source) : null
        return t == null || (t >= from && t <= to)
      }).length
      inside.set(caseId, (inside.get(caseId) ?? 0) + n)
    } catch (err) {
      if (err instanceof StellarApiError && err.code === 'auth_failed') throw err
      broken.add(caseId)
    } finally {
      onPage?.()
    }
  })
  let outside = 0
  for (const c of crossing) {
    if (broken.has(c.id)) continue
    const n = Math.min(inside.get(c.id) ?? 0, c.alerts)
    outside += c.alerts - n
    c.alertsAll = c.alerts
    c.alerts = n
  }
  return { outside, unverified: crossing.filter((c) => broken.has(c.id)).length }
}

/**
 * Pages the Alerts of each Key Case (50 per page, at most PAGING.caseAlertsMaxPerCase per Case) through
 * one shared queue, so a large Case does not hold a slot for its pages in sequence. A page that still
 * fails after the client's retries is counted and skipped; an authentication failure aborts.
 */
export async function collectTactics(
  ctx: CollectContext,
  cases: CaseSummary[],
  onPage?: () => void,
): Promise<ReportData['tactics']> {
  const acc = new TacticsAccumulator()
  const from = dayStart(ctx.period.start)
  const to = dayEnd(ctx.period.end)
  const pages = cases.flatMap((c) => {
    // A Case with Alerts outside the period is paged on its full size; those Alerts are filtered below.
    const wanted = Math.min(Math.max(c.alertsAll ?? c.alerts, 1), PAGING.caseAlertsMaxPerCase)
    return Array.from({ length: Math.ceil(wanted / PAGING.caseAlertsPage) }, (_, k) => ({ caseId: c.id, skip: k * PAGING.caseAlertsPage }))
  })
  await runPool(pages, PAGING.concurrency, async ({ caseId, skip }) => {
    try {
      const res = await ctx.client.get(ENDPOINTS.caseAlerts(caseId), { limit: PAGING.caseAlertsPage, skip }, CaseAlertsResponse, 20_000)
      acc.missing += res.data.docs.filter((d) => d.found === false || !d._source).length
      acc.add(
        caseId,
        res.data.docs.flatMap((d) => {
          if (!d._source) return []
          const t = alertTime(d._source)
          return t == null || (t >= from && t <= to) ? [d._source as AlertSource] : []
        }),
      )
      acc.fetched++
    } catch (err) {
      if (err instanceof StellarApiError && err.code === 'auth_failed') throw err
      // 403 security_exception: this credential's role may not read the index holding these Alerts.
      if (err instanceof StellarApiError && err.code === 'forbidden') acc.forbid(caseId)
      else acc.failed++
    } finally {
      onPage?.()
    }
  })
  return acc.result()
}

export function alertPageCount(cases: CaseSummary[]): number {
  return cases.reduce((n, c) => n + Math.ceil(Math.min(Math.max(c.alertsAll ?? c.alerts, 1), PAGING.caseAlertsMaxPerCase) / PAGING.caseAlertsPage), 0)
}

function toIngestionEntry(row: Record<string, unknown>, i: number, kind: 'sensor' | 'connector'): ReportData['ingestion']['bySensor'][number] {
  const first = (...keys: string[]) => keys.map((k) => row[k]).find((v) => v !== undefined && v !== null)
  const id = String(first('entry_identifier', '_id', 'id', `${kind}_id`) ?? `${kind}-${i}`)
  return {
    id,
    name: String(first(`${kind}_name`, 'name', 'entry_identifier') ?? id),
    type: String(first(`${kind}_type`, 'type') ?? ''),
    bytes: Number(first('total_ingestion', 'total_bytes', 'bytes_ingested', 'bytes')) || 0,
    events: Number(first('total_events', 'event_count', 'events')) || 0,
    known: true,
  }
}

/** Raw bytes per Data Sensor and per Connector over the period (before enrichment). */
export async function collectIngestion(ctx: CollectContext): Promise<ReportData['ingestion']> {
  const query = { cust_id: ctx.tenantId, start_time: dayStart(ctx.period.start), end_time: dayEnd(ctx.period.end) }
  const [bySensor, byConnector] = await Promise.all([
    ctx.client.get(ENDPOINTS.ingestionBySensor, query, IngestionResponse),
    ctx.client.get(ENDPOINTS.ingestionByConnector, query, IngestionResponse),
  ])
  return {
    bySensor: bySensor.map((r, i) => toIngestionEntry(r, i, 'sensor')),
    byConnector: byConnector.map((r, i) => toIngestionEntry(r, i, 'connector')),
  }
}

const AiVerdictsResponse = z.record(z.string(), z.unknown())
const AI_BATCH = 500

/**
 * AI Triage verdicts of the Key Cases. Only Instances with AI Triage (7.x) expose the endpoint:
 * 404/403 means "not available here", which the Report states, never a failed collector.
 */
export async function collectAiTriage(ctx: CollectContext, cases: CaseSummary[]): Promise<NonNullable<ReportData['aiTriage']>> {
  const verdicts: Record<string, AiVerdict> = {}
  for (let i = 0; i < cases.length; i += AI_BATCH) {
    const ids = cases.slice(i, i + AI_BATCH).map((c) => c.id)
    try {
      const res = await ctx.client.post(ENDPOINTS.aiCaseVerdicts, { case_ids: ids }, AiVerdictsResponse)
      for (const [id, v] of Object.entries(res)) {
        const verdict = (v as { verdict?: unknown } | null)?.verdict
        if (typeof verdict === 'string' && (AI_VERDICTS as readonly string[]).includes(verdict)) verdicts[id] = verdict as AiVerdict
      }
    } catch (err) {
      if (err instanceof StellarApiError && (err.code === 'not_found' || err.code === 'forbidden')) return { available: false, verdicts: {} }
      throw err
    }
  }
  return { available: true, verdicts }
}

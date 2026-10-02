import type { CaseSummary, ReportData } from '@poc-intel/shared'
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

export async function collectCases(ctx: CollectContext): Promise<{ caseStats: ReportData['caseStats']; keyCases: CaseSummary[] }> {
  const from = dayStart(ctx.period.start)
  const to = dayEnd(ctx.period.end)
  const [first, raw] = await Promise.all([
    ctx.client.get(ENDPOINTS.cases, { tenantid: ctx.tenantId, 'FROM~created_at': from, 'TO~created_at': to, limit: 1, skip: 0 }, CasesResponse),
    casesInRange(ctx, { sort: 'created_at', order: 'desc' }, from, to, CASES_CAP),
  ])
  const cases = raw.map(toCaseSummary).filter((c) => c.id)
  return { caseStats: caseStats(cases, first.data.total), keyCases: selectKeyCases(cases) }
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
  const pages = cases.flatMap((c) => {
    const wanted = Math.min(Math.max(c.alerts, 1), PAGING.caseAlertsMaxPerCase)
    return Array.from({ length: Math.ceil(wanted / PAGING.caseAlertsPage) }, (_, k) => ({ caseId: c.id, skip: k * PAGING.caseAlertsPage }))
  })
  await runPool(pages, PAGING.concurrency, async ({ caseId, skip }) => {
    try {
      const res = await ctx.client.get(ENDPOINTS.caseAlerts(caseId), { limit: PAGING.caseAlertsPage, skip }, CaseAlertsResponse, 20_000)
      acc.missing += res.data.docs.filter((d) => d.found === false || !d._source).length
      acc.add(caseId, res.data.docs.flatMap((d) => (d._source ? [d._source as AlertSource] : [])))
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
  return cases.reduce((n, c) => n + Math.ceil(Math.min(Math.max(c.alerts, 1), PAGING.caseAlertsMaxPerCase) / PAGING.caseAlertsPage), 0)
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

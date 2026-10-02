import type { CaseSummary, ReportData } from '@poc-intel/shared'

// Raw Case rows from GET /cases. Field names verified on a live tenant (poc.stellarcyber.cloud):
// _id, acknowledged, closed, created_at, cust_id, name, score, size, status, severity, resolution…
export type RawCase = Record<string, unknown>

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const v = [...values].sort((a, b) => a - b)
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2
}

export function normalizeSeverity(value: unknown): CaseSummary['severity'] {
  const s = String(value ?? '').toLowerCase()
  if (['critical', '4', 'p1'].includes(s)) return 'critical'
  if (['high', '3', 'p2'].includes(s)) return 'high'
  if (['low', '1', 'p4'].includes(s)) return 'low'
  return 'medium'
}

export function toCaseSummary(c: RawCase): CaseSummary {
  return {
    id: str(c._id) || str(c.id),
    name: str(c.name) || str(c.title),
    severity: normalizeSeverity(c.severity),
    status: str(c.status) || 'New',
    resolution: str(c.resolution),
    score: num(c.score),
    alerts: num(c.size) ?? 0,
    createdAt: num(c.created_at),
    startedAt: num(c.start_timestamp),
    // 0 means "not yet" in the API.
    acknowledgedAt: num(c.acknowledged) || null,
    closedAt: num(c.closed) || null,
  }
}

/**
 * Aggregates over every Case of the period. "Handled" = status other than New; times are measured
 * from created_at and only counted when the later timestamp is set and not earlier than creation.
 */
export function caseStats(cases: CaseSummary[], reportedTotal: number): NonNullable<ReportData['caseStats']> | null {
  if (cases.length === 0) return null
  const byStatus: Record<string, number> = {}
  const byResolution: Record<string, number> = {}
  const closeHours: number[] = []
  const ackMinutes: number[] = []
  let alerts = 0
  for (const c of cases) {
    alerts += c.alerts
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1
    if (c.resolution) byResolution[c.resolution] = (byResolution[c.resolution] ?? 0) + 1
    if (c.createdAt && c.closedAt && c.closedAt >= c.createdAt) closeHours.push((c.closedAt - c.createdAt) / 3_600_000)
    if (c.createdAt && c.acknowledgedAt && c.acknowledgedAt >= c.createdAt) ackMinutes.push((c.acknowledgedAt - c.createdAt) / 60_000)
  }
  const top5Alerts = cases
    .map((c) => c.alerts)
    .sort((a, b) => b - a)
    .slice(0, 5)
    .reduce((s, v) => s + v, 0)
  return {
    cases: cases.length,
    total: Math.max(reportedTotal, cases.length),
    alerts,
    byStatus,
    byResolution,
    handled: cases.length - (byStatus.New ?? 0),
    closed: closeHours.length,
    medianCloseHours: median(closeHours),
    acknowledged: ackMinutes.length,
    medianAckMinutes: median(ackMinutes),
    top5Alerts,
  }
}

export const MEDIUM_ANALYSED = 100
export const KEY_SEVERITY_CAP = 5_000

/**
 * The Cases whose Alerts are analysed: every Critical and High (capped per Severity) plus the most
 * recent Medium ones. Low Cases are counted, never analysed.
 */
export function selectKeyCases(cases: CaseSummary[]): CaseSummary[] {
  const newestFirst = [...cases].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  const pick = (sev: CaseSummary['severity'], cap: number) => newestFirst.filter((c) => c.severity === sev).slice(0, cap)
  return [...pick('critical', KEY_SEVERITY_CAP), ...pick('high', KEY_SEVERITY_CAP), ...pick('medium', MEDIUM_ANALYSED)]
}

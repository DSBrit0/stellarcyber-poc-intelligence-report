import { EFFORT_DEFAULTS, type CaseSummary, type PocDetails, type ReportData } from '@poc-intel/shared'
import { median } from '../../metrics/case-stats.js'
import { ALL_TACTICS, EDR_HINTS, RATING } from './constants.js'

// Report-level values shared by every Template (spec §0.7, §7). Deliberate deviations from the
// previous tool are marked FIX and listed in docs/porting/report-decisions.md.

export type Rating = 'high' | 'medium' | 'low'
export const rate = (pct: number): Rating => (pct >= RATING.high ? 'high' : pct >= RATING.medium ? 'medium' : 'low')

/** When the activity behind a Case started: start_timestamp, else the Case creation time. */
export const activityAt = (c: CaseSummary): number | null => c.startedAt ?? c.createdAt

/** Pending = not Resolved, Closed or Cancelled (New, In Progress and Escalated are pending). */
export const isPending = (status: string) => !/resolved|closed|cancel/i.test(status || 'New')

/** "Open" in the KPI sense: status New or Open. */
const isOpen = (status: string) => ['new', 'open'].includes((status || 'New').toLowerCase())

/** Strips the " and N other(s)" suffix Stellar Cyber appends to merged Case names. */
export const threatName = (name: string) => name.replace(/\s+and\s+\d+\s+other(s|\(s\))?$/i, '').trim() || '—'

export interface VolumeStats {
  days: number
  zeroDays: number
  from: string
  to: string
  total: number
  avg: number
  min: number
  minDate: string
  max: number
  maxDate: string
}

export function volumeStats(days: { date: string; value: number }[]): VolumeStats | null {
  const list = [...days].sort((a, b) => a.date.localeCompare(b.date))
  if (list.length === 0) return null
  const min = list.reduce((m, d) => (d.value < m.value ? d : m), list[0]!)
  const max = list.reduce((m, d) => (d.value > m.value ? d : m), list[0]!)
  const total = list.reduce((s, d) => s + d.value, 0)
  return {
    days: list.length,
    zeroDays: list.filter((d) => d.value === 0).length,
    from: list[0]!.date,
    to: list[list.length - 1]!.date,
    total,
    avg: total / list.length,
    min: min.value,
    minDate: min.date,
    max: max.value,
    maxDate: max.date,
  }
}

/** UTC calendar days of the period, inclusive. */
export function periodDays(start: string, end: string): string[] {
  const out: string[] = []
  for (let t = Date.parse(`${start}T00:00:00Z`), last = Date.parse(`${end}T00:00:00Z`); t <= last && out.length < 62; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}

export function deriveReport(data: ReportData, details: PocDetails) {
  const loaded = data.keyCases
  const crit = loaded.filter((c) => c.severity === 'critical')
  const high = loaded.filter((c) => c.severity === 'high')
  const critHigh = [...crit, ...high]
  const sev = data.cases.bySeverity
  const totalCases = sev.critical + sev.high + sev.medium + sev.low
  const stats = data.caseStats

  // Open / resolved: over every Case of the period when statistics exist.
  const openCount = stats ? (stats.byStatus.New ?? 0) + (stats.byStatus.Open ?? 0) : loaded.filter((c) => isOpen(c.status)).length
  const resolvedCount = stats ? stats.cases - openCount : loaded.length - openCount
  const statusBase = stats ? stats.cases : totalCases

  // FIX: coverage counts only the 14 Enterprise tactics, so it can never exceed 100%.
  const seenTactics = new Set(data.tactics.mitre.tactics.map((t) => t.id))
  const detectedTactics = new Set<string>(ALL_TACTICS.filter((t) => seenTactics.has(t.id)).map((t) => t.id))
  const mitreCovPct = Math.round((detectedTactics.size / ALL_TACTICS.length) * 100)

  const connectors = data.connectors
  const activeConnectors = connectors.filter((c) => c.active).length
  const integrationPct = connectors.length ? Math.round((activeConnectors / connectors.length) * 100) : 0
  const connByCategory = countBy(connectors.map((c) => c.category || c.type || ''))

  // FIX: one definition of "average score" — the mean of the Cases that have a numeric score.
  const scored = loaded.filter((c) => typeof c.score === 'number' && c.score > 0)
  const avgScore = scored.length ? Math.round(scored.reduce((s, c) => s + c.score!, 0) / scored.length) : 0

  // Time to detect: activity start → Case creation, over Cases created strictly after their activity began.
  const leads = loaded
    .filter((c) => c.startedAt != null && c.createdAt != null && c.createdAt > c.startedAt)
    .map((c) => (c.createdAt! - c.startedAt!) / 60_000)
  const mttdMinutes = median(leads) // FIX: true median, as everywhere else

  const noiseCases = stats ? stats.cases : loaded.length
  const noiseAlerts = stats ? stats.alerts : loaded.reduce((s, c) => s + (c.alerts || 1), 0)
  const noise = noiseCases
    ? { pct: noiseAlerts > noiseCases ? Math.round((1 - noiseCases / noiseAlerts) * 100) : 0, ratio: Math.round(noiseAlerts / noiseCases) }
    : null

  // Investigation efficiency: share of alerts the analysts no longer triage one by one.
  const investigation = stats?.alerts && stats.cases
    ? {
        pct: clamp(Math.round((1 - stats.cases / stats.alerts) * 100), 0, 100),
        detail: {
          alerts: stats.alerts,
          cases: stats.cases,
          ratio: stats.alerts / stats.cases,
          handled: stats.handled,
          handledPct: Math.round((stats.handled / stats.cases) * 100),
          medianCloseHours: stats.medianCloseHours,
        },
      }
    : { pct: loaded.length ? Math.round((loaded.filter((c) => !isOpen(c.status)).length / loaded.length) * 100) : 0, detail: null }

  const hasNdr = data.dataSensors.some((s) => /modular/i.test(s.kind) && s.status.toLowerCase() === 'connected')
  const hasEdr = connectors.some((c) => EDR_HINTS.some((h) => `${c.name} ${c.type} ${c.category}`.toLowerCase().includes(h)))

  const assetStats = data.assets.compliance.stats
  const vol = volumeStats(data.volume.dailyGb)
  const days = periodDays(data.period.start, data.period.end)
  const dayOf = (c: CaseSummary) => {
    const t = activityAt(c)
    return t == null ? '' : new Date(t).toISOString().slice(0, 10)
  }
  const daily = {
    days,
    critical: days.map((d) => crit.filter((c) => dayOf(c) === d).length),
    high: days.map((d) => high.filter((c) => dayOf(c) === d).length),
  }

  return {
    loaded,
    crit,
    high,
    critHigh,
    sev,
    totalCases,
    openCount,
    resolvedCount,
    statusBase,
    detectedTactics,
    mitreCovPct,
    activeConnectors,
    integrationPct,
    connByCategory,
    avgScore,
    mttdMinutes,
    noise,
    investigation,
    hasNdr,
    hasEdr,
    assetStats,
    vol,
    daily,
    effort: { ...EFFORT_DEFAULTS, ...details.effort },
  }
}
export type Derived = ReturnType<typeof deriveReport>

/** Counts by key, most frequent first; the empty key becomes "". */
export function countBy(keys: string[]): [string, number][] {
  const m = new Map<string, number>()
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1])
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Top detection types: Cases grouped by name (minus the merge suffix), by total alerts, top 8. */
export function detectionTypes(cases: CaseSummary[]) {
  const groups = new Map<string, { name: string; total: number; scores: number[] }>()
  for (const c of cases) {
    const name = (c.name || '—').replace(/ and \d+ other\(s\)$/i, '').trim()
    const g = groups.get(name) ?? { name, total: 0, scores: [] }
    g.total += c.alerts || 1
    if (typeof c.score === 'number') g.scores.push(c.score)
    groups.set(name, g)
  }
  return [...groups.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
    .map((g) => {
      const avg = g.scores.length ? g.scores.reduce((s, v) => s + v, 0) / g.scores.length : 50
      return { name: g.name, total: g.total, tone: avg >= 80 ? ('critical' as const) : avg <= 40 ? ('high' as const) : ('brand' as const) }
    })
}

/** Weekday (UTC, Sun=0) × hour grid of Critical and High Cases by activity time. */
export function heatmap(cases: CaseSummary[]) {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  for (const c of cases) {
    const t = activityAt(c)
    if (t == null) continue
    const d = new Date(t)
    grid[d.getUTCDay()]![d.getUTCHours()]!++
  }
  return { grid, max: Math.max(1, ...grid.flat()) }
}

/** Risk score histogram in 10 bins (100 lands in the last one). */
export function scoreHistogram(cases: CaseSummary[]) {
  const bins = Array<number>(10).fill(0)
  for (const c of cases) if (typeof c.score === 'number') bins[Math.min(9, Math.max(0, Math.floor(c.score / 10)))]!++
  return bins
}

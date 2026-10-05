import { EFFORT_DEFAULTS, type CaseSummary, type PocDetails, type ReportData } from '@poc-intel/shared'
import { median } from '../../metrics/case-stats.js'
import { ALL_TACTICS, EDR_HINTS, RATING } from './constants.js'

// Report-level values shared by every Template (spec §0.7, §7). Deliberate deviations from the
// previous tool are marked FIX and listed in docs/porting/report-decisions.md.

export type Rating = 'high' | 'medium' | 'low'
export const rate = (pct: number): Rating => (pct >= RATING.high ? 'high' : pct >= RATING.medium ? 'medium' : 'low')

/** When the activity behind a Case started: start_timestamp, else the Case creation time. */
export const activityAt = (c: CaseSummary): number | null => c.startedAt ?? c.createdAt

/**
 * Pending = not Resolved or Cancelled. The API's statuses are New, In Progress, Escalated, Resolved and Cancelled:
 * In Progress and Escalated are still pending. "Closed" and "Open" come from older Instances.
 */
export const isPending = (status: string) => !/resolved|closed|cancel/i.test(status || 'New')

/** Strips the " and N other(s)" suffix Stellar Cyber appends to merged Case names. */
export const threatName = (name: string) => name.replace(/\s+and\s+\d+\s+other(s|\(s\))?$/i, '').trim() || '—'

/** Minutes from the first alert's activity to the Case creation; null when unknown or negative. */
export function leadMinutes(c: CaseSummary): number | null {
  if (c.startedAt == null || c.createdAt == null) return null
  const m = (c.createdAt - c.startedAt) / 60_000
  return m >= 0 ? m : null
}

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

export type AiStatus = 'ok' | 'not_exposed' | 'no_cases' | 'failed'

/** Verdicts the Report treats as noise the team does not need to investigate. */
export const isNoiseVerdict = (v: string | undefined) => v === 'False Positive' || v === 'Benign' || v === 'Benign True Positive'

/**
 * Auto Triage as the Report reads it; null when the Owner did not mark it as tested. Older Report Data has no
 * status (derived from `available` and the Cases) and verdicts for the Key Cases only (no `bySeverity`).
 */
export function aiTriageView(data: ReportData) {
  const ai = data.aiTriage
  if (!ai) return null
  const anyCases = data.keyCases.length > 0 || data.cases.total > 0
  const status: AiStatus = ai.status ?? (ai.available ? (anyCases ? 'ok' : 'no_cases') : 'not_exposed')
  const verdicts = status === 'ok' ? ai.verdicts : {}
  const counts = new Map<string, number>()
  if (status === 'ok' && ai.bySeverity) {
    for (const bySev of Object.values(ai.bySeverity)) for (const [v, n] of Object.entries(bySev)) counts.set(v, (counts.get(v) ?? 0) + (n ?? 0))
  } else {
    for (const v of Object.values(verdicts)) counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  const triaged = [...counts.values()].reduce((s, n) => s + n, 0)
  const noise = [...counts].filter(([v]) => isNoiseVerdict(v)).reduce((s, [, n]) => s + n, 0)
  return {
    status,
    verdictOf: (caseId: string): string | undefined => verdicts[caseId],
    isNoise: (caseId: string) => isNoiseVerdict(verdicts[caseId]),
    /** Verdict → Cases over every triaged Case of the period (Key Cases only on older Report Data). */
    counts,
    triaged,
    noise,
  }
}
export type AiTriageView = NonNullable<ReturnType<typeof aiTriageView>>

export type SourceState = 'online' | 'offline' | 'error' | 'nodata'

/** A Connector or Data Sensor that sends data; Responders (collect === false) are not data sources. */
export interface DataSource {
  kind: 'connector' | 'sensor'
  id: string
  name: string
  type: string
  /** Raw bytes received in the period; null when unknown (older Report Data without ingestion). */
  bytes: number | null
  hasData: boolean
  state: SourceState
  /** Why the source is not healthy, as the API says it. */
  reason: string
}

/**
 * Data sources and their health. A Connector with a health code above 0 is in error (code 3 = no data in
 * the past 24 hours), whatever its `active` flag says; integration counts the sources that sent data in the period.
 */
export function dataSources(data: ReportData) {
  const ingestByName = new Map(data.ingestion.byConnector.map((c) => [c.name, c.bytes]))
  const ingestBySensor = new Map(data.ingestion.bySensor.map((s) => [s.id, s.bytes]))
  const responders = data.connectors.filter((c) => c.collect === false)
  const connectors: DataSource[] = data.connectors
    .filter((c) => c.collect !== false)
    .map((c) => {
      const bytes = c.bytesInPeriod ?? ingestByName.get(c.name) ?? null
      const code = c.healthCode ?? 0
      const state: SourceState = code > 0 ? (code === 3 ? 'nodata' : 'error') : c.active ? 'online' : 'offline'
      return {
        kind: 'connector' as const,
        id: c.id,
        name: c.name || c.id,
        type: c.type || c.category || '',
        bytes,
        hasData: bytes != null ? bytes > 0 : c.active && code <= 0,
        state,
        reason: code > 0 ? c.healthMessage : '',
      }
    })
  const sensors: DataSource[] = data.dataSensors.map((s) => {
    const bytes = ingestBySensor.get(s.id) ?? null
    return {
      kind: 'sensor' as const,
      id: s.id,
      name: s.name || s.id,
      type: s.kind,
      bytes,
      hasData: bytes != null ? bytes > 0 : s.online,
      state: s.online ? 'online' : 'offline',
      reason: s.online ? '' : (s.message ?? ''),
    }
  })
  const all = [...connectors, ...sensors]
  const withData = all.filter((x) => x.hasData).length
  return {
    connectors,
    sensors,
    responders,
    all,
    withData,
    /** Sources that sent data in the period / data sources; null without any data source. */
    integrationPct: all.length ? Math.round((withData / all.length) * 100) : null,
  }
}

/** Share of the Key Cases' Alerts the collection could not read (aged out or forbidden pages), when above 20%. */
export function mitreGap(data: ReportData): number | null {
  const t = data.tactics
  const pages = t.pages.fetched + t.pages.failed + t.pages.forbidden
  const forbidden = pages ? t.pages.forbidden / pages : 0
  const aged = t.alertsRead ? t.alertsMissing / t.alertsRead : 0
  const share = Math.max(forbidden, aged)
  return share > 0.2 ? share : null
}

/** Assets and licensing volume cover the last 31 days before the collection; true when the period starts earlier. */
export function outside31Days(data: ReportData): boolean {
  const windowStart = Date.parse(data.collectedAt) - 32 * 86_400_000
  return Date.parse(`${data.period.start}T00:00:00Z`) < windowStart
}

export function deriveReport(data: ReportData, details: PocDetails) {
  const loaded = data.keyCases
  const crit = loaded.filter((c) => c.severity === 'critical')
  const high = loaded.filter((c) => c.severity === 'high')
  const critHigh = [...crit, ...high]
  const sev = data.cases.bySeverity
  const totalCases = sev.critical + sev.high + sev.medium + sev.low
  const stats = data.caseStats

  // Pending / resolved: over every Case of the period when statistics exist (one definition: isPending).
  const openCount = stats
    ? Object.entries(stats.byStatus).reduce((s, [k, n]) => s + (isPending(k) ? n : 0), 0)
    : loaded.filter((c) => isPending(c.status)).length
  const statusBase = stats ? stats.cases : loaded.length
  const resolvedCount = statusBase - openCount

  // FIX: coverage counts only the 14 Enterprise tactics, so it can never exceed 100%.
  const seenTactics = new Set(data.tactics.mitre.tactics.map((t) => t.id))
  const detectedTactics = new Set<string>(ALL_TACTICS.filter((t) => seenTactics.has(t.id)).map((t) => t.id))
  const mitreCovPct = Math.round((detectedTactics.size / ALL_TACTICS.length) * 100)

  const connectors = data.connectors
  const sources = dataSources(data)
  const connByCategory = countBy(sources.connectors.map((c) => connectors.find((x) => x.id === c.id)?.category || c.type || ''))

  // FIX: one definition of "average score" — the mean of the analysed Cases that have a numeric score.
  const scored = loaded.filter((c) => typeof c.score === 'number' && c.score > 0)
  const avgScore = scored.length ? Math.round(scored.reduce((s, c) => s + c.score!, 0) / scored.length) : 0

  // Time to detect (one definition for 2.3 and the Detection Story): activity start → Case creation, median
  // over the analysed Cases whose creation is not before their activity.
  const leads = loaded.map(leadMinutes).filter((v): v is number => v != null)
  const mttdMinutes = median(leads)

  const noiseCases = stats ? stats.cases : loaded.length
  const noiseAlerts = stats ? stats.alerts : loaded.reduce((s, c) => s + (c.alerts || 1), 0)
  const noise = noiseCases
    ? { pct: noiseAlerts > noiseCases ? Math.round((1 - noiseCases / noiseAlerts) * 100) : 0, ratio: noiseAlerts / noiseCases }
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
    : { pct: loaded.length ? Math.round((loaded.filter((c) => !isPending(c.status)).length / loaded.length) * 100) : 0, detail: null }

  const hasNdr = data.dataSensors.some((s) => /modular/i.test(s.kind) && s.status.toLowerCase() === 'connected')
  // Evidence of EDR: an EDR connector that sent data, not only one configured.
  const hasEdr = sources.connectors.some((c) => c.hasData && EDR_HINTS.some((h) => `${c.name} ${c.type}`.toLowerCase().includes(h)))

  const allZero = (days: { value: number }[]) => days.every((x) => !x.value)
  const assetsZero = allZero(data.assets.daily)
  const volumeZero = allZero(data.volume.dailyGb)
  const assetStats = assetsZero ? null : data.assets.compliance.stats
  // Volume statistics from the first day with data (the days before onboarding are zeros), total over the period.
  const firstVolDay = data.volume.compliance.firstDataDate
  const vol = volumeZero ? null : volumeStats(firstVolDay ? data.volume.dailyGb.filter((x) => x.date >= firstVolDay) : data.volume.dailyGb)
  const volTotal = data.volume.dailyGb.reduce((s, x) => s + x.value, 0)
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
    /** No Case in the period: the Report shows the empty-state texts instead of detection results. */
    noCases: totalCases === 0 && loaded.length === 0,
    openCount,
    resolvedCount,
    statusBase,
    detectedTactics,
    mitreCovPct,
    sources,
    integrationPct: sources.integrationPct,
    connByCategory,
    avgScore,
    mttdMinutes,
    mttdCases: leads.length,
    noise,
    investigation,
    hasNdr,
    hasEdr,
    assetsZero,
    volumeZero,
    assetStats,
    vol,
    volTotal,
    daily,
    ai: aiTriageView(data),
    mitreGap: mitreGap(data),
    outside31: outside31Days(data),
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
    // FIX: the API writes "and N others" as well as "and N other(s)"; group both, as the Detection Story does.
    const name = threatName(c.name || '—')
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

/** One row of the Technical case list's summary: the analysed Cases of one detection type. */
export interface CaseType {
  name: string
  cases: number
  critHigh: number
  pending: number
  maxScore: number | null
  first: number | null
  last: number | null
}

/** The analysed Cases grouped by detection type ("… and N others" folded), most Critical/High first. */
export function caseTypes(cases: CaseSummary[]): CaseType[] {
  const groups = new Map<string, CaseType>()
  for (const c of cases) {
    const name = threatName(c.name || '—')
    const g = groups.get(name) ?? { name, cases: 0, critHigh: 0, pending: 0, maxScore: null, first: null, last: null }
    g.cases++
    if (c.severity === 'critical' || c.severity === 'high') g.critHigh++
    if (isPending(c.status)) g.pending++
    if (typeof c.score === 'number') g.maxScore = Math.max(g.maxScore ?? 0, c.score)
    const at = activityAt(c)
    if (at != null) {
      g.first = g.first == null ? at : Math.min(g.first, at)
      g.last = g.last == null ? at : Math.max(g.last, at)
    }
    groups.set(name, g)
  }
  return [...groups.values()].sort((a, b) => b.critHigh - a.critHigh || b.cases - a.cases || (b.maxScore ?? 0) - (a.maxScore ?? 0))
}

/** Cases of one Severity, highest score first (then most alerts). */
export const byScore = (cases: CaseSummary[]) => [...cases].sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.alerts - a.alerts)

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

import { EFFORT_DEFAULTS, type CaseSummary, type ReportData } from '@poc-intel/shared'
import { median } from '../../metrics/case-stats.js'
import { SCORE_CUT, SMALL_SAMPLE, SOC_TARGETS } from './constants.js'
import { isPending, threatName, type Derived } from './derived.js'

// The Executive Detection Story (spec §3): five questions, each kept only when its data exists.

const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const

/** Minutes from the first alert's activity to the Case creation; null when unknown or negative. */
export function leadMinutes(c: CaseSummary): number | null {
  if (c.startedAt == null || c.createdAt == null) return null
  const m = (c.createdAt - c.startedAt) / 60_000
  return m >= 0 ? m : null
}

/** Q1 — did the platform separate what matters from the noise? */
export function signalFunnel(data: ReportData, d: Derived) {
  const s = data.caseStats
  if (!s?.alerts || !s.cases) return null
  const pending = d.critHigh.filter((c) => isPending(c.status))
  const critHighAlerts = d.critHigh.reduce((sum, c) => sum + c.alerts, 0)
  return {
    volumeGB: d.vol ? d.vol.total : null,
    alerts: s.alerts,
    cases: s.cases,
    critHigh: d.critHigh.length,
    pending: pending.length,
    pendingCritical: pending.filter((c) => c.severity === 'critical').length,
    pendingHigh: pending.filter((c) => c.severity === 'high').length,
    alertsPerCase: s.alerts / s.cases,
    critHighAlertShare: Math.min(1, critHighAlerts / s.alerts),
    critHighShare: d.critHigh.length / s.cases,
  }
}

/** Q2 — what needs attention: one card per threat (Case name), up to five. */
export function topThreats(data: ReportData, d: Derived, n = 5) {
  const sorted = [...d.critHigh].sort(
    (a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || (b.score ?? -1) - (a.score ?? -1) || b.alerts - a.alerts,
  )
  const groups = new Map<string, CaseSummary[]>()
  for (const c of sorted) {
    const key = threatName(c.name || c.id).toLowerCase()
    groups.set(key, [...(groups.get(key) ?? []), c])
  }
  return [...groups.values()].slice(0, n).map((group, i) => {
    const lead = group[0]!
    const per = data.tactics.byCase[lead.id]
    return {
      rank: i + 1,
      id: lead.id,
      name: threatName(lead.name || lead.id),
      similar: group.length - 1,
      severity: lead.severity,
      score: lead.score,
      alerts: lead.alerts,
      status: lead.status || 'New',
      pending: isPending(lead.status),
      detectedAt: lead.createdAt,
      leadMin: leadMinutes(lead),
      tactics: (per?.tactics ?? []).slice(0, 3).map((t) => t.name),
      xdr: (per?.xdr ?? []).slice(0, 2).map((t) => t.name),
      techniques: (per?.techniques ?? []).slice(0, 3).map((t) => t.name),
    }
  })
}
export type Threat = ReturnType<typeof topThreats>[number]

export type Quadrant = 'act' | 'investigate' | 'monitor' | 'noise'

/** Q3 — where to act first: score × alerts, cut at score 70 and the median alert count. */
export function priorityMatrix(cases: CaseSummary[], ranks: Map<string, number>) {
  const plotted = cases.filter((c) => typeof c.score === 'number')
  if (plotted.length === 0) return null
  const alertCut = Math.max(2, Math.round(median(plotted.map((c) => c.alerts || 1)) ?? 2) || 2)
  const counts: Record<Quadrant, number> = { act: 0, investigate: 0, monitor: 0, noise: 0 }
  let actCritHigh = 0
  const points = plotted.map((c) => {
    const alerts = Math.max(1, c.alerts || 1)
    const hiS = c.score! >= SCORE_CUT
    const hiA = alerts >= alertCut
    const q: Quadrant = hiS ? (hiA ? 'act' : 'investigate') : hiA ? 'monitor' : 'noise'
    counts[q]++
    if (q === 'act' && (c.severity === 'critical' || c.severity === 'high')) actCritHigh++
    return { id: c.id, score: c.score!, alerts, sev: c.severity, q, rank: ranks.get(c.id) ?? null }
  })
  return {
    points,
    scoreCut: SCORE_CUT,
    alertCut,
    counts,
    actCritHigh,
    excluded: cases.length - plotted.length,
    maxAlerts: Math.max(1, ...points.map((p) => p.alerts)),
  }
}

export type Lamp = 'green' | 'yellow' | 'red' | 'none' | 'info'

/** Q4 — is the operation under control: six indicators against SOC targets. Always present. */
export function responseScorecard(data: ReportData, d: Derived) {
  const s = data.caseStats
  const pend = d.critHigh.filter((c) => isPending(c.status))
  const critOpen = pend.filter((c) => c.severity === 'critical').length
  const highOpen = pend.filter((c) => c.severity === 'high').length
  const handledPct = s?.cases ? (s.handled / s.cases) * 100 : null
  const ack = s?.medianAckMinutes ?? null
  const close = s?.medianCloseHours ?? null
  const leadValues = d.critHigh.map(leadMinutes).filter((v): v is number => v != null)
  const lead = median(leadValues)
  const upTo = (v: number | null, t: number): Lamp => (v == null ? 'none' : v <= t ? 'green' : v <= 2 * t ? 'yellow' : 'red')
  const T = SOC_TARGETS
  const tiles = [
    { key: 'critOpen', value: critOpen as number | null, lamp: (critOpen <= T.critOpen ? 'green' : 'red') as Lamp },
    { key: 'highOpen', value: highOpen, lamp: (highOpen <= T.highOpen ? 'green' : highOpen <= T.highOpenYellow ? 'yellow' : 'red') as Lamp },
    {
      key: 'handled',
      value: handledPct,
      lamp: (handledPct == null ? 'none' : handledPct >= T.handledPct ? 'green' : handledPct >= 100 - 2 * (100 - T.handledPct) ? 'yellow' : 'red') as Lamp,
      handled: s?.handled ?? 0,
      cases: s?.cases ?? 0,
    },
    { key: 'ack', value: ack, lamp: upTo(ack, T.ackMin), n: s?.acknowledged ?? 0 },
    { key: 'close', value: close, lamp: upTo(close, T.closeHours), n: s?.closed ?? 0 },
    { key: 'lead', value: lead, lamp: (lead == null ? 'none' : 'info') as Lamp, n: leadValues.length },
  ] as const
  const rated = tiles.filter((t) => t.lamp === 'green' || t.lamp === 'yellow' || t.lamp === 'red')
  return {
    tiles,
    critOpen,
    highOpen,
    rated: rated.length,
    inTarget: rated.filter((t) => t.lamp === 'green').length,
    attention: rated.filter((t) => t.lamp !== 'green').map((t) => t.key),
  }
}

/** Q5 — analyst effort avoided by correlating Alerts into Cases. */
export function effortEstimate(data: ReportData, d: Derived) {
  const s = data.caseStats
  if (!s?.alerts) return null
  const p = d.effort
  const critHigh = d.critHigh.length
  const medium = d.sev.medium
  const low = d.sev.low
  const cases = critHigh + medium + low
  const triageWithoutH = (s.alerts * p.alertMin) / 60
  const triageWithH = (cases * p.alertMin) / 60
  const invH = (critHigh * p.critHighMin + medium * p.mediumMin + low * p.lowMin) / 60
  const savedH = Math.max(0, triageWithoutH - triageWithH)
  return {
    alerts: s.alerts,
    cases,
    triageWithoutH,
    triageWithH,
    invH,
    savedH,
    withoutH: triageWithoutH + invH,
    withH: triageWithH + invH,
    savedPct: triageWithoutH ? savedH / triageWithoutH : 0,
    savedFte: savedH / p.monthHours,
    focusPct: cases ? critHigh / cases : 0,
    premises: p,
    custom: (Object.keys(p) as (keyof typeof p)[]).some((k) => p[k] !== EFFORT_DEFAULTS[k]),
    flags: {
      small: s.cases < SMALL_SAMPLE,
      concentrated: s.alerts > 0 && s.top5Alerts / s.alerts > 0.5,
      top5Pct: s.alerts > 0 ? s.top5Alerts / s.alerts : 0,
    },
  }
}

/** The questions that have data, in order; numbering is by position. */
export function buildStory(data: ReportData, d: Derived) {
  const q1 = data.caseStats ? signalFunnel(data, d) : null
  const q2 = topThreats(data, d)
  const ranks = new Map(q2.map((t) => [t.id, t.rank]))
  const q3 = priorityMatrix(d.loaded, ranks)
  const q4 = responseScorecard(data, d)
  const q5 = effortEstimate(data, d)
  const capped = data.caseStats && data.caseStats.total > data.caseStats.cases ? { n: data.caseStats.cases, t: data.caseStats.total } : null
  return {
    q1,
    q2: q2.length ? q2 : null,
    q3: q3 && q3.points.length ? q3 : null,
    q4,
    q5,
    capped,
    shownOnCards: q2.reduce((s, t) => s + 1 + t.similar, 0),
  }
}
export type Story = ReturnType<typeof buildStory>

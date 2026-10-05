import { EFFORT_DEFAULTS, type CaseSummary, type ReportData } from '@poc-intel/shared'
import { median } from '../../metrics/case-stats.js'
import { SCORE_CUT, SMALL_SAMPLE, SOC_TARGETS } from './constants.js'
import { isPending, leadMinutes, threatName, type Derived } from './derived.js'

export { leadMinutes }

// The Executive Detection Story (spec §3): five questions, each kept only when its data exists.

const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const

/** Cases Auto Triage classified as False Positive or Benign leave the "pending" and "act now" counts. */
const noiseOf = (d: Derived) => (c: CaseSummary) => d.ai?.isNoise(c.id) ?? false

/** Q1 — did the platform separate what matters from the noise? */
export function signalFunnel(data: ReportData, d: Derived) {
  const s = data.caseStats
  if (!s?.alerts || !s.cases) return null
  const isNoise = noiseOf(d)
  const pendingAll = d.critHigh.filter((c) => isPending(c.status))
  const pending = pendingAll.filter((c) => !isNoise(c))
  const critHighAlerts = d.critHigh.reduce((sum, c) => sum + c.alerts, 0)
  return {
    volumeGB: d.vol ? d.vol.total : null,
    alerts: s.alerts,
    cases: s.cases,
    critHigh: d.critHigh.length,
    pending: pending.length,
    pendingCritical: pending.filter((c) => c.severity === 'critical').length,
    pendingHigh: pending.filter((c) => c.severity === 'high').length,
    /** Pending Critical/High Cases left out because Auto Triage called them False Positive or Benign. */
    pendingNoise: pendingAll.length - pending.length,
    alertsPerCase: s.alerts / s.cases,
    critHighAlertShare: Math.min(1, critHighAlerts / s.alerts),
    critHighShare: d.critHigh.length / s.cases,
  }
}

/** Auto Triage order: True Positives first, then Cases without a verdict, then False Positive/Benign. */
const verdictRank = (v: string | undefined) => (v === 'True Positive' ? 0 : v === 'False Positive' || v === 'Benign' || v === 'Benign True Positive' ? 2 : 1)

/** Q2 — what needs attention: one card per threat (Case name), up to five; Auto Triage True Positives first. */
export function topThreats(data: ReportData, d: Derived, n = 5) {
  const verdict = (c: CaseSummary) => d.ai?.verdictOf(c.id)
  const sorted = [...d.critHigh].sort(
    (a, b) =>
      verdictRank(verdict(a)) - verdictRank(verdict(b)) ||
      SEV_RANK[a.severity] - SEV_RANK[b.severity] ||
      (b.score ?? -1) - (a.score ?? -1) ||
      b.alerts - a.alerts,
  )
  const groups = new Map<string, CaseSummary[]>()
  for (const c of sorted) {
    const key = threatName(c.name || c.id).toLowerCase()
    groups.set(key, [...(groups.get(key) ?? []), c])
  }
  return [...groups.values()].slice(0, n).map((group, i) => {
    const lead = group[0]!
    const per = data.tactics.byCase[lead.id]
    const ent = data.tactics.entitiesByCase?.[lead.id]
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
      verdict: verdict(lead) ?? null,
      /** Top 2 users, hosts and external IPs of the Case, when collected. */
      entities: ent ? [...ent.users, ...ent.hosts, ...ent.externalIps].slice(0, 2) : [],
    }
  })
}
export type Threat = ReturnType<typeof topThreats>[number]

export type Quadrant = 'act' | 'investigate' | 'monitor' | 'noise'

/** Q3 — where to act first: score × alerts, cut at score 70 and the median alert count. */
export function priorityMatrix(cases: CaseSummary[], ranks: Map<string, number>, isNoise: (c: CaseSummary) => boolean = () => false) {
  const plotted = cases.filter((c) => typeof c.score === 'number')
  if (plotted.length === 0) return null
  const alertCut = Math.max(2, Math.round(median(plotted.map((c) => c.alerts || 1)) ?? 2) || 2)
  const counts: Record<Quadrant, number> = { act: 0, investigate: 0, monitor: 0, noise: 0 }
  let actCritHigh = 0
  let actNoise = 0
  const points = plotted.map((c) => {
    const alerts = Math.max(1, c.alerts || 1)
    const hiS = c.score! >= SCORE_CUT
    const hiA = alerts >= alertCut
    const q: Quadrant = hiS ? (hiA ? 'act' : 'investigate') : hiA ? 'monitor' : 'noise'
    if (q === 'act' && isNoise(c)) actNoise++
    else {
      counts[q]++
      if (q === 'act' && (c.severity === 'critical' || c.severity === 'high')) actCritHigh++
    }
    return { id: c.id, score: c.score!, alerts, sev: c.severity, q, rank: ranks.get(c.id) ?? null }
  })
  return {
    points,
    scoreCut: SCORE_CUT,
    alertCut,
    counts,
    actCritHigh,
    /** "Act now" Cases left out of the counts because Auto Triage called them False Positive or Benign. */
    actNoise,
    excluded: cases.length - plotted.length,
    maxAlerts: Math.max(1, ...points.map((p) => p.alerts)),
  }
}

export type Lamp = 'green' | 'yellow' | 'red' | 'none' | 'info'

/** Q4 — is the operation under control: six indicators against SOC targets. Always present. */
export function responseScorecard(data: ReportData, d: Derived) {
  const s = data.caseStats
  const isNoise = noiseOf(d)
  const pendAll = d.critHigh.filter((c) => isPending(c.status))
  const pend = pendAll.filter((c) => !isNoise(c))
  const critOpen = pend.filter((c) => c.severity === 'critical').length
  const highOpen = pend.filter((c) => c.severity === 'high').length
  const handledPct = s?.cases ? (s.handled / s.cases) * 100 : null
  const ack = s?.medianAckMinutes ?? null
  const close = s?.medianCloseHours ?? null
  // The same time to detect as 2.3 (one definition, in derived.ts).
  const lead = d.mttdMinutes
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
    { key: 'lead', value: lead, lamp: (lead == null ? 'none' : 'info') as Lamp, n: d.mttdCases },
  ] as const
  const rated = tiles.filter((t) => t.lamp === 'green' || t.lamp === 'yellow' || t.lamp === 'red')
  return {
    tiles,
    critOpen,
    highOpen,
    pendingNoise: pendAll.length - pend.length,
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
  const q3 = priorityMatrix(d.loaded, ranks, noiseOf(d))
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

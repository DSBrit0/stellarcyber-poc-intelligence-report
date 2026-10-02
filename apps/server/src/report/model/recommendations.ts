import type { ReportData } from '@poc-intel/shared'
import { isPending, activityAt } from './derived.js'

// Operational recommendation rules (spec §5, rules 1–5 and 7). The MITRE rows of section 8.2 are
// built from the techniques directly, so rule 6 is not needed here.

export type Priority = 'critical' | 'warning' | 'info'
export interface Recommendation {
  id: 'connectorCoverage' | 'dataGap' | 'caseBacklog' | 'staleCritical' | 'staleConnectors' | 'allGood'
  priority: Priority
  category: string
  impact: number
  vars: Record<string, string | number>
}

const H = 3_600_000
const ORDER: Record<Priority, number> = { critical: 0, warning: 1, info: 2 }

/**
 * FIX: every age is measured at the end of the PoC period (or when the data was collected, if
 * earlier), not when the Report is rendered — so a Report regenerated months later says the same.
 */
export function referenceTime(data: ReportData): number {
  return Math.min(Date.parse(data.collectedAt), Date.parse(`${data.period.end}T23:59:59.999Z`))
}

export function recommendations(data: ReportData): Recommendation[] {
  const now = referenceTime(data)
  const out: Recommendation[] = []
  const conns = data.connectors

  // 1. Inactive connectors above 20%.
  const offline = conns.filter((c) => !c.active).length
  const offlinePct = conns.length ? (offline / conns.length) * 100 : 0
  if (offlinePct > 20) {
    out.push({
      id: 'connectorCoverage',
      priority: offlinePct > 50 ? 'critical' : 'warning',
      category: 'Infrastructure',
      impact: Math.min(100, offlinePct * 1.5),
      vars: { offline, total: conns.length, pct: offlinePct.toFixed(0) },
    })
  }

  // 2. Most recent data from any connector older than 2 h.
  const lastSeen = conns.map((c) => c.lastDataReceived ?? c.lastActivity).filter((t): t is number => t != null)
  if (lastSeen.length) {
    const hrsAgo = (now - Math.max(...lastSeen)) / H
    if (hrsAgo > 2) {
      out.push({ id: 'dataGap', priority: hrsAgo > 6 ? 'critical' : 'warning', category: 'Data Pipeline', impact: Math.min(100, hrsAgo * 10), vars: { hours: hrsAgo.toFixed(1) } })
    }
  }

  // 3. Backlog: more than 50 analysed Cases still New/Open.
  const open = data.keyCases.filter((c) => ['new', 'open'].includes(c.status.toLowerCase())).length
  if (open > 50) {
    out.push({ id: 'caseBacklog', priority: open > 100 ? 'critical' : 'warning', category: 'Operations', impact: Math.min(100, open * 0.8), vars: { open } })
  }

  // 4. Critical Cases unresolved for more than 24 h. FIX: resolved Cases are no longer counted.
  const stale = data.keyCases.filter((c) => {
    const t = activityAt(c)
    return c.severity === 'critical' && isPending(c.status) && t != null && now - t > 24 * H
  }).length
  if (stale > 0) out.push({ id: 'staleCritical', priority: 'critical', category: 'Incident Response', impact: 95, vars: { n: stale } })

  // 5. Connectors without data for 48 h (or never).
  const staleConns = conns.filter((c) => {
    const t = c.lastDataReceived ?? c.lastActivity
    return t == null || now - t > 48 * H
  }).length
  if (staleConns > 0 && conns.length > 0) {
    const pct = ((staleConns / conns.length) * 100).toFixed(0)
    out.push({ id: 'staleConnectors', priority: Number(pct) > 30 ? 'warning' : 'info', category: 'Data Coverage', impact: Math.min(85, staleConns * 2), vars: { n: staleConns, pct } })
  }

  // 7. Nothing to report, but there was data to look at.
  if (out.length === 0 && data.tactics.mitre.techniques.length === 0 && (data.keyCases.length > 0 || conns.length > 0)) {
    out.push({ id: 'allGood', priority: 'info', category: 'General', impact: 5, vars: {} })
  }

  return out.sort((a, b) => ORDER[a.priority] - ORDER[b.priority])
}

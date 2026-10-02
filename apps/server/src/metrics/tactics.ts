import type { ReportData } from '@poc-intel/shared'

// Classifies Alerts from GET /cases/{id}/alerts (docs[]._source.xdr_event):
//   MITRE ATT&CK  → tactic ids starting with "TA" (techniques T1…/T0…)
//   XDR Kill Chain → Stellar Cyber's own ids, "XTA…" (techniques "XT…")
// Ported from the previous tool's fetchCaseTactics.

export interface AlertSource {
  event_score?: unknown
  xdr_event?: {
    description?: unknown
    tactic?: { id?: unknown; name?: unknown }
    technique?: { id?: unknown; name?: unknown }
  }
}

const TOP_ALERTS_PER_CASE = 3
const s = (v: unknown) => (typeof v === 'string' ? v : '')

interface Agg {
  id: string
  name: string
  tacticId?: string
  tacticName?: string
  caseIds: Set<string>
  alertCount: number
}

type Counter = Map<string, { id: string; name: string; alerts: number }>

/** Accumulates Alerts page by page; `result()` produces the Report Data shape. */
export class TacticsAccumulator {
  #mitreTactics = new Map<string, Agg>()
  #mitreTechniques = new Map<string, Agg>()
  #xdrTactics = new Map<string, Agg>()
  #xdrTechniques = new Map<string, Agg>()
  #perCase = new Map<string, { tactics: Counter; xdr: Counter; techniques: Counter }>()
  #topAlerts = new Map<string, { score: number; description: string }[]>()
  fetched = 0
  failed = 0

  add(caseId: string, alerts: AlertSource[]): void {
    for (const src of alerts) {
      this.#keepTopAlert(caseId, src)
      const xdr = src.xdr_event ?? {}
      const tacticId = s(xdr.tactic?.id)
      if (!tacticId) continue
      const tacticName = s(xdr.tactic?.name)
      const techniqueId = s(xdr.technique?.id)
      const techniqueName = s(xdr.technique?.name)
      const isMitre = tacticId.startsWith('TA')

      let pc = this.#perCase.get(caseId)
      if (!pc) this.#perCase.set(caseId, (pc = { tactics: new Map(), xdr: new Map(), techniques: new Map() }))
      bump(isMitre ? pc.tactics : pc.xdr, tacticId, tacticName)
      if (isMitre && techniqueId) bump(pc.techniques, techniqueId, techniqueName)

      track(isMitre ? this.#mitreTactics : this.#xdrTactics, { id: tacticId, name: tacticName }, caseId)
      if (techniqueId) {
        track(isMitre ? this.#mitreTechniques : this.#xdrTechniques, { id: techniqueId, name: techniqueName, tacticId, tacticName }, caseId)
      }
    }
  }

  // Distinct descriptions with the highest event_score; one entry per text, keeping its best score.
  #keepTopAlert(caseId: string, src: AlertSource) {
    const description = s(src.xdr_event?.description)
    if (!description) return
    const score = Number(src.event_score) || 0
    const list = this.#topAlerts.get(caseId) ?? []
    const same = list.find((a) => a.description === description)
    if (same) same.score = Math.max(same.score, score)
    else list.push({ score, description })
    list.sort((a, b) => b.score - a.score)
    this.#topAlerts.set(caseId, list.slice(0, TOP_ALERTS_PER_CASE))
  }

  result(): ReportData['tactics'] {
    const byAlerts = (m: Counter) => [...m.values()].sort((a, b) => b.alerts - a.alerts)
    return {
      mitre: { tactics: toArray(this.#mitreTactics), techniques: toArray(this.#mitreTechniques) },
      xdr: { tactics: toArray(this.#xdrTactics), techniques: toArray(this.#xdrTechniques) },
      byCase: Object.fromEntries(
        [...this.#perCase].map(([id, pc]) => [id, { tactics: byAlerts(pc.tactics), xdr: byAlerts(pc.xdr), techniques: byAlerts(pc.techniques) }]),
      ),
      topAlerts: Object.fromEntries(this.#topAlerts),
      pages: { fetched: this.fetched, failed: this.failed },
    }
  }
}

function bump(m: Counter, id: string, name: string) {
  const e = m.get(id) ?? { id, name, alerts: 0 }
  e.alerts++
  m.set(id, e)
}

function track(m: Map<string, Agg>, entry: Omit<Agg, 'caseIds' | 'alertCount'>, caseId: string) {
  let e = m.get(entry.id)
  if (!e) m.set(entry.id, (e = { ...entry, caseIds: new Set(), alertCount: 0 }))
  e.caseIds.add(caseId)
  e.alertCount++
}

/** Sorted by number of Cases, then Alerts. */
function toArray(m: Map<string, Agg>) {
  return [...m.values()]
    .map(({ caseIds, ...rest }) => ({ ...rest, caseCount: caseIds.size }))
    .sort((a, b) => b.caseCount - a.caseCount || b.alertCount - a.alertCount)
}

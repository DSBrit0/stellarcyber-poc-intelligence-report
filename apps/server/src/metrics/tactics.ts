import type { CaseSummary, ReportData } from '@poc-intel/shared'
import { median } from './case-stats.js'

// Classifies Alerts from GET /cases/{id}/alerts (docs[]._source.xdr_event):
//   MITRE ATT&CK  → tactic ids starting with "TA" (techniques T1…/T0…)
//   XDR Kill Chain → Stellar Cyber's own ids, "XTA…" (techniques "XT…")
// Ported from the previous tool's fetchCaseTactics.

export interface AlertSource {
  [field: string]: unknown
  event_score?: unknown
  xdr_event?: {
    description?: unknown
    tactic?: { id?: unknown; name?: unknown }
    technique?: { id?: unknown; name?: unknown }
    /** Every tactic/technique pair of the alert; `tactic`/`technique` hold only the primary one. */
    ttps?: { tactic?: { id?: unknown; name?: unknown }; technique?: { id?: unknown; name?: unknown } }[]
    /** Initial Attempts, Persistent Foothold, Exploration, Propagation, Exfiltration & Impact. */
    xdr_killchain_stage?: unknown
  }
  /** Where the Alert's data came from: `source` (e.g. windows_agent, azure_ad), and for some `vendor`/`product`. */
  msg_origin?: { source?: unknown; vendor?: unknown; product?: unknown; processor?: { id?: unknown } }
  /** The engine that received the data: a Data Sensor id, or "{type}_{name}" for a Connector. */
  engid?: unknown
  engid_name?: unknown
  /** detection_time: ms from the event to the Alert. */
  stellar?: { detection_time?: unknown }
}

const TOP_ALERTS_PER_CASE = 3
const TOP_ENTITIES = 10
const TOP_ENTITIES_PER_CASE = 2
const TOP_ORIGINS = 50
/** Critical/High Cases whose top entities are kept for the threat cards. */
export const ENTITY_CASES_CAP = 300
export const KILL_CHAIN_STAGES = ['Initial Attempts', 'Persistent Foothold', 'Exploration', 'Propagation', 'Exfiltration & Impact']
const s = (v: unknown) => (typeof v === 'string' ? v : '')
/** Nested field by dotted path ("azure_ad.userPrincipalName"). */
const field = (src: Record<string, unknown>, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), src)

const USER_FIELDS = ['srcip_username', 'user.name', 'azure_ad.userPrincipalName']
const HOST_FIELDS = ['srcip_host', 'hostip_host', 'computer_name']
const IP_FIELDS = ['srcip', 'dstip']
const PLACEHOLDERS = new Set(['', '-', 'n/a', 'na', 'null', 'none', 'unknown'])

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
/** A routable public address: not private, loopback, link-local, CGNAT, multicast or reserved. */
export function isPublicIp(ip: string): boolean {
  const m = IPV4.exec(ip)
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])]
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false
    if (a === 100 && b >= 64 && b <= 127) return false
    if (a === 169 && b === 254) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    return true
  }
  if (!ip.includes(':')) return false
  const v6 = ip.toLowerCase()
  return !(v6 === '::' || v6 === '::1' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith('ff') || v6.startsWith('::ffff:'))
}

const isIpLike = (v: string) => IPV4.test(v) || (/^[0-9a-f:]+$/i.test(v) && v.includes(':'))

interface Tally {
  alerts: number
  caseIds: Set<string>
}
const tally = <T extends object>(m: Map<string, T & Tally>, key: string, init: () => T, caseId: string): T & Tally => {
  let e = m.get(key)
  if (!e) m.set(key, (e = { ...init(), alerts: 0, caseIds: new Set<string>() }))
  e.alerts++
  e.caseIds.add(caseId)
  return e
}

type EntityKind = 'users' | 'hosts' | 'externalIps'
type IpAttrs = { country: string | null; reputation: string | null; asnOrg: string | null }
type CaseEntities = Record<EntityKind, Map<string, { value: string; alerts: number }>>

interface Agg {
  id: string
  name: string
  tacticId?: string
  tacticName?: string
  caseIds: Set<string>
  alertCount: number
  /** Techniques only: Alerts per tactic the technique was seen under, to pick its tactic deterministically. */
  byTactic?: Map<string, { name: string; alerts: number }>
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
  /** Alerts the Case still references but the index no longer holds (`found: false`, aged out). */
  missing = 0
  #forbiddenPages = 0
  #readableCases = new Set<string>()
  #forbiddenCases = new Set<string>()
  #alertsRead = 0
  #killChain = new Map<string, { stage: string } & Tally>()
  #sources = new Map<string, { source: string; vendor: string; product: string } & Tally>()
  #engines = new Map<string, { id: string; name: string; processorId: string | null } & Tally>()
  #entities: Record<EntityKind, Map<string, { value: string } & Partial<IpAttrs> & Tally>> = { users: new Map(), hosts: new Map(), externalIps: new Map() }
  #caseEntities = new Map<string, CaseEntities>()
  #latencies: number[] = []

  /**
   * `severities` maps Case id → Severity: per-source Critical/High Case counts and the entities
   * (which only cover Critical and High Cases) need it.
   */
  constructor(private readonly severities: ReadonlyMap<string, CaseSummary['severity']> = new Map()) {}

  /** Alert documents received in a page, including the aged-out ones (`found: false`). */
  read(n: number): void {
    this.#alertsRead += n
  }

  forbid(caseId: string): void {
    this.#forbiddenPages++
    this.#forbiddenCases.add(caseId)
  }

  add(caseId: string, alerts: AlertSource[]): void {
    this.#readableCases.add(caseId)
    for (const src of alerts) {
      this.#keepTopAlert(caseId, src)
      this.#addContext(caseId, src)
      const xdr = src.xdr_event ?? {}
      // An alert counts once per distinct tactic and once per distinct technique it carries.
      const pairs = xdr.ttps?.length ? xdr.ttps : [{ tactic: xdr.tactic, technique: xdr.technique }]
      const seenTactics = new Set<string>()
      const seenTechniques = new Set<string>()
      for (const pair of pairs) {
        const tacticId = s(pair.tactic?.id)
        if (!tacticId) continue
        const tacticName = s(pair.tactic?.name)
        const techniqueId = s(pair.technique?.id)
        const techniqueName = s(pair.technique?.name)
        const isMitre = tacticId.startsWith('TA')

        let pc = this.#perCase.get(caseId)
        if (!pc) this.#perCase.set(caseId, (pc = { tactics: new Map(), xdr: new Map(), techniques: new Map() }))
        if (!seenTactics.has(tacticId)) {
          seenTactics.add(tacticId)
          bump(isMitre ? pc.tactics : pc.xdr, tacticId, tacticName)
          track(isMitre ? this.#mitreTactics : this.#xdrTactics, { id: tacticId, name: tacticName }, caseId)
        }
        if (techniqueId && !seenTechniques.has(techniqueId)) {
          seenTechniques.add(techniqueId)
          if (isMitre) bump(pc.techniques, techniqueId, techniqueName)
          track(isMitre ? this.#mitreTechniques : this.#xdrTechniques, { id: techniqueId, name: techniqueName, tacticId, tacticName }, caseId)
        }
      }
    }
  }

  // Kill Chain stage, data source, engine, detection latency and, for Critical/High Cases, entities.
  #addContext(caseId: string, src: AlertSource) {
    const stage = s(src.xdr_event?.xdr_killchain_stage)
    if (stage) tally(this.#killChain, stage, () => ({ stage }), caseId)
    const origin = src.msg_origin ?? {}
    const [source, vendor, product] = [s(origin.source), s(origin.vendor), s(origin.product)]
    if (source || vendor || product) tally(this.#sources, `${source}\u0000${vendor}\u0000${product}`, () => ({ source, vendor, product }), caseId)
    const engid = s(src.engid)
    if (engid) tally(this.#engines, engid, () => ({ id: engid, name: s(src.engid_name) || engid, processorId: s(origin.processor?.id) || null }), caseId)
    const latency = src.stellar?.detection_time
    if (typeof latency === 'number' && Number.isFinite(latency) && latency >= 0) this.#latencies.push(latency)

    const severity = this.severities.get(caseId)
    if (severity !== 'critical' && severity !== 'high') return
    let pc = this.#caseEntities.get(caseId)
    if (!pc) this.#caseEntities.set(caseId, (pc = { users: new Map(), hosts: new Map(), externalIps: new Map() }))
    const values = (kind: EntityKind, fields: string[], keep: (v: string) => boolean) => {
      // One count per Alert, however many fields carry the same value.
      const seen = new Map<string, string>()
      for (const f of fields) {
        const v = s(field(src, f)).trim()
        if (v && !PLACEHOLDERS.has(v.toLowerCase()) && keep(v) && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v)
      }
      for (const [key, value] of seen) {
        const e = tally<{ value: string } & Partial<IpAttrs>>(this.#entities[kind], key, () => ({ value }), caseId)
        if (kind === 'externalIps' && e.country === undefined) {
          const prefix = IP_FIELDS.find((f) => s(src[f]) === value)!
          e.country = s(field(src, `${prefix}_geo.countryCode`)) || null
          e.reputation = s(src[`${prefix}_reputation`]) || null
          e.asnOrg = s(src[`${prefix}_asn_org`]) || null
        }
        const c = pc[kind].get(key) ?? { value, alerts: 0 }
        c.alerts++
        pc[kind].set(key, c)
      }
    }
    values('users', USER_FIELDS, () => true)
    values('hosts', HOST_FIELDS, (v) => !isIpLike(v))
    values('externalIps', IP_FIELDS, isPublicIp)
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
      pages: { fetched: this.fetched, failed: this.failed, forbidden: this.#forbiddenPages },
      alertsMissing: this.missing,
      casesWithoutAlertAccess: [...this.#forbiddenCases].filter((id) => !this.#readableCases.has(id)).length,
      alertsRead: this.#alertsRead,
      killChain: [...this.#killChain.values()]
        .map(({ stage, alerts, caseIds }) => ({ stage, alerts, cases: caseIds.size }))
        .sort((a, b) => stageOrder(a.stage) - stageOrder(b.stage) || b.alerts - a.alerts),
      sources: this.#withCritHigh(this.#sources).map(({ source, vendor, product, ...n }) => ({ source, vendor, product, ...n })),
      engines: this.#withCritHigh(this.#engines).map(({ id, name, processorId, ...n }) => ({ id, name, processorId, ...n })),
      entities: {
        users: topEntities(this.#entities.users).map(({ value, alerts, cases }) => ({ value, alerts, cases })),
        hosts: topEntities(this.#entities.hosts).map(({ value, alerts, cases }) => ({ value, alerts, cases })),
        externalIps: topEntities(this.#entities.externalIps).map(({ value, alerts, cases, country, reputation, asnOrg }) => ({
          value,
          alerts,
          cases,
          country: country ?? null,
          reputation: reputation ?? null,
          asnOrg: asnOrg ?? null,
        })),
      },
      entitiesByCase: Object.fromEntries(
        [...this.#caseEntities].map(([id, pc]) => {
          const top = (m: Map<string, { value: string; alerts: number }>) =>
            [...m.values()].sort((a, b) => b.alerts - a.alerts || a.value.localeCompare(b.value)).slice(0, TOP_ENTITIES_PER_CASE).map((e) => e.value)
          return [id, { users: top(pc.users), hosts: top(pc.hosts), externalIps: top(pc.externalIps) }]
        }),
      ),
      ...(this.#latencies.length ? { detectionLatency: { medianMs: median(this.#latencies)!, alerts: this.#latencies.length } } : {}),
    }
  }

  #withCritHigh<T extends object>(m: Map<string, T & Tally>) {
    return [...m.values()]
      .sort((a, b) => b.alerts - a.alerts)
      .slice(0, TOP_ORIGINS)
      .map(({ alerts, caseIds, ...rest }) => ({
        ...(rest as unknown as T),
        alerts,
        cases: caseIds.size,
        criticalHighCases: [...caseIds].filter((id) => ['critical', 'high'].includes(this.severities.get(id) ?? '')).length,
      }))
  }
}

const stageOrder = (stage: string) => {
  const i = KILL_CHAIN_STAGES.indexOf(stage)
  return i < 0 ? KILL_CHAIN_STAGES.length : i
}

/** Top entities by Cases, then Alerts. */
function topEntities<T extends { value: string } & Tally>(m: Map<string, T>) {
  return [...m.values()]
    .sort((a, b) => b.caseIds.size - a.caseIds.size || b.alerts - a.alerts || a.value.localeCompare(b.value))
    .slice(0, TOP_ENTITIES)
    .map(({ caseIds, ...rest }) => ({ ...rest, cases: caseIds.size }))
}

/**
 * Keeps the per-Case entities of the Cases most likely to become threat cards: Auto Triage True Positives
 * first, then by Severity, score and Alerts, up to `cap` Cases.
 */
export function rankEntitiesByCase(
  entitiesByCase: NonNullable<ReportData['tactics']['entitiesByCase']>,
  cases: CaseSummary[],
  verdicts: Record<string, string> = {},
  cap = ENTITY_CASES_CAP,
): NonNullable<ReportData['tactics']['entitiesByCase']> {
  const sev = { critical: 0, high: 1, medium: 2, low: 3 }
  const tp = (c: CaseSummary) => (verdicts[c.id] === 'True Positive' ? 0 : 1)
  const ranked = cases
    .filter((c) => entitiesByCase[c.id])
    .sort((a, b) => tp(a) - tp(b) || sev[a.severity] - sev[b.severity] || (b.score ?? -1) - (a.score ?? -1) || b.alerts - a.alerts)
    .slice(0, cap)
  return Object.fromEntries(ranked.map((c) => [c.id, entitiesByCase[c.id]!]))
}

function bump(m: Counter, id: string, name: string) {
  const e = m.get(id) ?? { id, name, alerts: 0 }
  e.alerts++
  m.set(id, e)
}

function track(m: Map<string, Agg>, entry: Omit<Agg, 'caseIds' | 'alertCount' | 'byTactic'>, caseId: string) {
  let e = m.get(entry.id)
  if (!e) m.set(entry.id, (e = { id: entry.id, name: entry.name, caseIds: new Set(), alertCount: 0 }))
  e.caseIds.add(caseId)
  e.alertCount++
  if (entry.tacticId) {
    e.byTactic ??= new Map()
    const t = e.byTactic.get(entry.tacticId) ?? { name: entry.tacticName ?? '', alerts: 0 }
    t.alerts++
    e.byTactic.set(entry.tacticId, t)
  }
}

/**
 * Sorted by number of Cases, then Alerts. A technique seen under several tactics is listed under the one
 * it was seen with most often (tie: the lowest tactic id), so the mapping does not depend on page order.
 */
function toArray(m: Map<string, Agg>) {
  return [...m.values()]
    .map(({ caseIds, byTactic, ...rest }) => {
      const tactic = [...(byTactic ?? [])].sort(([a, x], [b, y]) => y.alerts - x.alerts || a.localeCompare(b))[0]
      return { ...rest, ...(tactic ? { tacticId: tactic[0], tacticName: tactic[1].name } : {}), caseCount: caseIds.size }
    })
    .sort((a, b) => b.caseCount - a.caseCount || b.alertCount - a.alertCount)
}

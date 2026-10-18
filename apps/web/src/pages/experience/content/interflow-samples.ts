import type { StageId } from '@poc-intel/shared'
import captured from './interflow-captured.json' with { type: 'json' }

/**
 * The records the Engine Chamber and the Record Trace show. Network and endpoint come from a real
 * capture, anonymised (interflow-captured.json, ADR 0015) up to detection; what has no real
 * counterpart yet (the Case, triage, response, and the firewall story) stays illustrative, and every
 * step says which it is. The illustrative firewall sample: one raw record per data-source family
 * and what each engine adds to its Interflow on the way to a Case. Field names follow the Interflow
 * fields this tool already reads (msg_class, msg_origin.*, srcip_host, dstip_reputation, xdr_event.*,
 * event_score); values are invented, addresses are RFC 5737 documentation ranges. They are replaced
 * by real, anonymised captures once a model is chosen (ADR 0015).
 */
export type SampleFamily = 'firewall' | 'edr' | 'network'

export type FieldValue = string | number | string[]

export interface TraceStep {
  stage: StageId
  /** From the real, anonymised capture; otherwise an illustration. */
  real?: boolean
  /** The engine at work, as the platform names it. */
  engine: string
  /** What this engine adds to the Interflow record. */
  fields: Record<string, FieldValue>
}

export interface InterflowSample {
  family: SampleFamily
  source: string
  /** The raw log as received; null when the source delivers structured fields (sensor flows, APIs). */
  raw: string | null
  /** Pieces of the raw record and the Interflow field the parser maps each one to. */
  mappings: { raw: string; field: string }[]
  steps: TraceStep[]
  /** The Case the record ends up in. */
  outcome: { caseId: string; score: number; alerts: number; response: { action: 'block_ip' | 'isolate_host' | 'disable_user' | 'reset_password'; target: string } }
}

const firewall: InterflowSample = {
  family: 'firewall',
  source: 'FortiGate',
  raw: '<189>date=2026-10-17 time=14:22:07 devname="FGT-HQ" type="traffic" subtype="forward" srcip=10.20.4.15 srcport=51544 dstip=203.0.113.45 dstport=443 proto=6 action="accept" app="HTTPS.BROWSER" sentbyte=48211 rcvdbyte=3122',
  mappings: [
    { raw: 'srcip=10.20.4.15', field: 'srcip' },
    { raw: 'srcport=51544', field: 'srcport' },
    { raw: 'dstip=203.0.113.45', field: 'dstip' },
    { raw: 'dstport=443', field: 'dstport' },
    { raw: 'proto=6', field: 'proto_name' },
    { raw: 'app="HTTPS.BROWSER"', field: 'appid_name' },
    { raw: 'action="accept"', field: 'action' },
    { raw: 'sentbyte=48211', field: 'outbytes_total' },
  ],
  steps: [
    { stage: 'collection', engine: 'Modular Sensor · Log Forwarder', fields: { 'msg_origin.source': 'fortinet_fortigate', 'msg_origin.category': 'firewall', 'msg_origin.processor.id': 'sensor-hq-01' } },
    {
      stage: 'normalization',
      engine: 'Parser → Interflow',
      fields: { msg_class: 'traffic', srcip: '10.20.4.15', srcport: 51544, dstip: '203.0.113.45', dstport: 443, proto_name: 'tcp', appid_name: 'https', action: 'accept', outbytes_total: 48211 },
    },
    { stage: 'threat_intel', engine: 'Threat Intelligence Platform', fields: { dstip_reputation: 'Malicious', 'threat.feed': 'commercial-c2', 'threat.confidence': 90 } },
    { stage: 'enrichment', engine: 'Asset & User Enrichment', fields: { srcip_host: 'WS-FIN-042', srcip_username: 'maria.souza', dstip_geo: 'NL', dstip_asn_org: 'Example Hosting BV', 'asset.criticality': 'high' } },
    { stage: 'detection', engine: 'Supervised ML + rules', fields: { 'xdr_event.name': 'Outbound connection to malicious IP', 'xdr_event.ttps': ['T1071.001'], event_score: 78 } },
    { stage: 'correlation', engine: 'Graph ML', fields: { 'case.id': 'CASE-1042', 'case.alerts': 4, 'case.score': 92 } },
    { stage: 'agentic_soc', engine: 'Agentic Auto Triage', fields: { 'triage.verdict': 'True Positive', 'triage.reason': 'C2 beacon from a finance workstation after a phishing click' } },
    { stage: 'response', engine: 'Automated Response', fields: { 'response.action': 'block_ip', 'response.target': 'FortiGate FGT-HQ', 'response.status': 'done' } },
  ],
  outcome: { caseId: 'CASE-1042', score: 92, alerts: 4, response: { action: 'block_ip', target: '203.0.113.45 · FortiGate FGT-HQ' } },
}

type Captured = Record<string, string | number | boolean | string[]>
const pick = (record: Captured, keys: string[]): Record<string, FieldValue> =>
  Object.fromEntries(keys.filter((k) => record[k] !== undefined).map((k) => [k, record[k] as FieldValue]))

// Endpoint: a real Cylance Optics detection (keylogging behaviour, ATT&CK T1056).
const ep = captured.edr.interflow as Captured
const edr: InterflowSample = {
  family: 'edr',
  source: captured.edr.source,
  raw: captured.edr.raw,
  mappings: [
    { raw: String(ep['process.name']), field: 'process.name' },
    { raw: 'Explorer.EXE', field: 'process.parent.name' },
  ],
  steps: [
    { stage: 'collection', engine: 'Log Forwarder', real: true, fields: pick(ep, ['msg_origin.source', 'msg_origin.category', 'msg_origin.processor.type']) },
    { stage: 'normalization', engine: 'Parser → Interflow', real: true, fields: pick(ep, ['msg_class', 'host.name', 'process.name', 'process.parent.name', 'event.name', 'event.type']) },
    { stage: 'enrichment', engine: 'Asset & User Enrichment', fields: { 'asset.criticality': 'high', 'user.department': 'Finance' } },
    { stage: 'detection', engine: 'Cylance Optics + Stellar Cyber', real: true, fields: pick(ep, ['event.description', 'event.severity', 'cylance.severity', 'cylance.detection_rule_description']) },
    { stage: 'correlation', engine: 'Graph ML', fields: { 'case.id': 'CASE-1042', 'case.alerts': 3, 'case.score': 88 } },
    { stage: 'agentic_soc', engine: 'Agentic Auto Triage', fields: { 'triage.verdict': 'True Positive', 'triage.reason': 'Input capture by a process launched from Explorer on a finance workstation' } },
    { stage: 'response', engine: 'Automated Response', fields: { 'response.action': 'isolate_host', 'response.target': `${String(ep['host.name'])} · BlackBerry Cylance`, 'response.status': 'done' } },
  ],
  outcome: { caseId: 'CASE-1042', score: 88, alerts: 3, response: { action: 'isolate_host', target: `${String(ep['host.name'])} · BlackBerry Cylance` } },
}

// Network: a real Modular Sensor flow and the real alert raised on it (plain-text password, lateral).
const na = captured.network.alert as Captured
const network: InterflowSample = {
  family: 'network',
  source: captured.network.source,
  raw: null,
  mappings: [],
  steps: [
    { stage: 'collection', engine: 'Modular Sensor · DPI', real: true, fields: pick(na, ['msg_origin.source', 'msg_origin.category', 'msg_origin.processor.type']) },
    {
      stage: 'normalization',
      engine: 'DPI → Interflow',
      real: true,
      fields: pick(na, ['msg_class', 'srcip', 'srcport', 'dstip', 'dstport', 'proto_name', 'appid_name', 'appid_family', 'inbytes_total', 'outbytes_total', 'duration']),
    },
    { stage: 'enrichment', engine: 'Asset & Reputation Enrichment', real: true, fields: pick(na, ['srcip_host', 'dstip_host', 'srcip_type', 'dstip_type', 'srcip_reputation', 'dstip_reputation']) },
    { stage: 'ndr', engine: 'NDR', real: true, fields: pick(na, ['lateral', 'flow_score', 'fidelity', 'event_category', 'event_type']) },
    {
      stage: 'detection',
      engine: 'XDR detection',
      real: true,
      fields: pick(na, ['xdr_event.display_name', 'xdr_event.tactic.id', 'xdr_event.tactic.name', 'xdr_event.technique.id', 'xdr_event.technique.name', 'xdr_event.xdr_killchain_stage', 'event_score', 'severity']),
    },
    { stage: 'correlation', engine: 'Graph ML', fields: { 'case.id': 'CASE-1043', 'case.alerts': 2, 'case.score': 74 } },
    { stage: 'agentic_soc', engine: 'AI Investigator', fields: { 'triage.verdict': 'True Positive', 'triage.reason': 'Database credentials sent in clear text between internal hosts' } },
    { stage: 'response', engine: 'Automated Response', fields: { 'response.action': 'reset_password', 'response.target': 'Database service account', 'response.status': 'done' } },
  ],
  outcome: { caseId: 'CASE-1043', score: 74, alerts: 2, response: { action: 'reset_password', target: 'Database service account' } },
}

export const SAMPLES: Record<SampleFamily, InterflowSample> = { firewall, edr, network }

/** The sample family of a Data Source, by its name. Real captures map by catalog category (ADR 0015). */
export function familyOf(source: string): SampleFamily {
  const s = source.toLowerCase()
  if (/(crowdstrike|sentinel ?one|defender|carbon ?black|cortex|edr|endpoint|any edr)/.test(s)) return 'edr'
  if (/(span|tap|network|ndr|traffic|netflow|ipfix|sflow|zeek)/.test(s)) return 'network'
  return 'firewall'
}

/** The fields a record has after the engines up to (and including) a given step. */
export function fieldsUpTo(sample: InterflowSample, stepIndex: number): { key: string; value: FieldValue; step: number }[] {
  const out = new Map<string, { value: FieldValue; step: number }>()
  sample.steps.slice(0, stepIndex + 1).forEach((st, i) => {
    for (const [k, v] of Object.entries(st.fields)) out.set(k, { value: v, step: i })
  })
  return [...out].map(([key, v]) => ({ key, ...v }))
}

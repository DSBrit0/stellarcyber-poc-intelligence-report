// Captures one real Interflow record per data-source family for the Stellar Experience and
// anonymises it (ADR 0015). Dev tool, read-only against the Instance:
//   STELLAR_URL=https://x.stellarcyber.cloud STELLAR_API_KEY=… npx tsx src/cli/capture-interflow.ts <out.json>
// The credential comes from the environment only and is never written anywhere. Review the output
// before it replaces apps/web/src/pages/experience/content/interflow-captured.json.
//
// The Data Lake answers GET /connect/api/data/<index>/_search with URI parameters only (q, size,
// sort): a request body is refused ("Invalid query structure"), POST is refused, and the request
// needs Content-Type: application/json (HTTP 406 without it).
import { writeFileSync } from 'node:fs'
import { EnvHttpProxyAgent, request, type Dispatcher } from 'undici'
import { createSafeAgent } from '../stellar/safe-agent.js'

const { STELLAR_URL, STELLAR_API_KEY } = process.env
const out = process.argv[2]
if (!STELLAR_URL || !STELLAR_API_KEY || !out) {
  console.error('usage: STELLAR_URL=… STELLAR_API_KEY=… capture-interflow.ts <out.json>')
  process.exit(2)
}
const dispatcher: Dispatcher = process.env.HTTPS_PROXY || process.env.https_proxy ? new EnvHttpProxyAgent() : createSafeAgent([])
const tokRes = await request(new URL('/connect/api/v1/access_token', STELLAR_URL), { method: 'POST', headers: { authorization: `Bearer ${STELLAR_API_KEY}` }, dispatcher })
if (tokRes.statusCode !== 200) throw new Error(`access_token: HTTP ${tokRes.statusCode}`)
const token = ((await tokRes.body.json()) as { access_token: string }).access_token

async function latest(index: string, q: string): Promise<Record<string, unknown> | null> {
  const url = new URL(`/connect/api/data/${index}/_search`, STELLAR_URL)
  url.search = new URLSearchParams({ q, size: '1', sort: 'timestamp:desc' }).toString()
  const r = await request(url, { method: 'GET', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, dispatcher })
  const text = await r.body.text()
  if (r.statusCode !== 200) throw new Error(`${index} ${q}: HTTP ${r.statusCode}`)
  return (JSON.parse(text)?.hits?.hits?.[0]?._source as Record<string, unknown>) ?? null
}

// ---- anonymisation -------------------------------------------------------------------------

const flat = (o: unknown, pre = ''): [string, unknown][] =>
  Object.entries((o as Record<string, unknown>) ?? {}).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${pre}${k}.`) : [[`${pre}${k}`, v] as [string, unknown]]))

/** Only these Interflow fields leave the Instance; anything else is dropped. */
const KEEP = new Set([
  'msg_class', 'msg_origin.source', 'msg_origin.category', 'msg_origin.processor.type', 'msgtype_name', 'action',
  'appid_name', 'appid_family', 'proto_name', 'srcip', 'srcport', 'dstip', 'dstport', 'srcip_host', 'dstip_host', 'srcip_type', 'dstip_type',
  'srcip_reputation', 'dstip_reputation', 'totalbytes', 'totalpackets', 'inbytes_total', 'outbytes_total',
  'duration', 'state', 'threat_score', 'flow_score', 'event.name', 'event.type', 'event.severity', 'event.description', 'process.name', 'process.parent.name',
  'host.name', 'computer_name', 'cylance.event_name', 'cylance.event_type', 'cylance.severity', 'cylance.detection_rule_description',
  'cylance.instigating_process_name', 'cylance.target_process_name', 'palo_alto_networks.type', 'palo_alto_networks.subtype',
  'crowdstrike.event.Action', 'crowdstrike.event.Category', 'crowdstrike.event.ActorType', 'crowdstrike.metadata.eventType', 'crowdstrike.event.GeoCountry',
  'xdr_event.name', 'xdr_event.display_name', 'xdr_event.description', 'xdr_event.tactic.id', 'xdr_event.tactic.name', 'xdr_event.technique.id',
  'xdr_event.technique.name', 'xdr_event.xdr_killchain_stage', 'event_score', 'severity', 'fidelity', 'event_category', 'event_type', 'event_source', 'lateral',
])
/** Fields whose values identify the customer: replaced wherever they appear, including in the raw log. */
const HOST_FIELDS = ['srcip_host', 'dstip_host', 'host.name', 'computer_name', 'cylance.device_name', 'device.name', 'palo_alto_networks.device_name', 'log.syslog.hostname']
const SECRET_FIELDS = [
  'tenant_name', 'org_name', 'tenantid', 'org_id', 'host.id', 'cylance.device_id', 'cylance.tenant_name', 'cylance.zone_names', 'palo_alto_networks.serial_number',
  'process.owner', 'process.parent.owner', 'cylance.instigating_process_owner', 'cylance.target_process_owner', 'cylance.instigating_process_imagefilesha256',
  'crowdstrike.event.ActorID', 'crowdstrike.event.ActorIP', 'crowdstrike.event.Extensions.cid', 'crowdstrike.event.Extensions.APIClientID',
  'crowdstrike.event.Extensions.trace_id', 'crowdstrike.event.TraceID', 'crowdstrike.metadata.customerIDString', 'crowdstrike.event.Extensions.user_ip',
  'engid', 'engid_name', 'engid_gateway', 'stellar_uuid', 'stellar_client_addr',
]

const counters = new Map<string, number>()
const memo = new Map<string, string>()
const fake = (kind: string, original: string, make: (n: number) => string) => {
  const key = `${kind}:${original}`
  if (!memo.has(key)) {
    const n = (counters.get(kind) ?? 0) + 1
    counters.set(kind, n)
    memo.set(key, make(n))
  }
  return memo.get(key)!
}
const isPrivate = (ip: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.)/.test(ip)
const fakeIp = (ip: string) => (isPrivate(ip) ? fake('ip-private', ip, (n) => `10.20.${4 + Math.floor(n / 200)}.${(n % 200) + 15}`) : fake('ip-public', ip, (n) => (n <= 120 ? `203.0.113.${n + 10}` : `198.51.100.${n - 110}`)))
const hex = (n: number, len: number) => (n * 2654435761).toString(16).padStart(8, '0').repeat(Math.ceil(len / 8)).slice(0, len)

/** Values that must never appear in the output, mapped to their replacements. */
const replacements = new Map<string, string>()

function remember(record: Record<string, unknown>) {
  const fields = new Map(flat(record))
  for (const f of HOST_FIELDS) {
    const v = fields.get(f)
    // A host field holding an address is an address: the IP rule handles it.
    if (typeof v === 'string' && v.length > 2 && !/^[\d.:]+$/.test(v)) replacements.set(v, fake('host', v, (n) => (f.startsWith('dst') ? `SRV-${String(n).padStart(2, '0')}` : `WS-${String(n).padStart(3, '0')}`)))
  }
  for (const f of SECRET_FIELDS) {
    const v = fields.get(f)
    // Short values ("modular", "prod") would be replaced inside harmless words: only distinctive ones count.
    for (const s of Array.isArray(v) ? v : [v]) if (typeof s === 'string' && s.length >= 8) replacements.set(s, fake('secret', s, (n) => `REDACTED-${n}`))
  }
}

function scrub(text: string): string {
  let s = text
  // Accounts, before anything else rewrites their parts: DOMAIN\\user, profile paths, key=value users.
  // An account starts a token (after a space, quote, bracket or comma) and is not followed by another path segment.
  s = s.replace(/(^|[\s"(,])([A-Za-z0-9][A-Za-z0-9.-]{1,30})\\{1,2}([A-Za-z0-9._$-]{2,64})(?![\\\w.])/g, (m, lead: string, dom: string, user: string) =>
    /^(windows|system32|program files|users|device|harddiskvolume\d*|nt authority|window manager|font driver host)$/i.test(dom) || /\.\w{2,4}$/.test(user) ? m : `${lead}CORP\\${fake('user', user, (n) => `user${n}`)}`,
  )
  s = s.replace(/([A-Za-z]:\\{1,2}Users\\{1,2})([^\\"]+)/gi, (_m, pre: string, name: string) => `${pre}${/^(public|default)$/i.test(name) ? name : fake('user', name, (n) => `user${n}`)}`)
  s = s.replace(/\b((?:src_|dst_|s|d)?user(?:name)?)=("?)([^\s",;]+)/gi, (_m, k: string, q: string, u: string) => `${k}=${q}${fake('user', u, (n) => `user${n}`)}`)
  // Longest first, so a host name inside a longer value is not half-replaced.
  for (const [from, to] of [...replacements].sort((a, b) => b[0].length - a[0].length)) s = s.split(from).join(to)
  s = s.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, (ip) => fakeIp(ip))
  s = s.replace(/\b[0-9a-f]{1,4}(?::[0-9a-f]{0,4}){2,7}\b/gi, (v6) => (v6.includes('::') || v6.split(':').length > 5 ? fake('ip6', v6, (n) => `2001:db8::${n.toString(16)}`) : v6))
  s = s.replace(/\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b/gi, (mac) => fake('mac', mac, (n) => `00:00:5e:00:53:${n.toString(16).padStart(2, '0')}`))
  s = s.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, (m) => fake('email', m, (n) => `user${n}@example.com`))
  s = s.replace(/\b[0-9a-f]{64}\b/gi, (h) => fake('sha256', h, (n) => hex(n, 64)))
  s = s.replace(/\b[0-9a-f]{40}\b/gi, (h) => fake('sha1', h, (n) => hex(n, 40)))
  s = s.replace(/\b[0-9a-f]{32}\b/gi, (h) => fake('md5', h, (n) => hex(n, 32)))
  s = s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, (u) => fake('uuid', u, (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`))
  // Fully qualified names: kept only for well-known public vendors, otherwise example.com.
  s = s.replace(/\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|local|lan|corp|internal|br|cloud|ai)\b/gi, (d) =>
    /(^|\.)(microsoft|windows|google|crowdstrike|paloaltonetworks|cylance|blackberry|amazonaws|example)\.(com|net)$/i.test(d) ? d : fake('domain', d, (n) => `host${n}.example.com`),
  )
  return s
}

/** Categorical fields name the platform's own vocabulary (classes, sources, ATT&CK ids): never rewritten. */
const CATEGORICAL = /^(msg_class|msg_origin\.|msgtype_name|action|appid_|proto_name|state|.*_type$|.*_reputation$|xdr_event\.(name|tactic|technique|xdr_killchain)|event_(category|type|source)|palo_alto_networks\.(type|subtype)|crowdstrike\.(event\.(Action|Category|ActorType)|metadata\.eventType)|cylance\.(event_|severity))/

function interflow(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of flat(record)) {
    if (!KEEP.has(k) || v == null || v === '') continue
    const clean = (x: unknown) => (typeof x === 'string' && !CATEGORICAL.test(k) ? scrub(x) : x)
    out[k] = Array.isArray(v) ? v.map(clean) : clean(v)
  }
  return out
}

// ---- capture --------------------------------------------------------------------------------

const wanted: { family: 'firewall' | 'edr' | 'network'; label: string; index: string; q: string; alert?: { index: string; q: string } }[] = [
  { family: 'firewall', label: 'WatchGuard Firebox', index: 'aella-adr-*', q: 'msg_origin.source:watchguard_fw' },
  { family: 'edr', label: 'BlackBerry Cylance Optics', index: 'aella-syslog-*', q: 'msg_origin.source:cylance_optics' },
  { family: 'network', label: 'Modular Sensor (network traffic)', index: 'aella-adr-*', q: 'msg_origin.source:modular_sensor', alert: { index: 'aella-ser-*', q: 'msg_class:interflow_traffic' } },
]

const result: Record<string, unknown> = { capturedOn: new Date().toISOString().slice(0, 10), note: 'Real Interflow, anonymised (ADR 0015). Regenerate with apps/server/src/cli/capture-interflow.ts.' }
for (const w of wanted) {
  const rec = await latest(w.index, w.q)
  if (!rec) {
    console.log(`${w.family}: nothing found for ${w.q}`)
    continue
  }
  const alert = w.alert ? await latest(w.alert.index, w.alert.q) : null
  remember(rec)
  if (alert) remember(alert)
  const rawValue = rec.msg_data ?? rec.message
  // Structured raw logs (a list of name/value pairs) keep only fields that describe the activity.
  const RAW_KEEP = /^(target process (command line|file path)|instigating process (command line|file path)|detection rule description|event (name|type)|severity)$/i
  const raw =
    typeof rawValue === 'string'
      ? scrub(rawValue)
      : Array.isArray(rawValue)
        ? ((kept) => (kept.length ? scrub(JSON.stringify(kept)) : null))(rawValue.filter((x: { name?: string }) => typeof x?.name === 'string' && RAW_KEEP.test(x.name)))
        : null
  result[w.family] = { source: w.label, raw, interflow: interflow(rec), alert: alert ? interflow(alert) : null }
  console.log(`${w.family}: captured (${Object.keys(interflow(rec)).length} fields${raw ? ', raw log' : ''}${alert ? ', alert' : ''})`)
}
writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`)
// Prove nothing identifying survived: every original value we replaced must be absent.
const written = JSON.stringify(result)
const leaks = [...replacements.keys()].filter((v) => written.includes(v))
console.log(leaks.length ? `LEAK CHECK FAILED: ${leaks.length} original values remain` : 'leak check: no replaced value remains')
await dispatcher.close()

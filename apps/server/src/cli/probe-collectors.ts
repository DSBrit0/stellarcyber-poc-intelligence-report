// Runs the Sync collectors against a live Instance without a database, printing a summary. Dev tool:
//   STELLAR_URL=https://x.stellarcyber.cloud STELLAR_API_KEY=… STELLAR_TENANT=<cust_id> [POC_DAYS=30] \
//     npx tsx src/cli/probe-collectors.ts
// The credential comes from the environment only and is never written anywhere.
import { StellarClient } from '../stellar/client.js'
import { alertPageCount, collectCases, collectIngestion, collectTactics } from '../stellar/case-collectors.js'
import { collectCaseCounts, type CollectContext } from '../stellar/collectors.js'
import { EnvHttpProxyAgent, type Dispatcher } from 'undici'
import { createSafeAgent } from '../stellar/safe-agent.js'

const { STELLAR_URL, STELLAR_API_KEY, STELLAR_TENANT } = process.env
if (!STELLAR_URL || !STELLAR_API_KEY || !STELLAR_TENANT) {
  console.error('STELLAR_URL, STELLAR_API_KEY and STELLAR_TENANT are required')
  process.exit(2)
}
const days = Number(process.env.POC_DAYS ?? 30)
const iso = (offsetDays: number) => new Date(Date.now() - offsetDays * 86_400_000).toISOString().slice(0, 10)

// Behind an HTTP(S)_PROXY (dev sandboxes) the proxy resolves the host, so the SSRF guard cannot apply there.
const dispatcher: Dispatcher = process.env.HTTPS_PROXY || process.env.https_proxy ? new EnvHttpProxyAgent() : createSafeAgent([])
const client = new StellarClient(STELLAR_URL, { method: 'apiKey', apiKey: STELLAR_API_KEY }, dispatcher)
const ctx: CollectContext = { client, tenantId: STELLAR_TENANT, period: { start: iso(days), end: iso(1) } }
const time = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  const t = Date.now()
  const r = await fn()
  console.log(`${label.padEnd(12)} ${((Date.now() - t) / 1000).toFixed(1)} s`)
  return r
}

await client.authenticate()
console.log(`tenant ${STELLAR_TENANT}  period ${ctx.period.start} → ${ctx.period.end}\n`)
const [counts, cases, ingestion] = await Promise.all([
  time('caseCounts', () => collectCaseCounts(ctx)),
  time('cases', () => collectCases(ctx)),
  time('ingestion', () => collectIngestion(ctx)),
])
const pages = alertPageCount(cases.keyCases)
const tactics = await time(`tactics(${pages}p)`, () => collectTactics(ctx, cases.keyCases))

console.log('\ncounts     ', JSON.stringify(counts))
console.log('cases      ', cases.cases.length, 'of', cases.total)
console.log('keyCases   ', cases.keyCases.length, 'first:', JSON.stringify(cases.keyCases[0]))
console.log('pages      ', JSON.stringify(tactics.pages))
console.log('MITRE      ', tactics.mitre.tactics.slice(0, 6).map((t) => `${t.id} ${t.name} (${t.caseCount}c/${t.alertCount}a)`).join(' | '))
console.log('MITRE tech ', tactics.mitre.techniques.length, tactics.mitre.techniques.slice(0, 3).map((t) => `${t.id} ${t.name}`).join(' | '))
console.log('XDR        ', tactics.xdr.tactics.slice(0, 6).map((t) => `${t.id} ${t.name} (${t.caseCount}c/${t.alertCount}a)`).join(' | '))
const firstKey = cases.keyCases[0]?.id ?? ''
console.log('topAlerts  ', JSON.stringify(tactics.topAlerts[firstKey]))
console.log('byCase     ', JSON.stringify(tactics.byCase[firstKey]))
console.log('ingestion  ', `${ingestion.bySensor.length} sensors, ${ingestion.byConnector.length} connectors`, JSON.stringify(ingestion.bySensor[0]), JSON.stringify(ingestion.byConnector[0]))
await dispatcher.close()

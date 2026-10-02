// Renders every Template from live (or cached) Report Data, for visual review. Dev tool:
//   STELLAR_URL=… STELLAR_API_KEY=… STELLAR_TENANT=<cust_id> OUT_DIR=./out [POC_DAYS=30] [LOCALES=pt-BR,en] [PDF=1] \
//     npx tsx src/cli/render-sample.ts
// The collected Report Data is cached in OUT_DIR/report-data.json; delete it to collect again.
import { LOCALES, PocDetails, ReportData, TEMPLATES, type Locale } from '@poc-intel/shared'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { EnvHttpProxyAgent, type Dispatcher } from 'undici'
import { renderReportHtml } from '../report/render-html.js'
import { StellarClient } from '../stellar/client.js'
import { createSafeAgent } from '../stellar/safe-agent.js'
import { listTenants } from '../stellar/tenants.js'
import { collectReportData } from '../syncs/collect-report-data.js'

const out = process.env.OUT_DIR ?? './out'
await mkdir(out, { recursive: true })
const cache = join(out, 'report-data.json')

let data: ReportData
if (existsSync(cache)) {
  data = ReportData.parse(JSON.parse(await readFile(cache, 'utf8')))
} else {
  const { STELLAR_URL, STELLAR_API_KEY, STELLAR_TENANT } = process.env
  if (!STELLAR_URL || !STELLAR_API_KEY || !STELLAR_TENANT) throw new Error('STELLAR_URL, STELLAR_API_KEY and STELLAR_TENANT are required')
  const dispatcher: Dispatcher = process.env.HTTPS_PROXY ? new EnvHttpProxyAgent() : createSafeAgent([])
  const client = new StellarClient(STELLAR_URL, { method: 'apiKey', apiKey: STELLAR_API_KEY }, dispatcher)
  await client.authenticate()
  const tenant = (await listTenants(client)).find((x) => x.id === STELLAR_TENANT)
  const days = Number(process.env.POC_DAYS ?? 30)
  const iso = (o: number) => new Date(Date.now() - o * 86_400_000).toISOString().slice(0, 10)
  data = await collectReportData(
    client,
    { instanceUrl: new URL(STELLAR_URL).origin, tenant: { id: STELLAR_TENANT, name: tenant?.name ?? STELLAR_TENANT }, period: { start: iso(days), end: iso(1) } },
    { log: { warn: (o) => console.warn(o) }, onProgress: () => {} },
  )
  await writeFile(cache, JSON.stringify(data))
  await dispatcher.close()
}

const details = PocDetails.parse({
  customerName: data.tenant.name,
  department: 'Security Operations',
  customerEmail: 'soc@example.com',
  analysts: ['Ana Silva', 'Bruno Costa'],
  successCriteria: 'Detect lateral movement; Reduce alert noise by 80%; Integrate EDR and cloud sources',
  salesEngineer: { name: 'Davidson Brito', email: 'se@stellarcyber.ai', phone: '' },
  partner: { name: 'Partner Co.', email: 'partner@example.com', site: 'partner.example.com' },
  platformVersion: '6.6.0',
  region: 'LATAM',
  verdict: 'conditional',
  comments: 'Sample comments for visual review.',
})
const locales = (process.env.LOCALES?.split(',') as Locale[] | undefined) ?? [...LOCALES]
const files: string[] = []
for (const template of TEMPLATES)
  for (const locale of locales) {
    const file = join(out, `${template}-${locale}.html`)
    await writeFile(file, renderReportHtml(data, details, template, locale))
    files.push(file)
  }
console.log(files.join('\n'))

if (process.env.PDF) {
  const { renderPdf } = await import('../report/pdf.js')
  for (const f of files.filter((x) => x.includes(locales[0]!))) {
    await renderPdf(await readFile(f, 'utf8'), f.replace(/\.html$/, '.pdf'))
    console.log(f.replace(/\.html$/, '.pdf'))
  }
  const { closeBrowser } = await import('../report/pdf.js')
  await closeBrowser()
}

// Runs the full Sync collection (same code as production, without a database) for every Tenant of
// one or more Instances, renders every Template in every language, and reports anomalies. Dev tool:
//   INSTANCES="https://a.stellarcyber.cloud|<api key>,https://b.stellarcyber.cloud|<api key>" \
//     [POC_DAYS=30] [OUT=results.json] [TENANT_CONCURRENCY=2] npx tsx src/cli/validate-instances.ts
// Credentials come from the environment only and are never written anywhere; OUT holds results only.
import { LOCALES, TEMPLATES, type ReportData } from '@poc-intel/shared'
import { writeFile } from 'node:fs/promises'
import { EnvHttpProxyAgent, type Dispatcher } from 'undici'
import { runPool } from '../lib/pool.js'
import { PAGING } from '../stellar/endpoints.js'
import { MEDIUM_ANALYSED } from '../metrics/case-stats.js'
import { renderReportHtml } from '../report/render-html.js'
import { StellarClient } from '../stellar/client.js'
import { createSafeAgent } from '../stellar/safe-agent.js'
import { listTenants } from '../stellar/tenants.js'
import type { SyncMetrics } from '../stellar/request-stats.js'
import { collectReportData } from '../syncs/collect-report-data.js'
import { PocDetails } from '@poc-intel/shared'

const instances = (process.env.INSTANCES ?? '')
  .split(',')
  .filter(Boolean)
  .map((pair) => {
    const [url, key] = pair.split('|')
    return { url: new URL(url!).origin, key: key! }
  })
if (instances.length === 0) {
  console.error('INSTANCES is required')
  process.exit(2)
}
const days = Number(process.env.POC_DAYS ?? 30)
const tenantConcurrency = Number(process.env.TENANT_CONCURRENCY ?? 2)
const iso = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10)
const period = { start: iso(days), end: iso(1) }
const dispatcher: Dispatcher = process.env.HTTPS_PROXY || process.env.https_proxy ? new EnvHttpProxyAgent() : createSafeAgent([])
const details = PocDetails.parse({ customerName: 'Validation', verdict: 'conditional', comments: 'Automated validation run' })

interface Row {
  instance: string
  tenant: string
  tenantId: string
  seconds: number
  status: 'ok' | 'failed'
  error?: string
  summary?: Record<string, unknown>
  metrics?: SyncMetrics
  anomalies: string[]
}

/** Cross-checks between collectors: each finding is something a Report would show wrong or empty. */
function anomalies(d: ReportData): string[] {
  const out: string[] = []
  for (const g of d.gaps) out.push(`gap:${g.collector}:${g.reason}`)
  const sev = d.cases.bySeverity
  if (d.caseStats && d.caseStats.cases < d.caseStats.total) out.push(`cases-capped:${d.caseStats.cases}/${d.caseStats.total}`)
  if (d.caseStats && d.caseStats.total !== d.cases.total) out.push(`case-total-mismatch:stats=${d.caseStats.total},counts=${d.cases.total}`)
  if (!d.caseStats && d.cases.total > 0) out.push('case-stats-missing')
  const expectedKey = sev.critical + sev.high + Math.min(sev.medium, MEDIUM_ANALYSED)
  if (d.caseStats && d.caseStats.cases === d.caseStats.total && d.keyCases.length !== expectedKey) {
    out.push(`key-cases:${d.keyCases.length}!=${expectedKey}`)
  }
  const totalPages = d.tactics.pages.fetched + d.tactics.pages.failed + d.tactics.pages.forbidden
  if (d.tactics.pages.failed > 0) out.push(`alert-pages-failed:${d.tactics.pages.failed}/${totalPages}`)
  if (d.tactics.pages.forbidden > 0) out.push(`alert-pages-forbidden:${d.tactics.pages.forbidden}/${totalPages} cases-without-access:${d.tactics.casesWithoutAlertAccess}`)
  if (d.keyCases.length > 0 && d.tactics.mitre.tactics.length + d.tactics.xdr.tactics.length === 0) out.push('no-tactics-for-key-cases')
  const noTopAlerts = d.keyCases.filter((c) => c.severity === 'critical' && !d.tactics.topAlerts[c.id]?.length).length - d.tactics.casesWithoutAlertAccess
  if (noTopAlerts) out.push(`critical-without-top-alerts:${noTopAlerts}`)
  if (d.keyCases.some((c) => c.createdAt == null)) out.push('case-without-created_at')
  if (d.keyCases.some((c) => !c.name)) out.push('case-without-name')
  const unknownTactics = [...d.tactics.mitre.tactics, ...d.tactics.xdr.tactics].filter((t) => !t.name).map((t) => t.id)
  if (unknownTactics.length) out.push(`tactic-without-name:${unknownTactics.join('/')}`)
  const removedSensors = d.ingestion.bySensor.filter((s) => !s.known).length
  if (removedSensors) out.push(`info:ingestion-from-removed-sensors:${removedSensors}/${d.ingestion.bySensor.length}`)
  const removedConnectors = d.ingestion.byConnector.filter((c) => !c.known).length
  if (removedConnectors) out.push(`info:ingestion-from-removed-connectors:${removedConnectors}/${d.ingestion.byConnector.length}`)
  const periodDays = (Date.parse(d.period.end) - Date.parse(d.period.start)) / 86_400_000 + 1
  if (d.assets.daily.length && d.assets.daily.length !== periodDays) out.push(`asset-days:${d.assets.daily.length}/${periodDays}`)
  if (d.volume.dailyGb.length && d.volume.dailyGb.length !== periodDays) out.push(`volume-days:${d.volume.dailyGb.length}/${periodDays}`)
  if (d.dataSensors.some((s) => !s.version)) out.push('sensor-without-version')
  const json = JSON.stringify({ ...d, connectors: d.connectors.map(({ healthCode: _h, ...c }) => c) })
  if (/NaN|Infinity/.test(json) || /:-\d/.test(json.replace(/"[^"]*"/g, '""'))) out.push('non-finite-or-negative-number')
  return out
}

const rows: Row[] = []
const started = Date.now()

for (const inst of instances) {
  const client = new StellarClient(inst.url, { method: 'apiKey', apiKey: inst.key }, dispatcher)
  const host = new URL(inst.url).host
  try {
    await client.authenticate()
  } catch (err) {
    rows.push({ instance: host, tenant: '-', tenantId: '-', seconds: 0, status: 'failed', error: `auth: ${(err as Error).message}`, anomalies: [] })
    continue
  }
  const only = (process.env.TENANTS ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)
  const tenants = (await listTenants(client)).filter((t) => !only.length || only.includes(t.name.toLowerCase()) || only.includes(t.id))
  console.log(`\n== ${host}: ${tenants.length} tenants, period ${period.start} → ${period.end}`)

  await runPool(tenants, tenantConcurrency, async (tenant) => {
    const t0 = Date.now()
    const row: Row = { instance: host, tenant: tenant.name, tenantId: tenant.id, seconds: 0, status: 'ok', anomalies: [] }
    try {
      const data = await collectReportData(
        client,
        { instanceUrl: inst.url, tenant: { id: tenant.id, name: tenant.name }, period },
        { log: { warn: (o) => row.anomalies.push(`warn:${JSON.stringify(o).slice(0, 160)}`) }, onProgress: () => {}, onMetrics: (m) => (row.metrics = m) },
      )
      for (const template of TEMPLATES)
        for (const locale of LOCALES) {
          try {
            renderReportHtml(data, details, template, locale)
          } catch (err) {
            row.anomalies.push(`render:${template}/${locale}:${(err as Error).message.slice(0, 80)}`)
          }
        }
      row.anomalies.push(...anomalies(data))
      row.summary = {
        cases: data.cases.bySeverity,
        alerts: data.caseStats?.alerts ?? 0,
        keyCases: data.keyCases.length,
        alertPages: data.tactics.pages,
        mitreTactics: data.tactics.mitre.tactics.length,
        xdrTactics: data.tactics.xdr.tactics.length,
        assetsAvg: data.assets.compliance.stats?.avg ?? null,
        assetsRecommended: data.assets.compliance.recommended,
        gbAvg: data.volume.compliance.stats ? Number(data.volume.compliance.stats.avg.toFixed(3)) : null,
        connectors: data.connectors.length,
        sensors: data.dataSensors.length,
        medianCloseHours: data.caseStats?.medianCloseHours ?? null,
        medianAckMinutes: data.caseStats?.medianAckMinutes ?? null,
      }
    } catch (err) {
      row.status = 'failed'
      row.error = `${(err as { code?: string }).code ?? 'error'}: ${(err as Error).message}`
    }
    row.seconds = Math.round((Date.now() - t0) / 100) / 10
    rows.push(row)
    const s = row.summary as { cases?: ReportData['cases']['bySeverity']; keyCases?: number } | undefined
    console.log(
      `${row.status === 'ok' ? 'ok  ' : 'FAIL'} ${String(row.seconds).padStart(6)}s  ${tenant.name.slice(0, 28).padEnd(28)}` +
        (s?.cases ? ` C${s.cases.critical}/H${s.cases.high}/M${s.cases.medium}/L${s.cases.low} key=${s.keyCases}` : '') +
        (row.error ? `  ${row.error}` : '') +
        (row.anomalies.length ? `  ⚠ ${row.anomalies.join(' ')}` : ''),
    )
  })
}

// Performance baseline: one line per Tenant with Cases.
const perf = rows.filter((r) => r.metrics && (r.metrics.counts.cases ?? 0) > 0).sort((a, b) => (b.metrics!.totalMs ?? 0) - (a.metrics!.totalMs ?? 0))
if (perf.length) {
  console.log('\nperformance (s = seconds; alerts p50/p95 in ms)')
  console.log('tenant'.padEnd(30), 'total', 'cases'.padStart(6), 'tactics', 'pages'.padStart(6), 'req'.padStart(6), 'p50', ' p95', 'peak', 'slowest phase')
  for (const r of perf) {
    const m = r.metrics!
    const alerts = m.endpoints['cases/:id/alerts']
    const req = Object.values(m.endpoints).reduce((n, e) => n + e.requests, 0)
    const slow = Object.entries(m.phases).sort((a, b) => b[1] - a[1])[0]
    console.log(
      `${r.instance.split('.')[0]}/${r.tenant}`.slice(0, 30).padEnd(30),
      (m.totalMs / 1000).toFixed(1).padStart(5),
      String(m.counts.cases).padStart(6),
      ((m.phases.tactics ?? 0) / 1000).toFixed(1).padStart(7),
      String(m.counts.alertPages).padStart(6),
      String(req).padStart(6),
      String(alerts?.ms.p50 ?? '-').padStart(4),
      String(alerts?.ms.p95 ?? '-').padStart(4),
      String(m.peakInFlight).padStart(4),
      slow ? `${slow[0]} ${(slow[1] / 1000).toFixed(1)}s` : '',
    )
  }
}

const failed = rows.filter((r) => r.status === 'failed').length
const withAnomalies = rows.filter((r) => r.anomalies.length).length
console.log(`\n${rows.length} tenants in ${Math.round((Date.now() - started) / 1000)} s: ${failed} failed, ${withAnomalies} with anomalies`)
if (process.env.OUT) await writeFile(process.env.OUT, JSON.stringify({ period, concurrency: PAGING.concurrency, runAt: new Date().toISOString(), rows }, null, 2))
await dispatcher.close()

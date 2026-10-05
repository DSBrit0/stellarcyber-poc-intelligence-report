import { Locale, StellarCredential, Template } from '@poc-intel/shared'
import { eq } from 'drizzle-orm'
import pino from 'pino'
import { config } from './config.js'
import { db, sql } from './db/client.js'
import { migrate } from './db/migrate.js'
import { pocs, reportData } from './db/schema.js'
import { open } from './lib/crypto.js'
import { MIGRATIONS_DIR } from './lib/paths.js'
import { QUEUES, startBoss, type RenderPdfJob, type SyncJob } from './queue.js'
import { closeBrowser, renderPdf } from './report/pdf.js'
import { renderReportHtml } from './report/render-html.js'
import { loadVersioning } from './report/versioning.js'
import { purgeExpired } from './retention/purge.js'
import { createSafeAgent } from './stellar/safe-agent.js'
import { runSync } from './syncs/run-sync.js'
import { detailsForReport } from './report/poc-details.js'
import { scheduledCatalogRefresh } from './catalog/refresh.js'
import { appLog, flush, setLogSource } from './lib/log-sink.js'

const cfg = config()
const log = pino({ level: cfg.LOG_LEVEL, base: { proc: 'worker' } })
setLogSource('worker')

await migrate(sql, MIGRATIONS_DIR)
const boss = await startBoss()
const dispatcher = createSafeAgent(cfg.STELLAR_ALLOWED_PRIVATE_CIDRS)

// ~10 Users: a few Syncs in parallel; each one already runs its collectors concurrently.
await boss.work<SyncJob>(QUEUES.sync, { localConcurrency: 3 }, async ([job]) => {
  if (!job) return
  try {
    const credential = StellarCredential.parse(JSON.parse(open(job.data.credentialSealed, `sync:${job.data.syncId}`)))
    await runSync(job.data.syncId, credential, dispatcher, log)
  } finally {
    // The sealed credential must not outlive the Sync.
    await boss.deleteJob(QUEUES.sync, job.id).catch(() => {})
  }
})

await boss.work<RenderPdfJob>(QUEUES.renderPdf, { localConcurrency: 2 }, async ([job]) => {
  if (!job) return
  const [row] = await db
    .select({ data: reportData.data, details: pocs.details, archImage: pocs.archImage, id: pocs.id, notebook: pocs.notebook })
    .from(reportData)
    .innerJoin(pocs, eq(pocs.id, reportData.pocId))
    .where(eq(reportData.id, job.data.reportDataId))
    .limit(1)
  if (!row) return
  const html = renderReportHtml(row.data, await detailsForReport(row), Template.parse(job.data.template), Locale.parse(job.data.locale), {
    archImage: row.archImage,
    versioning: await loadVersioning(job.data.reportDataId),
  })
  const t0 = performance.now()
  try {
    await renderPdf(html, job.data.outputPath)
    appLog('info', 'pdf', 'PDF rendered', { context: { reportDataId: job.data.reportDataId, template: job.data.template, locale: job.data.locale, ms: Math.round(performance.now() - t0) } })
  } catch (err) {
    appLog('error', 'pdf', 'PDF render failed', { context: { reportDataId: job.data.reportDataId, template: job.data.template, message: (err as Error).message } })
    throw err
  }
})

await boss.work(QUEUES.retention, async () => {
  const purged = await purgeExpired()
  log.info(purged, 'retention purge done')
  appLog('info', 'retention', 'Retention purge done', { context: purged })
})
// Daily at 03:00 server time.
await boss.schedule(QUEUES.retention, '0 3 * * *', null, { tz: 'America/Sao_Paulo' })

// The Data Source Catalog: every Monday, re-read the official documentation unless its build is unchanged.
await boss.work(QUEUES.catalog, async () => {
  const outcome = await scheduledCatalogRefresh()
  appLog('info', 'catalog', `Catalog refresh ${outcome}`, {})
})
await boss.schedule(QUEUES.catalog, '0 6 * * 1', null, { tz: 'America/Sao_Paulo' })

log.info('worker ready')
appLog('info', 'system', 'Worker started')

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    await boss.stop({ graceful: true })
    await flush()
    await closeBrowser()
    await dispatcher.close()
    await sql.end({ timeout: 5 })
    process.exit(0)
  })
}

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
import { purgeExpired } from './retention/purge.js'
import { createSafeAgent } from './stellar/safe-agent.js'
import { runSync } from './syncs/run-sync.js'

const cfg = config()
const log = pino({ level: cfg.LOG_LEVEL, base: { proc: 'worker' } })

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
    .select({ data: reportData.data, details: pocs.details, archImage: pocs.archImage })
    .from(reportData)
    .innerJoin(pocs, eq(pocs.id, reportData.pocId))
    .where(eq(reportData.id, job.data.reportDataId))
    .limit(1)
  if (!row) return
  const html = renderReportHtml(row.data, row.details, Template.parse(job.data.template), Locale.parse(job.data.locale), { archImage: row.archImage })
  await renderPdf(html, job.data.outputPath)
})

await boss.work(QUEUES.retention, async () => {
  log.info(await purgeExpired(), 'retention purge done')
})
// Daily at 03:00 server time.
await boss.schedule(QUEUES.retention, '0 3 * * *', null, { tz: 'America/Sao_Paulo' })

log.info('worker ready')

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    await boss.stop({ graceful: true })
    await closeBrowser()
    await dispatcher.close()
    await sql.end({ timeout: 5 })
    process.exit(0)
  })
}

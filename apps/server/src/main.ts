import type { StellarCredential } from '@poc-intel/shared'
import { buildApp } from './app.js'
import { config } from './config.js'
import { sql } from './db/client.js'
import { migrate } from './db/migrate.js'
import { ensureRootAdministrator } from './auth/root.js'
import { seal } from './lib/crypto.js'
import { MIGRATIONS_DIR } from './lib/paths.js'
import { QUEUES, startBoss, type RenderPdfJob, type SyncJob } from './queue.js'
import { createSafeAgent } from './stellar/safe-agent.js'
import { appLog, flush, setLogSource } from './lib/log-sink.js'

setLogSource('api')

const cfg = config()
const applied = await migrate(sql, MIGRATIONS_DIR)
if (applied.length) console.log(`migrations applied: ${applied.join(', ')}`)
await ensureRootAdministrator(cfg.ROOT_PASSWORD)

const boss = await startBoss()
const dispatcher = createSafeAgent(cfg.STELLAR_ALLOWED_PRIVATE_CIDRS)

const app = await buildApp({
  dispatcher,
  enqueueSync: async (syncId: string, credential: StellarCredential) => {
    const job: SyncJob = { syncId, credentialSealed: seal(JSON.stringify(credential), `sync:${syncId}`) }
    await boss.send(QUEUES.sync, job)
  },
  // singletonKey collapses concurrent requests for the same PDF into one render (then no id comes back).
  enqueuePdf: (job: RenderPdfJob) => boss.send(QUEUES.renderPdf, job, { singletonKey: job.outputPath }),
  pdfFailed: async (jobId: string) => (await boss.getJobById(QUEUES.renderPdf, jobId))?.state === 'failed',
})

await app.listen({ port: cfg.PORT, host: '0.0.0.0' })
appLog('info', 'system', 'API started')

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    await app.close()
    await flush()
    await boss.stop({ graceful: true })
    await dispatcher.close()
    await sql.end({ timeout: 5 })
    process.exit(0)
  })
}

import type { StellarCredential } from '@poc-intel/shared'
import { buildApp } from './app.js'
import { config } from './config.js'
import { sql } from './db/client.js'
import { migrate } from './db/migrate.js'
import { seal } from './lib/crypto.js'
import { MIGRATIONS_DIR } from './lib/paths.js'
import { QUEUES, startBoss, type RenderPdfJob, type SyncJob } from './queue.js'
import { createSafeAgent } from './stellar/safe-agent.js'

const cfg = config()
const applied = await migrate(sql, MIGRATIONS_DIR)
if (applied.length) console.log(`migrations applied: ${applied.join(', ')}`)

const boss = await startBoss()
const dispatcher = createSafeAgent(cfg.STELLAR_ALLOWED_PRIVATE_CIDRS)

const app = await buildApp({
  dispatcher,
  enqueueSync: async (syncId: string, credential: StellarCredential) => {
    const job: SyncJob = { syncId, credentialSealed: seal(JSON.stringify(credential), `sync:${syncId}`) }
    await boss.send(QUEUES.sync, job)
  },
  enqueuePdf: async (job: RenderPdfJob) => {
    // singletonKey collapses concurrent requests for the same PDF into one render.
    await boss.send(QUEUES.renderPdf, job, { singletonKey: job.outputPath })
  },
})

await app.listen({ port: cfg.PORT, host: '0.0.0.0' })

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    await app.close()
    await boss.stop({ graceful: true })
    await dispatcher.close()
    await sql.end({ timeout: 5 })
    process.exit(0)
  })
}

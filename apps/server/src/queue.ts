import { PgBoss } from 'pg-boss'
import { config } from './config.js'

export const QUEUES = {
  sync: 'sync',
  renderPdf: 'render-pdf',
  retention: 'retention',
  catalog: 'catalog',
} as const

/** Job payload for a Sync. The Stellar Credential travels sealed (AES-GCM) and the job row is deleted when it ends. */
export interface SyncJob {
  syncId: string
  credentialSealed: string
}

export interface RenderPdfJob {
  reportDataId: string
  template: string
  locale: string
  outputPath: string
}

export async function startBoss(): Promise<PgBoss> {
  const boss = new PgBoss({ connectionString: config().DATABASE_URL, schema: 'pgboss', max: 4 })
  boss.on('error', (err) => console.error('[pg-boss]', err))
  await boss.start()
  const queues: [string, Parameters<PgBoss['createQueue']>[1]][] = [
    // No automatic retry: a failed Sync is reported to the User, who starts a new one.
    [QUEUES.sync, { retryLimit: 0, expireInSeconds: 30 * 60, retentionSeconds: 60 * 60, deleteAfterSeconds: 60 }],
    [QUEUES.renderPdf, { retryLimit: 1, expireInSeconds: 120, retentionSeconds: 5 * 60, deleteAfterSeconds: 60 * 60 }],
    [QUEUES.retention, { retryLimit: 2, expireInSeconds: 30 * 60 }],
    [QUEUES.catalog, { retryLimit: 2, retryDelay: 15 * 60, expireInSeconds: 10 * 60 }],
  ]
  for (const [name, options] of queues) {
    if (await boss.getQueue(name)) continue
    // api and worker may race here on first boot.
    await boss.createQueue(name, options).catch(async (err) => {
      if (!(await boss.getQueue(name))) throw err
    })
  }
  return boss
}

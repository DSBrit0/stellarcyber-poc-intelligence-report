import { REPORT_DATA_VERSION, type StellarCredential, type SyncProgress } from '@poc-intel/shared'
import { eq, sql as dsql } from 'drizzle-orm'
import type { Dispatcher } from 'undici'
import { db } from '../db/client.js'
import { pocs, reportData, syncs } from '../db/schema.js'
import { StellarApiError, StellarClient } from '../stellar/client.js'
import type { SyncMetrics } from '../stellar/request-stats.js'
import { collectReportData } from './collect-report-data.js'

type Logger = { info: (obj: object, msg: string) => void; warn: (obj: object, msg: string) => void }

async function setProgress(syncId: string, progress: SyncProgress) {
  await db.update(syncs).set({ progress }).where(eq(syncs.id, syncId))
}

/**
 * One Sync: authenticate against the Instance, run every collector, condense the results into
 * Report Data and store it. A collector that fails becomes a gap in the Report, not a failed Sync;
 * only an authentication failure (or no data at all) fails the whole Sync.
 */
export async function runSync(syncId: string, credential: StellarCredential, dispatcher: Dispatcher, log: Logger) {
  const [row] = await db
    .select({ sync: syncs, poc: pocs })
    .from(syncs)
    .innerJoin(pocs, eq(pocs.id, syncs.pocId))
    .where(eq(syncs.id, syncId))
    .limit(1)
  if (!row) return
  const { poc } = row

  await db.update(syncs).set({ status: 'running', startedAt: dsql`now()` }).where(eq(syncs.id, syncId))

  try {
    const client = new StellarClient(poc.instanceUrl, credential, dispatcher)
    await client.authenticate()

    const target = {
      instanceUrl: poc.instanceUrl,
      tenant: { id: poc.tenantId, name: poc.tenantName },
      period: { start: poc.periodStart, end: poc.periodEnd },
      aiTriage: poc.details.aiTriageTested === true,
    }
    let metrics: SyncMetrics | null = null
    const data = await collectReportData(client, target, { log, onProgress: (p) => setProgress(syncId, p), onMetrics: (m) => (metrics = m) })

    const [stored] = await db.insert(reportData).values({ pocId: poc.id, version: REPORT_DATA_VERSION, data }).returning({ id: reportData.id })
    await db
      .update(syncs)
      .set({ status: 'succeeded', reportDataId: stored!.id, metrics, finishedAt: dsql`now()`, progress: { step: 'done', done: 1, total: 1 } })
      .where(eq(syncs.id, syncId))
    log.info({ syncId, reportDataId: stored!.id, gaps: data.gaps.length, totalMs: (metrics as SyncMetrics | null)?.totalMs }, 'sync succeeded')
  } catch (err) {
    const code = err instanceof StellarApiError ? err.code : 'internal'
    await db.update(syncs).set({ status: 'failed', error: code, finishedAt: dsql`now()` }).where(eq(syncs.id, syncId))
    log.warn({ syncId, code, err: (err as Error).message }, 'sync failed')
  }
}

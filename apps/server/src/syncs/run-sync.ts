import { REPORT_DATA_VERSION, type StellarCredential, type SyncProgress } from '@poc-intel/shared'
import { eq, sql as dsql } from 'drizzle-orm'
import type { Dispatcher } from 'undici'
import { db } from '../db/client.js'
import { pocs, reportData, syncs } from '../db/schema.js'
import { StellarApiError, StellarClient } from '../stellar/client.js'
import type { SyncMetrics } from '../stellar/request-stats.js'
import { appLog, apiCallRecorder } from '../lib/log-sink.js'
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
    const client = new StellarClient(poc.instanceUrl, credential, dispatcher, apiCallRecorder({ syncId, userId: row.sync.requestedBy }))
    appLog('info', 'sync', 'Sync started', { userId: row.sync.requestedBy, context: { syncId, pocId: poc.id, tenant: poc.tenantName, instance: poc.instanceUrl, period: [row.sync.periodStart ?? poc.periodStart, row.sync.periodEnd ?? poc.periodEnd] } })
    await setProgress(syncId, { step: 'connect', phase: 1, done: 2, total: 100 })
    await client.authenticate()

    const target = {
      instanceUrl: poc.instanceUrl,
      tenant: { id: poc.tenantId, name: poc.tenantName },
      // A Sync may carry its own period (New Sync with other dates); otherwise the PoC's.
      period: { start: row.sync.periodStart ?? poc.periodStart, end: row.sync.periodEnd ?? poc.periodEnd },
      aiTriage: poc.details.aiTriageTested === true,
    }
    let metrics: SyncMetrics | null = null
    const data = await collectReportData(client, target, {
      log,
      onProgress: (p) => setProgress(syncId, p),
      onMetrics: (m) => (metrics = m),
      onCollectorFailed: (name, err) => appLog('warn', 'collector', `Collector ${name} failed`, { userId: row.sync.requestedBy, context: { syncId, collector: name, message: err.message } }),
    })

    await setProgress(syncId, { step: 'save', phase: 5, done: 97, total: 100 })
    const [stored] = await db
      .insert(reportData)
      .values({ pocId: poc.id, version: REPORT_DATA_VERSION, seq: dsql`(SELECT coalesce(max(seq), 0) + 1 FROM report_data WHERE poc_id = ${poc.id})`, data }).returning({ id: reportData.id })
    await db
      .update(syncs)
      .set({ status: 'succeeded', reportDataId: stored!.id, metrics, finishedAt: dsql`now()`, progress: { step: 'done', done: 1, total: 1 } })
      .where(eq(syncs.id, syncId))
    const m = metrics as SyncMetrics | null
    log.info({ syncId, reportDataId: stored!.id, gaps: data.gaps.length, totalMs: m?.totalMs }, 'sync succeeded')
    appLog(data.gaps.length ? 'warn' : 'info', 'sync', data.gaps.length ? `Sync finished with ${data.gaps.length} gap(s)` : 'Sync finished', {
      userId: row.sync.requestedBy,
      context: { syncId, reportDataId: stored!.id, totalMs: m?.totalMs, phases: m?.phases, counts: m?.counts, gaps: data.gaps },
    })
  } catch (err) {
    const code = err instanceof StellarApiError ? err.code : 'internal'
    await db.update(syncs).set({ status: 'failed', error: code, finishedAt: dsql`now()` }).where(eq(syncs.id, syncId))
    log.warn({ syncId, code, err: (err as Error).message }, 'sync failed')
    appLog('error', 'sync', `Sync failed: ${code}`, { userId: row.sync.requestedBy, context: { syncId, pocId: poc.id, code, message: (err as Error).message } })
  }
}

import { REPORT_DATA_VERSION, type StellarCredential, type SyncProgress } from '@poc-intel/shared'
import { and, eq, sql as dsql } from 'drizzle-orm'
import type { Dispatcher } from 'undici'
import { db } from '../db/client.js'
import { pocs, reportData, syncs } from '../db/schema.js'
import { StellarApiError, StellarClient } from '../stellar/client.js'
import type { SyncMetrics } from '../stellar/request-stats.js'
import { appLog, apiCallRecorder } from '../lib/log-sink.js'
import { collectReportData } from './collect-report-data.js'

type Logger = { info: (obj: object, msg: string) => void; warn: (obj: object, msg: string) => void }

/** How often a running Sync checks whether the User cancelled it. */
const CANCEL_POLL_MS = 2_000

/** The Sync stopped being 'running' under the worker: the User cancelled it. */
export class SyncCancelled extends Error {
  constructor() {
    super('sync cancelled')
  }
}

const running = (syncId: string) => and(eq(syncs.id, syncId), eq(syncs.status, 'running'))

/** Progress is written only while the Sync runs, so it never overwrites a cancellation. */
async function setProgress(syncId: string, progress: SyncProgress) {
  await db.update(syncs).set({ progress }).where(running(syncId))
}

/**
 * One Sync: authenticate against the Instance, run every collector, condense the results into
 * Report Data and store it. A collector that fails becomes a gap in the Report, not a failed Sync;
 * only an authentication failure (or no data at all) fails the whole Sync. A cancelled Sync aborts
 * its calls to the Instance and stores nothing.
 */
export async function runSync(syncId: string, credential: StellarCredential, dispatcher: Dispatcher, log: Logger) {
  // Only a queued Sync starts: one cancelled while still in the queue is skipped.
  const [started] = await db
    .update(syncs)
    .set({ status: 'running', startedAt: dsql`now()` })
    .where(and(eq(syncs.id, syncId), eq(syncs.status, 'queued')))
    .returning({ id: syncs.id })
  if (!started) return
  const [row] = await db
    .select({ sync: syncs, poc: pocs })
    .from(syncs)
    .innerJoin(pocs, eq(pocs.id, syncs.pocId))
    .where(eq(syncs.id, syncId))
    .limit(1)
  if (!row) return
  const { poc } = row

  const abort = new AbortController()
  const watcher = setInterval(() => {
    db.select({ status: syncs.status })
      .from(syncs)
      .where(eq(syncs.id, syncId))
      .then(([s]) => {
        if (s?.status !== 'running') abort.abort(new SyncCancelled())
      })
      .catch(() => {})
  }, CANCEL_POLL_MS)

  try {
    const client = new StellarClient(poc.instanceUrl, credential, dispatcher, apiCallRecorder({ syncId, userId: row.sync.requestedBy }), abort.signal)
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
      signal: abort.signal,
    })

    await setProgress(syncId, { step: 'save', phase: 5, done: 97, total: 100 })
    // Report Data and the Sync's success commit together, and only if the Sync is still running: a
    // cancel that lands at the very end leaves no Report behind.
    const stored = await db.transaction(async (tx) => {
      const [report] = await tx
        .insert(reportData)
        .values({ pocId: poc.id, version: REPORT_DATA_VERSION, seq: dsql`(SELECT coalesce(max(seq), 0) + 1 FROM report_data WHERE poc_id = ${poc.id})`, data })
        .returning({ id: reportData.id })
      const [done] = await tx
        .update(syncs)
        .set({ status: 'succeeded', reportDataId: report!.id, metrics, finishedAt: dsql`now()`, progress: { step: 'done', done: 1, total: 1 } })
        .where(running(syncId))
        .returning({ id: syncs.id })
      if (!done) throw new SyncCancelled()
      return report!
    })
    const m = metrics as SyncMetrics | null
    log.info({ syncId, reportDataId: stored.id, gaps: data.gaps.length, totalMs: m?.totalMs }, 'sync succeeded')
    appLog(data.gaps.length ? 'warn' : 'info', 'sync', data.gaps.length ? `Sync finished with ${data.gaps.length} gap(s)` : 'Sync finished', {
      userId: row.sync.requestedBy,
      context: { syncId, reportDataId: stored.id, totalMs: m?.totalMs, phases: m?.phases, counts: m?.counts, gaps: data.gaps },
    })
  } catch (err) {
    if (err instanceof SyncCancelled || abort.signal.aborted) {
      log.info({ syncId }, 'sync cancelled')
      appLog('info', 'sync', 'Sync stopped after cancellation', { userId: row.sync.requestedBy, context: { syncId, pocId: poc.id } })
      return
    }
    const code = err instanceof StellarApiError ? err.code : 'internal'
    await db.update(syncs).set({ status: 'failed', error: code, finishedAt: dsql`now()` }).where(running(syncId))
    log.warn({ syncId, code, err: (err as Error).message }, 'sync failed')
    appLog('error', 'sync', `Sync failed: ${code}`, { userId: row.sync.requestedBy, context: { syncId, pocId: poc.id, code, message: (err as Error).message } })
  } finally {
    clearInterval(watcher)
  }
}

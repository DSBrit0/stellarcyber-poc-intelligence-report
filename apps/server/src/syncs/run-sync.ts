import { REPORT_DATA_VERSION, ReportData, type StellarCredential, type SyncProgress } from '@poc-intel/shared'
import { eq, sql as dsql } from 'drizzle-orm'
import type { Dispatcher } from 'undici'
import { db } from '../db/client.js'
import { pocs, reportData, syncs } from '../db/schema.js'
import { StellarApiError, StellarClient } from '../stellar/client.js'
import {
  collectAssets,
  collectCaseCounts,
  collectConnectors,
  collectDataSensors,
  collectVolume,
  type CollectContext,
} from '../stellar/collectors.js'

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

    const ctx: CollectContext = { client, tenantId: poc.tenantId, period: { start: poc.periodStart, end: poc.periodEnd } }
    const gaps: ReportData['gaps'] = []
    const collectors = {
      cases: () => collectCaseCounts(ctx),
      assets: () => collectAssets(ctx),
      volume: () => collectVolume(ctx),
      connectors: () => collectConnectors(ctx),
      dataSensors: () => collectDataSensors(ctx),
    }
    const names = Object.keys(collectors) as (keyof typeof collectors)[]
    let done = 0
    await setProgress(syncId, { step: 'collect', done, total: names.length })

    const results = await Promise.all(
      names.map(async (name) => {
        try {
          return await collectors[name]()
        } catch (err) {
          if (err instanceof StellarApiError && err.code === 'auth_failed') throw err
          gaps.push({ collector: name, reason: err instanceof StellarApiError ? err.code : 'internal' })
          log.warn({ syncId, collector: name, err: (err as Error).message }, 'collector failed')
          return null
        } finally {
          await setProgress(syncId, { step: 'collect', done: ++done, total: names.length })
        }
      }),
    )
    if (gaps.length === names.length) throw new StellarApiError('unavailable', 'every collector failed')

    const byName = Object.fromEntries(names.map((n, i) => [n, results[i]])) as {
      [K in keyof typeof collectors]: Awaited<ReturnType<(typeof collectors)[K]>> | null
    }
    const emptyCompliance = { stats: null, recommended: null, recommendedWindow: null, scenarios: [] }
    const data = ReportData.parse({
      version: REPORT_DATA_VERSION,
      collectedAt: new Date().toISOString(),
      instanceUrl: poc.instanceUrl,
      tenant: { id: poc.tenantId, name: poc.tenantName },
      period: ctx.period,
      cases: byName.cases ?? { total: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 } },
      assets: byName.assets ?? { daily: [], compliance: emptyCompliance },
      volume: byName.volume ?? { dailyGb: [], compliance: emptyCompliance },
      connectors: byName.connectors ?? [],
      dataSensors: byName.dataSensors ?? [],
      gaps,
    } satisfies ReportData)

    const [stored] = await db.insert(reportData).values({ pocId: poc.id, version: REPORT_DATA_VERSION, data }).returning({ id: reportData.id })
    await db
      .update(syncs)
      .set({ status: 'succeeded', reportDataId: stored!.id, finishedAt: dsql`now()`, progress: { step: 'done', done: names.length, total: names.length } })
      .where(eq(syncs.id, syncId))
    log.info({ syncId, reportDataId: stored!.id, gaps: gaps.length }, 'sync succeeded')
  } catch (err) {
    const code = err instanceof StellarApiError ? err.code : 'internal'
    await db.update(syncs).set({ status: 'failed', error: code, finishedAt: dsql`now()` }).where(eq(syncs.id, syncId))
    log.warn({ syncId, code, err: (err as Error).message }, 'sync failed')
  }
}

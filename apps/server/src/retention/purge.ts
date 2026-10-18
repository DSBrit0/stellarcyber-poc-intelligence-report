import { readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { and, eq, inArray, isNotNull, lt, or, sql as dsql } from 'drizzle-orm'
import { purgeExpiredSessions } from '../auth/session.js'
import { config } from '../config.js'
import { db } from '../db/client.js'
import { apiCalls, appLogs, pocs, reportData } from '../db/schema.js'
import { audit } from '../lib/audit.js'
import { getSettings } from '../settings.js'
import { deleteRenders } from '../report/render-cache.js'

const RENDER_CACHE_MAX_AGE_MS = 24 * 3_600_000

/**
 * Applies the Retention Period (ADR 0016): a PoC Closed for longer than it is deleted for good, with its
 * Report Data, Notebook, Experiences and everything else it holds (by cascade). An Active PoC is never
 * deleted, however old its Report Data. The Admin's current setting always applies.
 */
export async function purgeExpired(): Promise<{ reportData: number; pocs: number; sessions: number; renders: number; apiCalls: number; appLogs: number }> {
  const { retentionDays } = await getSettings()
  const cutoff = dsql`now() - make_interval(days => ${retentionDays})`

  const expired = and(isNotNull(pocs.closedAt), lt(pocs.closedAt, cutoff))
  const deletedReports = await db
    .select({ id: reportData.id })
    .from(reportData)
    .where(inArray(reportData.pocId, db.select({ id: pocs.id }).from(pocs).where(expired)))
  const deletedPocs = await db.delete(pocs).where(expired).returning({ id: pocs.id })
  await deleteRenders(deletedReports.map((r) => r.id))
  const sessions = await purgeExpiredSessions()

  // Audit data follows the same period; debug-level logs (mostly polling) are kept for 7 days only.
  const calls = await db.delete(apiCalls).where(lt(apiCalls.at, cutoff)).returning({ id: apiCalls.id })
  const logs = await db
    .delete(appLogs)
    .where(or(lt(appLogs.at, cutoff), and(eq(appLogs.level, 'debug'), lt(appLogs.at, dsql`now() - interval '7 days'`))))
    .returning({ id: appLogs.id })

  // Rendered PDFs are a cache: drop anything older than a day.
  let renders = 0
  const dir = join(config().DATA_DIR, 'renders')
  for (const file of await readdir(dir).catch(() => [] as string[])) {
    const path = join(dir, file)
    if (Date.now() - (await stat(path)).mtimeMs > RENDER_CACHE_MAX_AGE_MS) {
      await rm(path, { force: true })
      renders++
    }
  }

  const result = { reportData: deletedReports.length, pocs: deletedPocs.length, sessions, renders, apiCalls: calls.length, appLogs: logs.length }
  await audit({ action: 'retention.purged', meta: { retentionDays, ...result } })
  return result
}

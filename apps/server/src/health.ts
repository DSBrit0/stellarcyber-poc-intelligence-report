import { readdir, stat, statfs, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from './db/client.js'

/** The worker touches this file on every beat; the container healthcheck reads its age. */
export const HEARTBEAT_FILE = join(tmpdir(), 'worker-heartbeat')
export const HEARTBEAT_MS = 30_000
/** A beat older than three periods means the worker is gone or stuck. */
const STALE_WORKER_MS = 3 * HEARTBEAT_MS
/** The backup runs daily at 02:30; two hours of slack before it counts as missed. */
const STALE_BACKUP_MS = 26 * 3_600_000

/** One beat: in the database for the Audit panel, and on disk for Docker. */
export async function beat(startedAt: string): Promise<void> {
  await sql`
    insert into settings (key, value) values ('worker_heartbeat', ${JSON.stringify({ pid: process.pid, startedAt })}::jsonb)
    on conflict (key) do update set value = excluded.value, updated_at = now()`
  await writeFile(HEARTBEAT_FILE, new Date().toISOString())
}

/** The newest dump written by backup.sh, or null when the folder is missing or empty. */
export async function latestBackup(dir: string): Promise<{ name: string; path: string; bytes: number } | null> {
  const names = await readdir(dir).catch(() => [] as string[])
  // The names carry a sortable timestamp (pocintel-YYYYMMDD-HHMMSS.dump); `.partial` files are dumps in progress.
  const name = names.filter((n) => /^pocintel-\d{8}-\d{6}\.dump$/.test(n)).sort().at(-1)
  if (!name) return null
  const path = join(dir, name)
  return { name, path, bytes: (await stat(path)).size }
}

export type Tone = 'good' | 'warn' | 'bad'

export interface SystemHealth {
  worker: { lastBeatAt: string | null; startedAt: string | null; tone: Tone }
  backup: { at: string | null; bytes: number | null; tone: Tone; downloadable: boolean }
  syncsFailed24h: number
  disk: { totalBytes: number; freeBytes: number; tone: Tone } | null
  dbBytes: number
}

export const usedTone = (used: number): Tone => (used >= 0.9 ? 'bad' : used >= 0.8 ? 'warn' : 'good')
export const ageTone = (at: string | null, staleMs: number, now = Date.now()): Tone =>
  !at ? 'bad' : now - Date.parse(at) > staleMs ? 'bad' : 'good'

/** What the Audit "System health" block shows. `dataDir` is the volume that holds the PDFs. */
export async function systemHealth(dataDir: string, backupDir: string): Promise<SystemHealth> {
  const [row] = await sql`
    select
      (select updated_at from settings where key = 'worker_heartbeat') as "beatAt",
      (select value->>'startedAt' from settings where key = 'worker_heartbeat') as "startedAt",
      (select value->>'at' from settings where key = 'last_backup') as "backupAt",
      (select (value->>'bytes')::bigint from settings where key = 'last_backup') as "backupBytes",
      (select count(*) from syncs where status = 'failed' and created_at > now() - interval '24 hours')::int as "syncsFailed24h",
      pg_database_size(current_database()) as "dbBytes"`
  const beatAt = row!.beatAt ? new Date(row!.beatAt as string).toISOString() : null
  const backupAt = (row!.backupAt as string | null) ?? null
  const disk = await statfs(dataDir).then(
    (s) => {
      const totalBytes = s.blocks * s.bsize
      const freeBytes = s.bavail * s.bsize
      return { totalBytes, freeBytes, tone: usedTone(totalBytes ? 1 - freeBytes / totalBytes : 0) }
    },
    () => null,
  )
  const downloadable = (await latestBackup(backupDir)) !== null
  return {
    worker: { lastBeatAt: beatAt, startedAt: (row!.startedAt as string | null) ?? null, tone: ageTone(beatAt, STALE_WORKER_MS) },
    backup: { at: backupAt, bytes: row!.backupBytes == null ? null : Number(row!.backupBytes), tone: ageTone(backupAt, STALE_BACKUP_MS), downloadable },
    syncsFailed24h: row!.syncsFailed24h as number,
    disk,
    dbBytes: Number(row!.dbBytes),
  }
}

import { readdir, readFile } from 'node:fs/promises'
import type { Sql } from 'postgres'

// Applies migrations/NNNN_*.sql in order, once each, inside a transaction holding an
// advisory lock, so api and worker starting together cannot both migrate.
// `dir` must end with a slash.
export async function migrate(sql: Sql, dir: string): Promise<string[]> {
  const files = (await readdir(dir)).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort()
  const applied: string[] = []
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(727274)`
    await tx`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`
    const done = new Set((await tx`SELECT name FROM schema_migrations`).map((r) => r.name as string))
    for (const file of files) {
      if (done.has(file)) continue
      await tx.unsafe(await readFile(dir + file, 'utf8'))
      await tx`INSERT INTO schema_migrations (name) VALUES (${file})`
      applied.push(file)
    }
  })
  return applied
}

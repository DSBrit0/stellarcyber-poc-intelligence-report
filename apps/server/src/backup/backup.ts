import { spawn } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { TextReader, TextWriter, Uint8ArrayReader, Uint8ArrayWriter, ZipReader, ZipWriter, configure } from '@zip.js/zip.js'
import { config } from '../config.js'
import { sql } from '../db/client.js'
import { migrate } from '../db/migrate.js'
import { openWith, sealWith } from '../lib/crypto.js'
import { HttpError } from '../lib/http.js'
import { MIGRATIONS_DIR } from '../lib/paths.js'
import { mfaAad } from '../lib/totp.js'

// The Admin's backup: one AES-256 password-protected ZIP holding the whole database (pg_dump) and a
// manifest with the ENCRYPTION_KEY, so a restore on a new installation keeps every MFA enrolment.
// The pg-boss queue (schema pgboss) is left out: its jobs belong to the installation that ran them.

configure({ useWebWorkers: false })

export const BACKUP_FORMAT = 1
export const MIN_PASSWORD = 12
const MANIFEST = 'manifest.json'
const DUMP = 'pocintel.dump'

export interface Manifest {
  format: number
  createdAt: string
  /** schema_migrations at dump time: a restore refuses a backup newer than the running code. */
  migrations: string[]
  encryptionKey: string
}

export interface RestoreSummary {
  createdAt: string
  migrationsApplied: string[]
  /** MFA secrets re-sealed with this installation's key; ones that could not be opened were reset. */
  mfaResealed: number
  mfaReset: number
}

const bin = (name: string) => (config().PG_BIN_DIR ? join(config().PG_BIN_DIR, name) : name)

/** Runs a PostgreSQL client tool; stdin, when given, is written then closed. Rejects with its stderr. */
function run(tool: string, args: string[], stdin?: NodeJS.ReadableStream | string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin(tool), args, { stdio: [stdin === undefined ? 'ignore' : 'pipe', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr!.on('data', (d: Buffer) => (stderr = (stderr + d.toString()).slice(-4000)))
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${tool} exited with ${code}: ${stderr.trim()}`))))
    if (typeof stdin === 'string') child.stdin!.end(stdin)
    else if (stdin) stdin.pipe(child.stdin!)
  })
}

async function dumpTo(file: string): Promise<void> {
  await run('pg_dump', ['--dbname', config().DATABASE_URL, '--format=custom', '--no-owner', '--no-privileges', '--exclude-schema=pgboss', '--file', file])
  // Every User and PoC is in it: readable by the app's user only, like backup.sh's dumps.
  await chmod(file, 0o600)
}

const stamp = (d = new Date()) => d.toISOString().replace(/\D/g, '').slice(0, 14).replace(/^(\d{8})/, '$1-')

// One backup or restore at a time: a restore replaces the database a backup would be reading.
let busy = false
async function exclusive<T>(work: () => Promise<T>): Promise<T> {
  if (busy) throw new HttpError(409, 'backup_busy')
  busy = true
  try {
    return await work()
  } finally {
    busy = false
  }
}

export function createBackup(password: string): Promise<{ name: string; zip: Uint8Array }> {
  return exclusive(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'backup-'))
    try {
      await dumpTo(join(dir, DUMP))
      const migrations = (await sql`select name from schema_migrations order by name`).map((r) => r.name as string)
      const manifest: Manifest = { format: BACKUP_FORMAT, createdAt: new Date().toISOString(), migrations, encryptionKey: config().ENCRYPTION_KEY }
      const writer = new ZipWriter(new Uint8ArrayWriter(), { password, encryptionStrength: 3 })
      await writer.add(MANIFEST, new TextReader(JSON.stringify(manifest, null, 2)))
      // The custom-format dump is already compressed.
      await writer.add(DUMP, new Uint8ArrayReader(await readFile(join(dir, DUMP))), { level: 0 })
      return { name: `poc-intel-backup-${stamp()}.zip`, zip: await writer.close() }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
}

/** Opens the ZIP with its password. Wrong password, a file that is not a backup, or a foreign format: 400. */
export async function readBackup(zip: Uint8Array, password: string): Promise<{ manifest: Manifest; dump: Uint8Array }> {
  const reader = new ZipReader(new Uint8ArrayReader(zip), { password })
  try {
    const entries = await reader.getEntries().catch(() => {
      throw new HttpError(400, 'backup_invalid')
    })
    const manifestEntry = entries.find((e) => e.filename === MANIFEST)
    const dumpEntry = entries.find((e) => e.filename === DUMP)
    if (!manifestEntry || !dumpEntry || manifestEntry.directory || dumpEntry.directory) throw new HttpError(400, 'backup_invalid')
    // Only encrypted backups are accepted: an unencrypted ZIP would be a file someone assembled by hand.
    if (!manifestEntry.encrypted || !dumpEntry.encrypted) throw new HttpError(400, 'backup_invalid')
    const text = await manifestEntry.getData(new TextWriter()).catch((err: Error) => {
      throw new HttpError(400, /password/i.test(err.message) ? 'backup_bad_password' : 'backup_invalid')
    })
    let manifest: Manifest
    try {
      manifest = JSON.parse(text) as Manifest
    } catch {
      throw new HttpError(400, 'backup_invalid')
    }
    if (manifest.format !== BACKUP_FORMAT || !Array.isArray(manifest.migrations) || typeof manifest.encryptionKey !== 'string') throw new HttpError(400, 'backup_invalid')
    const dump = await dumpEntry.getData(new Uint8ArrayWriter())
    return { manifest, dump }
  } finally {
    await reader.close()
  }
}

/** Migrations the backup has and this code does not: it was taken by a newer version of the app. */
export async function unknownMigrations(manifest: Manifest): Promise<string[]> {
  const known = new Set(await readdir(MIGRATIONS_DIR))
  return manifest.migrations.filter((m) => !known.has(m))
}

/**
 * Replaces the whole database with the backup, in one transaction: the public schema is dropped and
 * rebuilt from the dump, so a failure leaves the database as it was. Then the migrations newer than
 * the backup run, MFA secrets are re-sealed with this installation's key, and every session ends.
 * The current state is dumped first to DATA_DIR/restore/pre-restore.dump.
 */
export function restoreBackup(manifest: Manifest, dump: Uint8Array): Promise<RestoreSummary> {
  return exclusive(async () => {
    if ((await unknownMigrations(manifest)).length) throw new HttpError(409, 'backup_newer_version')
    const [active] = await sql`select count(*)::int as n from syncs where status in ('queued', 'running')`
    if (active!.n) throw new HttpError(409, 'sync_in_progress')

    const safety = join(config().DATA_DIR, 'restore')
    await mkdir(safety, { recursive: true })
    await dumpTo(join(safety, 'pre-restore.dump'))

    const dir = await mkdtemp(join(tmpdir(), 'restore-'))
    try {
      const file = join(dir, DUMP)
      await writeFile(file, dump)
      const script = spawn(bin('pg_restore'), ['--no-owner', '--no-privileges', '--file', '-', file], { stdio: ['ignore', 'pipe', 'pipe'] })
      let scriptErr = ''
      script.stderr.on('data', (d: Buffer) => (scriptErr = (scriptErr + d.toString()).slice(-4000)))
      const scriptDone = new Promise<void>((resolve, reject) => {
        script.on('error', reject)
        script.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`pg_restore exited with ${code}: ${scriptErr.trim()}`))))
      })
      // psql runs the preamble and the whole restore script as one transaction (-1), stopping at the first error.
      const preamble = 'DROP SCHEMA public CASCADE;\nCREATE SCHEMA public;\n'
      const input = new PassThrough()
      input.write(preamble)
      script.stdout.pipe(input)
      await Promise.all([run('psql', ['--dbname', config().DATABASE_URL, '--single-transaction', '--quiet', '--no-psqlrc', '-v', 'ON_ERROR_STOP=1'], input), scriptDone])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }

    const migrationsApplied = await migrate(sql, MIGRATIONS_DIR)
    const { resealed, reset } = await resealMfa(Buffer.from(manifest.encryptionKey, 'base64'), Buffer.from(config().ENCRYPTION_KEY, 'base64'))
    // Sessions in the backup belong to the other installation's browsers.
    await sql`delete from sessions`
    return { createdAt: manifest.createdAt, migrationsApplied, mfaResealed: resealed, mfaReset: reset }
  })
}

/** Moves every TOTP secret from the backup's key to this installation's; one that will not open is reset. */
async function resealMfa(from: Buffer, to: Buffer): Promise<{ resealed: number; reset: number }> {
  if (from.equals(to)) return { resealed: 0, reset: 0 }
  const rows = await sql`select id, mfa_secret_enc as "enc" from users where mfa_secret_enc is not null`
  let resealed = 0
  let reset = 0
  for (const r of rows) {
    const id = r.id as string
    let secret: string | null = null
    try {
      secret = openWith(from, r.enc as string, mfaAad(id))
    } catch {
      secret = null
    }
    if (secret) {
      await sql`update users set mfa_secret_enc = ${sealWith(to, secret, mfaAad(id))} where id = ${id}`
      resealed++
    } else {
      await sql`update users set mfa_enabled = false, mfa_secret_enc = null, mfa_last_step = null where id = ${id}`
      reset++
    }
  }
  return { resealed, reset }
}

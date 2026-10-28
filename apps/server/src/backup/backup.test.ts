import { TextReader, Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../db/client.js', () => ({ sql: {} }))
const { BACKUP_FORMAT, readBackup, unknownMigrations } = await import('./backup.js')

const manifest = { format: BACKUP_FORMAT, createdAt: '2026-10-28T12:00:00.000Z', migrations: ['0001_init.sql'], encryptionKey: 'a'.repeat(44) }
const dump = new Uint8Array([1, 2, 3, 4])

async function zip(entries: Record<string, string | Uint8Array>, password?: string): Promise<Uint8Array> {
  const writer = new ZipWriter(new Uint8ArrayWriter(), password ? { password, encryptionStrength: 3 } : {})
  for (const [name, data] of Object.entries(entries)) await writer.add(name, typeof data === 'string' ? new TextReader(data) : new Uint8ArrayReader(data))
  return writer.close()
}

const code = (p: Promise<unknown>) => p.then(() => 'ok', (e: { code?: string }) => e.code)

describe('readBackup', () => {
  const good = () => zip({ 'manifest.json': JSON.stringify(manifest), 'pocintel.dump': dump }, 'correct horse battery')

  it('opens a backup with its password', async () => {
    const out = await readBackup(await good(), 'correct horse battery')
    expect(out.manifest).toEqual(manifest)
    expect([...out.dump]).toEqual([...dump])
  })

  it('refuses a wrong password', async () => {
    expect(await code(readBackup(await good(), 'wrong password!!'))).toBe('backup_bad_password')
  })

  it('refuses a ZIP without encryption, a ZIP missing the dump, and a file that is not a ZIP', async () => {
    expect(await code(readBackup(await zip({ 'manifest.json': JSON.stringify(manifest), 'pocintel.dump': dump }), 'x'))).toBe('backup_invalid')
    expect(await code(readBackup(await zip({ 'manifest.json': JSON.stringify(manifest) }, 'pw'), 'pw'))).toBe('backup_invalid')
    expect(await code(readBackup(new TextEncoder().encode('not a zip'), 'pw'))).toBe('backup_invalid')
  })

  it('refuses a manifest of another format', async () => {
    const other = await zip({ 'manifest.json': JSON.stringify({ ...manifest, format: 99 }), 'pocintel.dump': dump }, 'pw')
    expect(await code(readBackup(other, 'pw'))).toBe('backup_invalid')
  })
})

describe('unknownMigrations', () => {
  it('lists the migrations this code does not have', async () => {
    expect(await unknownMigrations({ ...manifest, migrations: ['0001_init.sql', '9999_future.sql'] })).toEqual(['9999_future.sql'])
  })
})

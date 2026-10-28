import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./db/client.js', () => ({ sql: {} }))
const { ageTone, latestBackup, usedTone } = await import('./health.js')

describe('usedTone', () => {
  it('turns amber at 80% and red at 90% of the disk', () => {
    expect(usedTone(0.5)).toBe('good')
    expect(usedTone(0.8)).toBe('warn')
    expect(usedTone(0.9)).toBe('bad')
  })
})

describe('ageTone', () => {
  const now = Date.parse('2026-10-18T12:00:00Z')
  it('is good while the last event is recent enough', () => {
    expect(ageTone('2026-10-18T11:59:00Z', 90_000, now)).toBe('good')
  })
  it('is bad when the last event is too old or never happened', () => {
    expect(ageTone('2026-10-18T11:58:00Z', 90_000, now)).toBe('bad')
    expect(ageTone(null, 90_000, now)).toBe('bad')
  })
  it('reads the timestamp PostgreSQL writes into jsonb', () => {
    expect(ageTone('2026-10-18T02:30:01.123456+00:00', 26 * 3_600_000, now)).toBe('good')
  })
})

describe('latestBackup', () => {
  it('picks the newest finished dump and ignores dumps in progress and other files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'backups-'))
    for (const name of ['pocintel-20261027-023001.dump', 'pocintel-20261028-023001.dump', 'pocintel-20261029-023001.dump.partial', 'backup.log'])
      await writeFile(join(dir, name), 'x'.repeat(3))
    expect(await latestBackup(dir)).toEqual({ name: 'pocintel-20261028-023001.dump', path: join(dir, 'pocintel-20261028-023001.dump'), bytes: 3 })
  })
  it('is null when the folder is missing or holds no dump', async () => {
    expect(await latestBackup(join(tmpdir(), 'no-such-backups-dir'))).toBeNull()
    expect(await latestBackup(await mkdtemp(join(tmpdir(), 'backups-')))).toBeNull()
  })
})

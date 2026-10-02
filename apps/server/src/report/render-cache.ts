import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from '../config.js'

// Rendered PDFs are cached as renders/<reportDataId>-<key>.pdf, so every render of a Report can be
// found and removed when that Report (or its PoC) is deleted.
export const rendersDir = () => join(config().DATA_DIR, 'renders')
export const renderPath = (reportDataId: string, key: string) => join(rendersDir(), `${reportDataId}-${key}.pdf`)

export async function deleteRenders(reportDataIds: string[]): Promise<number> {
  if (reportDataIds.length === 0) return 0
  const files = await readdir(rendersDir()).catch(() => [] as string[])
  const doomed = files.filter((f) => reportDataIds.some((id) => f.startsWith(`${id}-`)))
  await Promise.all(doomed.map((f) => rm(join(rendersDir(), f), { force: true })))
  return doomed.length
}

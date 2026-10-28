import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireRole } from '../auth/guards.js'
import { audit } from '../lib/audit.js'
import { HttpError, parse } from '../lib/http.js'
import { appLog } from '../lib/log-sink.js'
import { MIN_PASSWORD, createBackup, readBackup, restoreBackup } from './backup.js'

// Download (Admins) and restore (the Root Administrator only: it replaces every User, PoC and log).
// The restore's password travels in a header because the body is the ZIP itself; app.ts redacts it.

const MAX_UPLOAD = 1024 * 1_048_576
export const PASSWORD_HEADER = 'x-backup-password'

const DownloadInput = z.object({ password: z.string().min(MIN_PASSWORD).max(128) })

export async function backupRoutes(app: FastifyInstance): Promise<void> {
  app.addContentTypeParser(['application/zip', 'application/octet-stream'], { parseAs: 'buffer', bodyLimit: MAX_UPLOAD }, (_req, body, done) => done(null, body))

  app.post('/backup', async (req, reply) => {
    const admin = requireRole(req, 'admin')
    const { password } = parse(DownloadInput, req.body)
    const { name, zip } = await createBackup(password)
    await audit({ action: 'admin.backup_downloaded', userId: admin.user.id, target: name, ip: req.ip, meta: { bytes: zip.byteLength } })
    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`)
      .header('cache-control', 'no-store')
      .send(Buffer.from(zip.buffer, zip.byteOffset, zip.byteLength))
  })

  app.post('/backup/restore', { bodyLimit: MAX_UPLOAD }, async (req) => {
    const root = requireRole(req, 'admin')
    if (!root.user.isRoot) throw new HttpError(403, 'root_only')
    const password = req.headers[PASSWORD_HEADER]
    if (typeof password !== 'string' || !password) throw new HttpError(400, 'backup_bad_password')
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new HttpError(400, 'backup_invalid')
    const { manifest, dump } = await readBackup(new Uint8Array(req.body), password)
    const summary = await restoreBackup(manifest, dump)
    // Written after the restore, so it lands in the restored audit log. The User id belongs to the
    // database that was replaced, hence the e-mail in meta.
    await audit({ action: 'admin.backup_restored', ip: req.ip, meta: { by: root.user.email, backupCreatedAt: summary.createdAt, ...summary } })
    appLog('warn', 'system', `Database restored from a backup taken ${summary.createdAt} by ${root.user.email}`)
    return summary
  })
}

import { db } from '../db/client.js'
import { auditLog } from '../db/schema.js'

export type AuditAction =
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'auth.mfa_enabled'
  | 'auth.password_changed'
  | 'auth.password_reset'
  | 'auth.registered'
  | 'admin.user_approved'
  | 'admin.user_rejected'
  | 'admin.user_disabled'
  | 'admin.user_updated'
  | 'admin.mfa_reset'
  | 'admin.password_reset_issued'
  | 'admin.settings_updated'
  | 'poc.created'
  | 'poc.updated'
  | 'poc.deleted'
  | 'sync.requested'
  | 'sync.cancelled'
  | 'report.rendered'
  | 'retention.purged'
  | 'customer.created'
  | 'customer.key_rotated'
  | 'customer.profile_changed'
  | 'catalog.updated'
  | 'template.updated'
  | 'user.deleted'
  | 'customer.deleted'
  | 'customer.user_approve'
  | 'customer.user_reject'
  | 'customer.user_disable'
  | 'report.commented'
  | 'report.deleted'
  | 'poc.arch_image'
  | 'experience.activated'
  | 'experience.finished'
  | 'experience.reopened'

export async function audit(entry: {
  action: AuditAction
  userId?: string | null
  target?: string | null
  ip?: string | null
  meta?: Record<string, unknown>
}): Promise<void> {
  await db.insert(auditLog).values({
    action: entry.action,
    userId: entry.userId ?? null,
    target: entry.target ?? null,
    ip: entry.ip ?? null,
    meta: entry.meta ?? null,
  })
}

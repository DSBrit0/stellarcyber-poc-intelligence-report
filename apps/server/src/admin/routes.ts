import { Role, UserStatus } from '@poc-intel/shared'
import { desc, eq, sql as dsql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireRole } from '../auth/guards.js'
import { revokeUserSessions } from '../auth/session.js'
import { db } from '../db/client.js'
import { customers, passwordResets, users } from '../db/schema.js'
import { audit } from '../lib/audit.js'
import { config } from '../config.js'
import { randomToken, sha256 } from '../lib/crypto.js'
import { HttpError, notFound, parse } from '../lib/http.js'
import { assertNotRoot } from '../auth/root.js'
import { AppSettings, getSettings, updateSettings } from '../settings.js'

const RESET_TTL_MS = 24 * 3_600_000
const IdParam = z.object({ id: z.uuid() })

const userColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  company: users.company,
  role: users.role,
  status: users.status,
  customerId: users.customerId,
  mfaEnabled: users.mfaEnabled,
  mfaExempt: users.mfaExempt,
  isRoot: users.isRoot,
  createdAt: users.createdAt,
  decidedAt: users.decidedAt,
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (req) => {
    requireRole(req, 'admin')
  })

  app.get('/users', async (req) => {
    const { status } = parse(z.object({ status: UserStatus.optional() }), req.query)
    return db
      .select({
        ...userColumns,
        // Explicit aliases: see customers/routes.ts on unqualified columns in single-table selects.
        customers: dsql<number>`(SELECT count(*)::int FROM customers c WHERE c.owner_id = users.id)`,
        pocs: dsql<number>`(SELECT count(*)::int FROM pocs p WHERE p.owner_id = users.id AND NOT p.draft)`,
      })
      .from(users)
      .where(status ? eq(users.status, status) : undefined)
      .orderBy(desc(users.createdAt))
  })

  // Approving a Registration also picks the Role; changing role/status later goes through PATCH.
  app.post('/users/:id/approve', async (req) => {
    const admin = req.auth!.user
    const { id } = parse(IdParam, req.params)
    const { role } = parse(z.object({ role: Role }), req.body)
    await assertPendingRegistration(id)
    // A Registration linked to a Company takes the Company's Profile as its Role (ADR 0011).
    const [current] = await db
      .select({ profile: customers.profile })
      .from(users)
      .innerJoin(customers, eq(customers.id, users.customerId))
      .where(eq(users.id, id))
      .limit(1)
    const finalRole = current?.profile ?? role
    const [user] = await db
      .update(users)
      .set({ status: 'active', role: finalRole, decidedBy: admin.id, decidedAt: dsql`now()`, updatedAt: dsql`now()` })
      .where(eq(users.id, id))
      .returning(userColumns)
    if (!user) throw notFound()
    await audit({ action: 'admin.user_approved', userId: admin.id, target: id, ip: req.ip, meta: { role } })
    return user
  })

  app.post('/users/:id/reject', async (req) => {
    const admin = req.auth!.user
    const { id } = parse(IdParam, req.params)
    await assertPendingRegistration(id)
    const [user] = await db
      .update(users)
      .set({ status: 'rejected', decidedBy: admin.id, decidedAt: dsql`now()`, updatedAt: dsql`now()` })
      .where(eq(users.id, id))
      .returning(userColumns)
    if (!user) throw notFound()
    await audit({ action: 'admin.user_rejected', userId: admin.id, target: id, ip: req.ip })
    return user
  })

  app.patch('/users/:id', async (req) => {
    const admin = req.auth!.user
    const { id } = parse(IdParam, req.params)
    const patch = parse(
      z.object({ role: Role.optional(), status: z.enum(['active', 'disabled']).optional(), mfaExempt: z.boolean().optional() }),
      req.body,
    )
    if (id === admin.id && (patch.status === 'disabled' || (patch.role && patch.role !== 'admin'))) {
      throw new HttpError(409, 'cannot_demote_self')
    }
    // The Root Administrator keeps its Role and status; its MFA settings follow the usual rules.
    const [target] = await db.select({ isRoot: users.isRoot }).from(users).where(eq(users.id, id)).limit(1)
    if (target && (patch.role !== undefined || patch.status !== undefined)) assertNotRoot(target)
    const [user] = await db
      .update(users)
      .set({ ...patch, updatedAt: dsql`now()` })
      .where(eq(users.id, id))
      .returning(userColumns)
    if (!user) throw notFound()
    // Disabling a User, or making MFA mandatory again, ends their current sessions.
    if (patch.status === 'disabled' || patch.mfaExempt === false) await revokeUserSessions(id)
    await audit({
      action: patch.status === 'disabled' ? 'admin.user_disabled' : 'admin.user_updated',
      userId: admin.id,
      target: id,
      ip: req.ip,
      meta: patch,
    })
    return user
  })

  // Without SMTP, MFA and password recovery go through an Admin.
  app.post('/users/:id/reset-mfa', async (req) => {
    const admin = req.auth!.user
    const { id } = parse(IdParam, req.params)
    const [user] = await db
      .update(users)
      .set({ mfaEnabled: false, mfaSecretEnc: null, mfaLastStep: null, updatedAt: dsql`now()` })
      .where(eq(users.id, id))
      .returning({ id: users.id })
    if (!user) throw notFound()
    await revokeUserSessions(id)
    await audit({ action: 'admin.mfa_reset', userId: admin.id, target: id, ip: req.ip })
    return { ok: true }
  })

  app.post('/users/:id/password-reset', async (req) => {
    const admin = req.auth!.user
    const { id } = parse(IdParam, req.params)
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1)
    if (!user) throw notFound()
    const token = randomToken()
    const expiresAt = new Date(Date.now() + RESET_TTL_MS)
    await db.insert(passwordResets).values({ id: sha256(token), userId: id, createdBy: admin.id, expiresAt })
    await audit({ action: 'admin.password_reset_issued', userId: admin.id, target: id, ip: req.ip })
    // Shown once to the Admin, who hands it to the User over a trusted channel.
    return { url: `${config().APP_ORIGIN}/reset-password#${token}`, expiresAt }
  })

  app.get('/settings', async () => getSettings())

  app.put('/settings', async (req) => {
    const admin = req.auth!.user
    const patch = parse(AppSettings.partial(), req.body)
    const updated = await updateSettings(patch, admin.id)
    await audit({ action: 'admin.settings_updated', userId: admin.id, ip: req.ip, meta: patch })
    return updated
  })
}

/**
 * Approve and Reject decide Registrations only: a User who already has a decision changes through
 * PATCH, where the Root Administrator is protected (ADR 0013).
 */
async function assertPendingRegistration(id: string): Promise<void> {
  const [target] = await db.select({ isRoot: users.isRoot, status: users.status }).from(users).where(eq(users.id, id)).limit(1)
  if (!target) throw notFound()
  assertNotRoot(target)
  if (target.status !== 'pending') throw new HttpError(409, 'not_pending')
}

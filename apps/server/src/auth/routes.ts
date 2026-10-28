import {
  ChangePasswordInput,
  Locale,
  LoginInput,
  PasswordResetInput,
  RegisterInput,
  TotpCodeInput,
  customerNameKey,
  type LoginStep,
  type Me,
} from '@poc-intel/shared'
import { resolveLocale } from '@poc-intel/shared/i18n'
import { and, eq, isNull, sql as dsql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../db/client.js'
import { customers, passwordResets, users, type User } from '../db/schema.js'
import { audit } from '../lib/audit.js'
import { open, safeEqual, seal, sha256 } from '../lib/crypto.js'
import { normalizeAccessKey } from '../customers/access-key.js'
import { HttpError, parse } from '../lib/http.js'
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../lib/password.js'
import { checkTotp, mfaAad, newTotpSecret, totpEnrolment } from '../lib/totp.js'
import { getSettings } from '../settings.js'
import { requireAuth, requirePartialAuth } from './guards.js'
import { createSession, destroySession, revokeUserSessions } from './session.js'

const LOCK_AFTER = 5
const LOCK_BASE_MS = 15 * 60_000
const LOCK_MAX_MS = 24 * 3_600_000
const AUTH_RATE_LIMIT = { rateLimit: { max: 10, timeWindow: '1 minute' } }

export function toMe(user: User): Me {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    locale: user.locale,
    mfaEnabled: user.mfaEnabled,
    mustChangePassword: user.mustChangePassword,
    customerId: user.customerId,
    isRoot: user.isRoot,
  }
}


export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/register', { config: AUTH_RATE_LIMIT }, async (req, reply) => {
    const input = parse(RegisterInput, req.body)
    const { registrationAllowedDomains } = await getSettings()
    const domain = input.email.split('@')[1] ?? ''
    if (registrationAllowedDomains.length > 0 && !registrationAllowedDomains.includes(domain)) {
      throw new HttpError(403, 'registration_domain_not_allowed')
    }
    // A Customer User proves the link with the company name plus the Access Key their SE handed over.
    let customerId: string | null = null
    let role: 'customer' | 'partner' = 'partner'
    if (input.customer) {
      const [customer] = await db.select().from(customers).where(eq(customers.nameKey, customerNameKey(input.customer.name))).limit(1)
      if (!customer || !safeEqual(customer.accessKeyHash, sha256(normalizeAccessKey(input.customer.accessKey)))) {
        throw new HttpError(400, 'customer_key_invalid')
      }
      customerId = customer.id
      // The User takes the Company's Profile as their Role (ADR 0011).
      role = customer.profile
    }
    const inserted = await db
      .insert(users)
      .values({
        email: input.email,
        name: input.name,
        company: input.customer?.name ?? input.company ?? '',
        customerId,
        role,
        passwordHash: await hashPassword(input.password),
        locale: input.locale ?? resolveLocale(req.headers['accept-language']),
      })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id })
    // Same answer whether or not the e-mail already exists, so registration cannot be used to probe accounts.
    if (inserted[0]) await audit({ action: 'auth.registered', userId: inserted[0].id, ip: req.ip })
    return reply.code(202).send({ status: 'pending' })
  })

  app.post('/login', { config: AUTH_RATE_LIMIT }, async (req, reply) => {
    const input = parse(LoginInput, req.body)
    const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1)

    if (!user?.passwordHash) {
      await verifyAgainstDummy(input.password)
      throw new HttpError(401, 'invalid_credentials')
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) throw new HttpError(429, 'locked')

    if (!(await verifyPassword(user.passwordHash, input.password))) {
      const failed = user.failedLogins + 1
      const lockMs = failed >= LOCK_AFTER ? Math.min(LOCK_BASE_MS * 2 ** (failed - LOCK_AFTER), LOCK_MAX_MS) : 0
      await db
        .update(users)
        .set({ failedLogins: failed, lockedUntil: lockMs ? new Date(Date.now() + lockMs) : null })
        .where(eq(users.id, user.id))
      await audit({ action: 'auth.login_failed', userId: user.id, ip: req.ip, meta: { failed } })
      throw new HttpError(401, 'invalid_credentials')
    }

    if (user.status === 'pending') throw new HttpError(403, 'pending')
    if (user.status !== 'active') throw new HttpError(401, 'invalid_credentials')

    await db.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, user.id))
    if (user.mfaExempt) {
      await createSession(reply, req, user.id, true)
      await audit({ action: 'auth.login', userId: user.id, ip: req.ip, meta: { mfaExempt: true } })
      const done: LoginStep = 'done'
      return { step: done, me: toMe(user) }
    }
    // The session is only "partial" until the TOTP step passes.
    await createSession(reply, req, user.id, false)
    const step: LoginStep = user.mfaEnabled ? 'mfa_verify' : 'mfa_setup'
    return { step }
  })

  app.post('/mfa/setup', { config: AUTH_RATE_LIMIT }, async (req) => {
    const { user } = requirePartialAuth(req)
    if (user.mfaEnabled) throw new HttpError(409, 'mfa_already_enabled')
    const secret = newTotpSecret()
    await db.update(users).set({ mfaSecretEnc: seal(secret, mfaAad(user.id)) }).where(eq(users.id, user.id))
    return totpEnrolment(secret, user.email)
  })

  app.post('/mfa/verify', { config: AUTH_RATE_LIMIT }, async (req, reply) => {
    const { user, session } = requirePartialAuth(req)
    const { code } = parse(TotpCodeInput, req.body)
    if (!user.mfaSecretEnc) throw new HttpError(409, 'mfa_not_set_up')

    const step = await checkTotp(open(user.mfaSecretEnc, mfaAad(user.id)), code, user.mfaLastStep)
    if (step === null) throw new HttpError(401, 'invalid_code')

    await db.update(users).set({ mfaEnabled: true, mfaLastStep: step }).where(eq(users.id, user.id))
    if (!user.mfaEnabled) await audit({ action: 'auth.mfa_enabled', userId: user.id, ip: req.ip })

    // New session id on privilege change (prevents session fixation).
    await destroySession(reply, session.id)
    await createSession(reply, req, user.id, true)
    await audit({ action: 'auth.login', userId: user.id, ip: req.ip })
    const done: LoginStep = 'done'
    return { step: done, me: toMe({ ...user, mfaEnabled: true }) }
  })

  app.post('/logout', async (req, reply) => {
    if (req.auth) await audit({ action: 'auth.logout', userId: req.auth.user.id, ip: req.ip })
    await destroySession(reply, req.auth?.session.id)
    return reply.code(204).send()
  })

  app.get('/me', async (req) => toMe(requireAuth(req, { allowPendingPasswordChange: true }).user))

  app.put('/me/locale', async (req) => {
    const { user } = requireAuth(req, { allowPendingPasswordChange: true })
    const { locale } = parse(z.object({ locale: Locale }), req.body)
    await db.update(users).set({ locale, updatedAt: dsql`now()` }).where(eq(users.id, user.id))
    return { locale }
  })

  app.post('/password', { config: AUTH_RATE_LIMIT }, async (req) => {
    const { user, session } = requireAuth(req, { allowPendingPasswordChange: true })
    const input = parse(ChangePasswordInput, req.body)
    if (!user.passwordHash || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw new HttpError(401, 'invalid_credentials')
    }
    if (input.newPassword === input.currentPassword) throw new HttpError(400, 'password_unchanged')
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(input.newPassword), mustChangePassword: false, updatedAt: dsql`now()` })
      .where(eq(users.id, user.id))
    await revokeUserSessions(user.id, session.id)
    await audit({ action: 'auth.password_changed', userId: user.id, ip: req.ip })
    return { ok: true }
  })

  app.post('/password-reset', { config: AUTH_RATE_LIMIT }, async (req) => {
    const input = parse(PasswordResetInput, req.body)
    const [reset] = await db
      .update(passwordResets)
      .set({ usedAt: dsql`now()` })
      .where(and(eq(passwordResets.id, sha256(input.token)), isNull(passwordResets.usedAt), dsql`${passwordResets.expiresAt} > now()`))
      .returning({ userId: passwordResets.userId })
    if (!reset) throw new HttpError(400, 'invalid_or_expired_token')
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(input.newPassword), failedLogins: 0, lockedUntil: null, updatedAt: dsql`now()` })
      .where(eq(users.id, reset.userId))
    await revokeUserSessions(reset.userId)
    await audit({ action: 'auth.password_reset', userId: reset.userId, ip: req.ip })
    return { ok: true }
  })
}

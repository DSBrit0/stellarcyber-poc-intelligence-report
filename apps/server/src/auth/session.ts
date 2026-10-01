import { and, eq, sql as dsql } from 'drizzle-orm'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { config } from '../config.js'
import { db } from '../db/client.js'
import { sessions, users, type Session, type User } from '../db/schema.js'
import { randomToken, sha256 } from '../lib/crypto.js'

// __Host- prefix: the browser only accepts it with Secure, Path=/ and no Domain, so no subdomain can set or read it.
export const SESSION_COOKIE = '__Host-sid'
const TOUCH_EVERY_MS = 60_000

export interface AuthContext {
  user: User
  session: Session
}

export async function createSession(
  reply: FastifyReply,
  req: FastifyRequest,
  userId: string,
  mfaVerified: boolean,
): Promise<void> {
  const token = randomToken()
  const ttlMs = config().SESSION_TTL_HOURS * 3_600_000
  await db.insert(sessions).values({
    id: sha256(token),
    userId,
    mfaVerified,
    ip: req.ip,
    userAgent: (req.headers['user-agent'] ?? '').slice(0, 300),
    expiresAt: new Date(Date.now() + ttlMs),
  })
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: Math.floor(ttlMs / 1000),
  })
}

export async function loadSession(token: string | undefined): Promise<AuthContext | null> {
  if (!token) return null
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sha256(token)))
    .limit(1)
  if (!row) return null

  const now = Date.now()
  const idleMs = config().SESSION_IDLE_MINUTES * 60_000
  if (row.session.expiresAt.getTime() <= now || row.session.lastSeenAt.getTime() + idleMs <= now) {
    await db.delete(sessions).where(eq(sessions.id, row.session.id))
    return null
  }
  if (row.user.status !== 'active') return null

  if (now - row.session.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    await db.update(sessions).set({ lastSeenAt: dsql`now()` }).where(eq(sessions.id, row.session.id))
  }
  return row
}

export async function destroySession(reply: FastifyReply, sessionId: string | undefined): Promise<void> {
  if (sessionId) await db.delete(sessions).where(eq(sessions.id, sessionId))
  reply.clearCookie(SESSION_COOKIE, { path: '/', secure: true, httpOnly: true, sameSite: 'lax' })
}

export async function revokeUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await db
    .delete(sessions)
    .where(exceptSessionId ? and(eq(sessions.userId, userId), dsql`${sessions.id} <> ${exceptSessionId}`) : eq(sessions.userId, userId))
}

export async function purgeExpiredSessions(): Promise<number> {
  const idle = `${config().SESSION_IDLE_MINUTES} minutes`
  const deleted = await db
    .delete(sessions)
    .where(dsql`${sessions.expiresAt} <= now() OR ${sessions.lastSeenAt} <= now() - ${idle}::interval`)
    .returning({ id: sessions.id })
  return deleted.length
}

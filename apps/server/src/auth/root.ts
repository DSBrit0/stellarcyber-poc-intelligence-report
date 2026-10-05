import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import { HttpError } from '../lib/http.js'
import { randomToken } from '../lib/crypto.js'
import { hashPassword } from '../lib/password.js'

/** The Root Administrator (ADR 0013): the built-in Admin account every installation has; it uses MFA like everyone. */
export const ROOT_EMAIL = 'administrator@stellarcyber.ai'
export const ROOT_NAME = 'Administrator'

/** Refuses any change the Root Administrator must never get (Role, status, deletion). */
export function assertNotRoot(user: { isRoot: boolean }): void {
  if (user.isRoot) throw new HttpError(409, 'root_protected')
}

/**
 * A fresh installation gets its Root Administrator at start-up. The first password comes from
 * ROOT_PASSWORD (written to .env by init-env.sh); without it a random one is printed once. Either way
 * it must be changed at the first sign-in.
 */
export async function ensureRootAdministrator(rootPassword: string | undefined): Promise<void> {
  const [root] = await db.select({ id: users.id }).from(users).where(eq(users.isRoot, true)).limit(1)
  if (root) return
  // An installation where another account already uses the e-mail: no Root until an Admin resolves it,
  // rather than a unique-constraint crash at every start.
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, ROOT_EMAIL)).limit(1)
  if (taken) {
    console.warn(`Root Administrator not created: ${ROOT_EMAIL} already belongs to another account.`)
    return
  }
  const password = rootPassword || randomToken(18)
  await db.insert(users).values({
    email: ROOT_EMAIL,
    name: ROOT_NAME,
    role: 'admin',
    status: 'active',
    isRoot: true,
    mustChangePassword: true,
    passwordHash: await hashPassword(password),
  })
  console.log(`Root Administrator created: ${ROOT_EMAIL}.${rootPassword ? ' Password: ROOT_PASSWORD from .env.' : ` One-time password: ${password}`} It must be changed at the first sign-in.`)
}

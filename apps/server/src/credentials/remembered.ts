import { StellarCredential } from '@poc-intel/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { open, seal, sha256 } from '../lib/crypto.js'

// ADR 0009: a Stellar Credential may live in the User's browser for 90 days, sealed by the server
// (AES-256-GCM; the authenticated data binds it to the User) in an HttpOnly cookie scoped to /api.
// Page scripts cannot read it, another User cannot open it, and the database never holds it.

const PREFIX = 'sc_cred_'
export const REMEMBER_DAYS = 90

const cookieName = (instanceUrl: string) => PREFIX + sha256(instanceUrl).slice(0, 16)
const aad = (userId: string) => `cred:${userId}`
const cookieOptions = { path: '/api', httpOnly: true, secure: true, sameSite: 'strict' } as const

interface Sealed {
  instanceUrl: string
  credential: StellarCredential
  savedAt: string
}

export interface RememberedInstance {
  instanceUrl: string
  method: StellarCredential['method']
  savedAt: string
}

export function rememberCredential(reply: FastifyReply, userId: string, instanceUrl: string, credential: StellarCredential): void {
  const payload: Sealed = { instanceUrl, credential, savedAt: new Date().toISOString() }
  reply.setCookie(cookieName(instanceUrl), seal(JSON.stringify(payload), aad(userId)), { ...cookieOptions, maxAge: REMEMBER_DAYS * 24 * 3600 })
}

export function forgetCredential(reply: FastifyReply, instanceUrl: string): void {
  reply.clearCookie(cookieName(instanceUrl), cookieOptions)
}

function openCookie(name: string, value: string, userId: string): Sealed | null {
  try {
    const p = JSON.parse(open(value, aad(userId))) as Sealed
    const credential = StellarCredential.safeParse(p.credential)
    // The name must match the URL inside, so a cookie cannot be replayed under another Instance.
    return credential.success && cookieName(p.instanceUrl) === name ? { ...p, credential: credential.data } : null
  } catch {
    return null // another User's cookie, a rotated ENCRYPTION_KEY, or tampering
  }
}

export function rememberedCredential(req: FastifyRequest, userId: string, instanceUrl: string): StellarCredential | null {
  const name = cookieName(instanceUrl)
  const value = req.cookies[name]
  return value ? (openCookie(name, value, userId)?.credential ?? null) : null
}

/** Instances this User has a remembered credential for, in this browser. */
export function rememberedInstances(req: FastifyRequest, userId: string): RememberedInstance[] {
  return Object.entries(req.cookies)
    .filter(([name, value]) => name.startsWith(PREFIX) && value)
    .map(([name, value]) => openCookie(name, value!, userId))
    .filter((p): p is Sealed => p !== null)
    .map((p) => ({ instanceUrl: p.instanceUrl, method: p.credential.method, savedAt: p.savedAt }))
}

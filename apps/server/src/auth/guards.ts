import type { Role } from '@poc-intel/shared'
import type { FastifyRequest } from 'fastify'
import { HttpError } from '../lib/http.js'
import type { AuthContext } from './session.js'

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null
  }
}

/** Signed in with password but MFA not yet passed: only the MFA routes accept this. */
export function requirePartialAuth(req: FastifyRequest): AuthContext {
  if (!req.auth) throw new HttpError(401, 'unauthenticated')
  return req.auth
}

/**
 * A fully signed-in User. While the User must change their password, only the routes that pass
 * `allowPendingPasswordChange` (me, change password, locale) accept the session.
 */
export function requireAuth(req: FastifyRequest, opts: { allowPendingPasswordChange?: boolean } = {}): AuthContext {
  const auth = requirePartialAuth(req)
  if (!auth.session.mfaVerified) throw new HttpError(401, 'mfa_required')
  if (auth.user.mustChangePassword && !opts.allowPendingPasswordChange) throw new HttpError(403, 'password_change_required')
  return auth
}

export function requireRole(req: FastifyRequest, ...roles: Role[]): AuthContext {
  const auth = requireAuth(req)
  if (!roles.includes(auth.user.role)) throw new HttpError(403, 'forbidden')
  return auth
}

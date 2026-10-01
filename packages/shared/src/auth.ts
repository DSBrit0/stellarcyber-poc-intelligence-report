import { z } from 'zod'
import { Locale, Role, UserStatus } from './domain.js'

export const Email = z.string().trim().toLowerCase().max(254).pipe(z.email())

/** Length over composition rules (NIST SP 800-63B). */
export const Password = z.string().min(12, 'password.tooShort').max(128, 'password.tooLong')

export const RegisterInput = z.object({
  email: Email,
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().max(120).optional(),
  password: Password,
  locale: Locale.optional(),
})
export type RegisterInput = z.infer<typeof RegisterInput>

export const LoginInput = z.object({
  email: Email,
  password: z.string().min(1).max(128),
})
export type LoginInput = z.infer<typeof LoginInput>

export const TotpCodeInput = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
})

export const ChangePasswordInput = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: Password,
})

export const PasswordResetInput = z.object({
  token: z.string().min(20).max(200),
  newPassword: Password,
})

/** What the sign-in flow tells the client to do next. */
export const LoginStep = z.enum(['mfa_setup', 'mfa_verify', 'done'])
export type LoginStep = z.infer<typeof LoginStep>

export const Me = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  role: Role,
  status: UserStatus,
  locale: Locale,
  mfaEnabled: z.boolean(),
  mustChangePassword: z.boolean(),
})
export type Me = z.infer<typeof Me>

/** A Stellar Credential: a Scoped API Key, or a username and token. Never persisted. */
export const StellarCredential = z.discriminatedUnion('method', [
  z.object({ method: z.literal('apiKey'), apiKey: z.string().trim().min(8).max(4096) }),
  z.object({
    method: z.literal('basic'),
    username: z.string().trim().min(1).max(254),
    token: z.string().min(1).max(4096),
  }),
])
export type StellarCredential = z.infer<typeof StellarCredential>

/** Base URL of an Instance: https only, no path, no embedded credentials. */
export const InstanceUrl = z
  .url({ protocol: /^https$/ })
  .transform((raw) => new URL(raw))
  .refine((u) => !u.username && !u.password, 'instanceUrl.credentials')
  .transform((u) => u.origin)

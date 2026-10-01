import { hash, verify } from '@node-rs/argon2'

// Argon2id, OWASP 2025 baseline (m=19 MiB, t=2, p=1).
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS)
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password).catch(() => false)
}

// Burns comparable time when the account does not exist, so response time does not reveal valid e-mails.
const DUMMY = hash('not-a-real-password', OPTIONS)
export async function verifyAgainstDummy(password: string): Promise<false> {
  await verify(await DUMMY, password).catch(() => false)
  return false
}

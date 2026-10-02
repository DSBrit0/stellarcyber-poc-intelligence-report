import { randomBytes } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(() => {
  process.env.APP_ORIGIN = 'https://test.local'
  process.env.DATABASE_URL = 'postgres://unused'
  process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64')
})

/** Minimal reply/request doubles: setCookie stores into a jar that the request then reads. */
function browser() {
  const jar: Record<string, string> = {}
  const reply = { setCookie: (n: string, v: string) => void (jar[n] = v), clearCookie: (n: string) => void delete jar[n] }
  return { jar, reply: reply as never, req: () => ({ cookies: { ...jar } }) as never }
}

describe('remembered credentials (ADR 0009)', async () => {
  const { forgetCredential, rememberCredential, rememberedCredential, rememberedInstances } = await import('./remembered.js')
  const url = 'https://poc.stellarcyber.cloud'
  const cred = { method: 'apiKey' as const, apiKey: 'secret-api-key-123' }

  it('the same User gets the credential back; the cookie does not contain it in clear', () => {
    const b = browser()
    rememberCredential(b.reply, 'user-1', url, cred)
    expect(rememberedCredential(b.req(), 'user-1', url)).toEqual(cred)
    expect(Object.values(b.jar).join()).not.toContain('secret-api-key')
    expect(rememberedInstances(b.req(), 'user-1')).toMatchObject([{ instanceUrl: url, method: 'apiKey' }])
  })

  it('another User signed in on the same browser cannot use it', () => {
    const b = browser()
    rememberCredential(b.reply, 'user-1', url, cred)
    expect(rememberedCredential(b.req(), 'user-2', url)).toBeNull()
    expect(rememberedInstances(b.req(), 'user-2')).toEqual([])
  })

  it('a cookie copied under another Instance name or tampered with is refused', () => {
    const b = browser()
    rememberCredential(b.reply, 'user-1', url, cred)
    const [name, value] = Object.entries(b.jar)[0]!
    const other = browser()
    rememberCredential(other.reply, 'user-1', 'https://other.stellarcyber.cloud', cred)
    const otherName = Object.keys(other.jar)[0]!
    const forged = { cookies: { [otherName]: value } } as never
    expect(rememberedCredential(forged, 'user-1', 'https://other.stellarcyber.cloud')).toBeNull()
    const tampered = { cookies: { [name]: value.slice(0, -4) + 'AAAA' } } as never
    expect(rememberedCredential(tampered, 'user-1', url)).toBeNull()
  })

  it('forget removes it', () => {
    const b = browser()
    rememberCredential(b.reply, 'user-1', url, cred)
    forgetCredential(b.reply, url)
    expect(rememberedCredential(b.req(), 'user-1', url)).toBeNull()
  })
})

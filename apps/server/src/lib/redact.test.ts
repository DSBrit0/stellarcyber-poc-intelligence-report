import { describe, expect, it } from 'vitest'
import { redact } from './redact.js'

describe('redact', () => {
  it('removes secret-like keys at any depth', () => {
    const out = redact({ a: { password: 'x', apiKey: 'k', Authorization: 'Bearer y', nested: [{ token: 't' }] }, user: 'ok' })
    expect(out).toEqual({ a: { password: '[redacted]', apiKey: '[redacted]', Authorization: '[redacted]', nested: [{ token: '[redacted]' }] }, user: 'ok' })
  })

  it('keeps counts under secret-like keys', () => {
    expect(redact({ sessions: 3, mfaEnabled: true })).toEqual({ sessions: 3, mfaEnabled: true })
  })

  it('masks JWTs inside free text, also in long strings', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123'
    expect(redact(`failed with ${jwt}`)).toBe('failed with [jwt]')
    const long = redact(`${jwt} ${'x'.repeat(3000)}`) as string
    expect(long.startsWith('[jwt] ')).toBe(true)
    expect(long.length).toBeLessThanOrEqual(2001)
  })
})

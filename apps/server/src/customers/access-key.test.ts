import { describe, expect, it } from 'vitest'
import { newAccessKey, normalizeAccessKey } from './access-key.js'

describe('access keys', () => {
  it('are XXXX-XXXX-XXXX without look-alike characters', () => {
    for (let i = 0; i < 50; i++) expect(newAccessKey()).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/)
  })
  it('match regardless of case and separators', () => {
    expect(normalizeAccessKey(' abcd-efgh jkmn ')).toBe('ABCDEFGHJKMN')
    expect(normalizeAccessKey('ab-cd')).toBe('ABCD')
  })
})

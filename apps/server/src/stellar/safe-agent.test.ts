import { describe, expect, it } from 'vitest'
import { createIpGuard } from './safe-agent.js'

describe('createIpGuard', () => {
  const allowed = createIpGuard([])
  it('allows public addresses', () => {
    expect(allowed('8.8.8.8')).toBe(true)
    expect(allowed('2606:4700::1111')).toBe(true)
  })
  it('blocks private, loopback, link-local and metadata addresses', () => {
    for (const ip of ['10.30.11.150', '127.0.0.1', '169.254.169.254', '192.168.1.1', '172.16.0.1', '100.64.0.1', '::1', 'fe80::1', '::ffff:10.0.0.1']) {
      expect(allowed(ip), ip).toBe(false)
    }
  })
  it('allows an explicitly allowlisted private range', () => {
    const guard = createIpGuard(['10.50.0.0/16'])
    expect(guard('10.50.1.2')).toBe(true)
    expect(guard('10.30.11.150')).toBe(false)
  })
})

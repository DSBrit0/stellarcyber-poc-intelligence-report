import { describe, expect, it } from 'vitest'
import { RequestStats, endpointGroup } from './request-stats.js'

describe('request stats', () => {
  it('groups paths with ids collapsed', () => {
    expect(endpointGroup('/connect/api/v1/cases/6abdbf2ef273afce702cbe3c/alerts')).toBe('cases/:id/alerts')
    expect(endpointGroup('/connect/api/v1/cases')).toBe('cases')
  })
  it('aggregates counts, retries, status and latency quantiles', () => {
    const s = new RequestStats()
    for (let i = 1; i <= 100; i++) s.record('/connect/api/v1/cases/abcdef0123456789abcd/alerts', i === 100 ? 429 : 200, i, 10, i === 100)
    const e = s.endpoints()['cases/:id/alerts']!
    expect(e).toMatchObject({ requests: 100, retries: 1, bytes: 1000, status: { '200': 99, '429': 1 } })
    expect(e.ms.p50).toBe(51)
    expect(e.ms.p95).toBe(96)
    expect(e.ms.max).toBe(100)
  })
  it('tracks peak in-flight requests', () => {
    const s = new RequestStats()
    const a = s.start()
    const b = s.start()
    a()
    b()
    s.start()
    expect(s.peakInFlight).toBe(2)
  })
})

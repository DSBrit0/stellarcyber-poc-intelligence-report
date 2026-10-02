import { describe, expect, it } from 'vitest'
import { caseStats, median, selectKeyCases, toCaseSummary } from './case-stats.js'

const H = 3_600_000
const raw = (over: Record<string, unknown>) => ({ _id: String(Math.random()), name: 'c', status: 'New', size: 1, created_at: 1_000 * H, acknowledged: 0, closed: 0, ...over })

describe('median', () => {
  it('handles odd, even and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(median([])).toBeNull()
  })
})

describe('toCaseSummary', () => {
  it('maps API fields and treats 0 timestamps as unset', () => {
    const c = toCaseSummary(raw({ _id: 'a', severity: 'Critical', size: 12, score: 88 }))
    expect(c).toMatchObject({ id: 'a', severity: 'critical', alerts: 12, score: 88, acknowledgedAt: null, closedAt: null })
  })
})

describe('caseStats', () => {
  it('aggregates alerts, statuses and median times', () => {
    const cases = [
      raw({ status: 'Resolved', resolution: 'True Positive', size: 10, acknowledged: 1_000 * H + 30 * 60_000, closed: 1_002 * H }),
      raw({ status: 'In Progress', size: 5, acknowledged: 1_000 * H + 10 * 60_000 }),
      raw({ size: 1 }),
    ].map(toCaseSummary)
    const s = caseStats(cases, 3)!
    expect(s).toMatchObject({ cases: 3, total: 3, alerts: 16, handled: 2, closed: 1, medianCloseHours: 2, acknowledged: 2, medianAckMinutes: 20, top5Alerts: 16 })
    expect(s.byStatus).toEqual({ Resolved: 1, 'In Progress': 1, New: 1 })
    expect(s.byResolution).toEqual({ 'True Positive': 1 })
  })
  it('is null without Cases', () => {
    expect(caseStats([], 0)).toBeNull()
  })
})

describe('selectKeyCases', () => {
  it('keeps all Critical and High, the 100 newest Medium, and no Low', () => {
    const cases = [
      ...Array.from({ length: 3 }, () => raw({ severity: 'Critical' })),
      ...Array.from({ length: 2 }, () => raw({ severity: 'High' })),
      ...Array.from({ length: 150 }, (_, i) => raw({ severity: 'Medium', created_at: i })),
      ...Array.from({ length: 5 }, () => raw({ severity: 'Low' })),
    ].map(toCaseSummary)
    const key = selectKeyCases(cases)
    expect(key.filter((c) => c.severity === 'critical')).toHaveLength(3)
    expect(key.filter((c) => c.severity === 'high')).toHaveLength(2)
    const medium = key.filter((c) => c.severity === 'medium')
    expect(medium).toHaveLength(100)
    expect(Math.min(...medium.map((c) => c.createdAt!))).toBe(50)
    expect(key.some((c) => c.severity === 'low')).toBe(false)
  })
})

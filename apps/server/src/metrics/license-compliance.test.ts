import { describe, expect, it } from 'vitest'
import { licenseCompliance, simulateLicense, sustainedLevel, toleranceLimit } from './license-compliance.js'

const series = (values: number[]) =>
  values.map((value, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, value }))

describe('toleranceLimit', () => {
  it('floors integer licenses at 110%', () => {
    expect(toleranceLimit(100, { integer: true })).toBe(110)
    expect(toleranceLimit(15, { integer: true })).toBe(16)
  })
  it('keeps volume licenses continuous', () => {
    expect(toleranceLimit(10, { integer: false })).toBeCloseTo(11)
  })
})

describe('simulateLicense', () => {
  it('reaches Warning after 3 consecutive days above 110%', () => {
    const r = simulateLicense(series([100, 120, 120, 120, 100]), 100, { integer: true })
    expect(r.level).toBe('warning')
    expect(r.longestRun).toEqual({ days: 3, from: '2026-09-02', to: '2026-09-04' })
  })
  it('a day at or below 110% breaks the run', () => {
    const r = simulateLicense(series([120, 120, 110, 120, 120]), 100, { integer: true })
    expect(r.level).toBe('none')
    expect(r.daysAbove).toBe(4)
  })
  it('a zero day is a real count and breaks the run', () => {
    expect(simulateLicense(series([120, 0, 120, 120]), 100, { integer: true }).level).toBe('none')
  })
  it('reaches Violation at 7 and Out of Compliance at 21 days', () => {
    expect(simulateLicense(series(Array(7).fill(200)), 100, { integer: true }).level).toBe('violation')
    expect(simulateLicense(series(Array(21).fill(200)), 100, { integer: true }).level).toBe('ooc')
  })
})

describe('sustainedLevel', () => {
  it('returns the best 3-day window minimum, latest on ties', () => {
    expect(sustainedLevel(series([50, 80, 90, 85, 40, 90, 90, 80]), 3)).toEqual({ level: 80, from: '2026-09-06', to: '2026-09-08' })
  })
  it('is null when the period is shorter than the window', () => {
    expect(sustainedLevel(series([1, 2]), 3)).toBeNull()
  })
})

describe('licenseCompliance', () => {
  it('the recommended license reaches no level in the observed period', () => {
    const days = series([100, 130, 140, 135, 90, 150, 95, 100])
    const result = licenseCompliance(days, { integer: true })
    expect(result.recommended).toBe(130)
    expect(result.scenarios.find((s) => s.key === 'recommended')?.level).toBe('none')
  })
  it('is empty for an empty series', () => {
    expect(licenseCompliance([], { integer: true })).toEqual({ stats: null, recommended: null, recommendedWindow: null, scenarios: [], firstDataDate: null })
  })
  it('measures from the first day with data, leaving out the zeros before onboarding', () => {
    const result = licenseCompliance(series([0, 0, 0, 0, 90, 100, 95, 100, 90]), { integer: true })
    expect(result.firstDataDate).toBe('2026-09-05')
    expect(result.stats).toMatchObject({ days: 5, zeroDays: 0, avg: 95 })
    expect(result.recommended).toBe(95)
    // Averaged over all nine days (53) the average scenario would be a false Warning.
    expect(result.scenarios.find((s) => s.key === 'average')?.license).toBe(95)
    expect(result.scenarios.find((s) => s.key === 'average')?.level).toBe('none')
  })
  it('recommends nothing (null, not 0) when every day is 0', () => {
    const result = licenseCompliance(series([0, 0, 0, 0]), { integer: true })
    expect(result.recommended).toBeNull()
    expect(result.scenarios).toEqual([])
    expect(result.firstDataDate).toBeNull()
    expect(result.stats).toMatchObject({ days: 4, zeroDays: 4, max: 0 })
  })
})

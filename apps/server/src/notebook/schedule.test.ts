import { addMeetingDays, computeSchedule, daysBetween } from '@poc-intel/shared'
import { describe, expect, it } from 'vitest'

// The field team's spreadsheet: PoC starting Monday 24 Aug 2026, 15 milestones.
const DAYS = [1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay()

describe('PoC Schedule', () => {
  it('puts every computed milestone on a Monday, Wednesday or Friday', () => {
    const { dates, completion } = computeSchedule('2026-08-24', DAYS.map((days) => ({ days, dateOverride: null })))
    expect(dates).toEqual([
      '2026-08-24', '2026-08-26', '2026-08-28', '2026-08-31', '2026-09-02', '2026-09-04', '2026-09-07', '2026-09-09',
      '2026-09-11', '2026-09-14', '2026-09-16', '2026-09-18', '2026-09-21', '2026-09-23', '2026-09-25',
    ])
    expect(completion).toBe('2026-09-25')
    for (const d of dates) expect([1, 3, 5]).toContain(weekday(d))
  })
  it('moves forward to the next Monday, Wednesday or Friday', () => {
    expect(addMeetingDays('2026-08-24', 1)).toBe('2026-08-26') // Tue -> Wed
    expect(addMeetingDays('2026-08-26', 1)).toBe('2026-08-28') // Thu -> Fri
    expect(addMeetingDays('2026-08-28', 1)).toBe('2026-08-31') // Sat -> Mon
    expect(addMeetingDays('2026-08-28', 2)).toBe('2026-08-31') // Sun -> Mon
    expect(addMeetingDays('2026-08-31', 2)).toBe('2026-09-02') // Wed stays
  })
  it('moves only the milestone whose date was set by hand', () => {
    const { dates } = computeSchedule('2026-08-24', [
      { days: 1, dateOverride: null },
      { days: 2, dateOverride: '2026-09-01' }, // a Tuesday, as typed
      { days: 2, dateOverride: null },
    ])
    // The third keeps its suggested date: no second milestone lands where the moved one was.
    expect(dates).toEqual(['2026-08-24', '2026-09-01', '2026-08-28'])
  })
  it('ends the PoC on the last milestone, wherever it was moved', () => {
    const { completion } = computeSchedule('2026-08-24', [
      { days: 1, dateOverride: null },
      { days: 2, dateOverride: '2026-09-09' },
    ])
    expect(completion).toBe('2026-09-09')
  })
  it('counts both ends, so the day column of a date on the timeline is daysBetween(first, date)', () => {
    expect(daysBetween('2026-08-24', '2026-08-24')).toBe(1)
    expect(daysBetween('2026-08-24', '2026-08-28')).toBe(5) // Friday in the 5th column, not on Saturday
  })
})

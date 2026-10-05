/**
 * The PoC Schedule (CONTEXT.md): the suggested dates start on the PoC start date, and each next one
 * falls `days` after the previous suggestion, moved forward to the next Monday, Wednesday or Friday
 * (the field team meets the customer on those days). A date set by hand moves only its own milestone:
 * the others keep their dates.
 */

export interface ScheduleInput {
  days: number
  /** A date set by hand (YYYY-MM-DD); null to compute it. */
  dateOverride: string | null
}

const toDate = (iso: string) => new Date(`${iso}T12:00:00Z`)
const toIso = (d: Date) => d.toISOString().slice(0, 10)

// Days to add to reach the next Monday, Wednesday or Friday, by day of the week (Sunday = 0).
const TO_MEETING_DAY = [1, 0, 1, 0, 1, 0, 2]

/** `iso` plus `days`, moved forward to the next Monday, Wednesday or Friday. */
export function addMeetingDays(iso: string, days: number): string {
  const d = toDate(iso)
  d.setUTCDate(d.getUTCDate() + days)
  d.setUTCDate(d.getUTCDate() + TO_MEETING_DAY[d.getUTCDay()]!)
  return toIso(d)
}

/** The date of each milestone, and the PoC completion date: the date of the last milestone (the closeout). */
export function computeSchedule(startDate: string, milestones: ScheduleInput[]): { dates: string[]; completion: string } {
  const dates: string[] = []
  let suggested = startDate
  for (const m of milestones) {
    dates.push(m.dateOverride ?? suggested)
    suggested = addMeetingDays(suggested, m.days)
  }
  return { dates, completion: dates[dates.length - 1] ?? startDate }
}

/** Calendar days from `start` to `end`, both included. */
export const daysBetween = (start: string, end: string) => Math.round((toDate(end).getTime() - toDate(start).getTime()) / 86_400_000) + 1

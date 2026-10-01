import type { LicenseCompliance } from '@poc-intel/shared'

// Stellar Cyber 7.0 license rules ("Understanding License Compliance"), ported from the previous tool.
// - Every day has a count, 0 included: a 0 day is a real count, not missing data.
// - A level is reached when the license is exceeded by more than 10% on each of N consecutive days;
//   one day at or below 110% breaks the run.
// - The same rules apply to asset counts (integers) and to Licensing Volume (GB/day, continuous).

export const LICENSE_TOLERANCE = 1.1

export const COMPLIANCE_LEVELS = [
  { key: 'warning', days: 3 },
  { key: 'violation', days: 7 },
  { key: 'ooc', days: 21 },
] as const

export interface DailyValue {
  date: string
  value: number
}

type Level = 'none' | (typeof COMPLIANCE_LEVELS)[number]['key']
type Options = { integer: boolean }

const sorted = (days: DailyValue[]) =>
  [...days].filter((d) => d.date).sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ date: d.date.slice(0, 10), value: Number(d.value) || 0 }))

export function dailyStats(days: DailyValue[], { integer }: Options) {
  const list = sorted(days)
  if (list.length === 0) return null
  const values = list.map((d) => d.value)
  const avg = values.reduce((s, v) => s + v, 0) / values.length
  return {
    days: list.length,
    zeroDays: values.filter((v) => v === 0).length,
    min: Math.min(...values),
    avg: integer ? Math.round(avg) : avg,
    max: Math.max(...values),
  }
}

/** Highest value present on each of `n` consecutive days (the best window's minimum); ties keep the latest window. */
export function sustainedLevel(days: DailyValue[], n: number) {
  const list = sorted(days)
  if (list.length < n) return null
  let best: { level: number; from: string; to: string } | null = null
  for (let i = 0; i + n <= list.length; i++) {
    const win = list.slice(i, i + n)
    const level = Math.min(...win.map((d) => d.value))
    if (best === null || level >= best.level) best = { level, from: win[0]!.date, to: win[n - 1]!.date }
  }
  return best
}

/** Daily value above which a license is exceeded. Integer counts: "more than 110%" means more than floor(110%). */
export function toleranceLimit(license: number, { integer }: Options): number {
  const limit = license * LICENSE_TOLERANCE
  return integer ? Math.floor(limit + 1e-9) : limit
}

export function simulateLicense(days: DailyValue[], license: number, opts: Options) {
  const list = sorted(days)
  const limit = toleranceLimit(license, opts)
  let run = 0
  let start = 0
  let daysAbove = 0
  let longest: { days: number; from: string; to: string } | null = null
  list.forEach((d, i) => {
    if (d.value > limit) {
      daysAbove++
      if (run === 0) start = i
      run++
      if (!longest || run > longest.days) longest = { days: run, from: list[start]!.date, to: d.date }
    } else {
      run = 0
    }
  })
  const longestDays = (longest as { days: number } | null)?.days ?? 0
  const reached = [...COMPLIANCE_LEVELS].reverse().find((lv) => longestDays >= lv.days)
  return { license, limit, daysAbove, longestRun: longest, level: (reached?.key ?? 'none') as Level }
}

/**
 * License recommendation after the discovery period: the highest value present on each of 3 consecutive
 * days. With it no 3-day run can exceed 110%, so no level is reached in the observed period.
 */
export function licenseCompliance(days: DailyValue[], opts: Options): LicenseCompliance {
  const stats = dailyStats(days, opts)
  const sustained = sustainedLevel(days, COMPLIANCE_LEVELS[0].days)
  const recommended = sustained?.level ?? null
  const scenarios =
    stats && recommended != null
      ? (
          [
            ['average', stats.avg],
            ['recommended', recommended],
            ['peak', stats.max],
          ] as const
        ).map(([key, license]) => ({ key, ...simulateLicense(days, license, opts) }))
      : []
  return {
    stats,
    recommended,
    recommendedWindow: sustained ? { from: sustained.from, to: sustained.to } : null,
    scenarios,
  }
}

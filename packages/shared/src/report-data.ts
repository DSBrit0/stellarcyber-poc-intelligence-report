import { z } from 'zod'

/**
 * Report Data: the figures one Sync condensed from the Instance API. Frozen once stored:
 * a Report renders it together with the PoC's current details.
 * Bump REPORT_DATA_VERSION on any breaking change and keep a reader for older versions.
 */
export const REPORT_DATA_VERSION = 1

const DailyPoint = z.object({ date: z.iso.date(), value: z.number() })

const ComplianceLevel = z.enum(['none', 'warning', 'violation', 'ooc'])

const LicenseScenario = z.object({
  key: z.enum(['average', 'recommended', 'peak']),
  license: z.number(),
  limit: z.number(),
  daysAbove: z.number(),
  longestRun: z.object({ days: z.number(), from: z.string(), to: z.string() }).nullable(),
  level: ComplianceLevel,
})

const LicenseCompliance = z.object({
  stats: z
    .object({ days: z.number(), zeroDays: z.number(), min: z.number(), avg: z.number(), max: z.number() })
    .nullable(),
  recommended: z.number().nullable(),
  recommendedWindow: z.object({ from: z.string(), to: z.string() }).nullable(),
  scenarios: z.array(LicenseScenario),
})
export type LicenseCompliance = z.infer<typeof LicenseCompliance>

const SeverityCounts = z.object({
  critical: z.number(),
  high: z.number(),
  medium: z.number(),
  low: z.number(),
})

export const ReportData = z.object({
  version: z.literal(REPORT_DATA_VERSION),
  collectedAt: z.iso.datetime(),
  instanceUrl: z.string(),
  tenant: z.object({ id: z.string(), name: z.string() }),
  period: z.object({ start: z.iso.date(), end: z.iso.date() }),
  cases: z.object({ total: z.number(), bySeverity: SeverityCounts }),
  assets: z.object({ daily: z.array(DailyPoint), compliance: LicenseCompliance }),
  volume: z.object({ dailyGb: z.array(DailyPoint), compliance: LicenseCompliance }),
  connectors: z.array(z.object({ id: z.string(), name: z.string(), type: z.string(), active: z.boolean() })),
  dataSensors: z.array(z.object({ id: z.string(), name: z.string(), kind: z.string(), online: z.boolean() })),
  /** Collectors that failed; the Report shows their sections as unavailable. */
  gaps: z.array(z.object({ collector: z.string(), reason: z.string() })),
})
export type ReportData = z.infer<typeof ReportData>

export const SyncProgress = z.object({
  step: z.string(),
  done: z.number(),
  total: z.number(),
})
export type SyncProgress = z.infer<typeof SyncProgress>

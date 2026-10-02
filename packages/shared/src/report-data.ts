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

const Count = z.object({ id: z.string(), name: z.string(), alerts: z.number() })

/** A MITRE ATT&CK or XDR Kill Chain tactic/technique seen in the Alerts of the analysed Cases. */
const DetectionAggregate = z.object({
  id: z.string(),
  name: z.string(),
  tacticId: z.string().optional(),
  tacticName: z.string().optional(),
  caseCount: z.number(),
  alertCount: z.number(),
})

const Severity = z.enum(['critical', 'high', 'medium', 'low'])

/** Case fields kept for the Cases whose Alerts are analysed (Critical, High and the most recent Medium). */
export const CaseSummary = z.object({
  id: z.string(),
  name: z.string(),
  severity: Severity,
  status: z.string(),
  resolution: z.string(),
  score: z.number().nullable(),
  alerts: z.number(),
  createdAt: z.number().nullable(),
  startedAt: z.number().nullable(),
  acknowledgedAt: z.number().nullable(),
  closedAt: z.number().nullable(),
})
export type CaseSummary = z.infer<typeof CaseSummary>

/** Aggregates over every Case of the period (all Severities), not only the analysed ones. */
const CaseStats = z.object({
  cases: z.number(),
  /** Cases the API reports for the period; larger than `cases` when the collection cap was reached. */
  total: z.number(),
  alerts: z.number(),
  byStatus: z.record(z.string(), z.number()),
  byResolution: z.record(z.string(), z.number()),
  handled: z.number(),
  closed: z.number(),
  medianCloseHours: z.number().nullable(),
  acknowledged: z.number(),
  medianAckMinutes: z.number().nullable(),
  /** Alerts in the five largest Cases. */
  top5Alerts: z.number(),
})

const Tactics = z.object({
  mitre: z.object({ tactics: z.array(DetectionAggregate), techniques: z.array(DetectionAggregate) }),
  xdr: z.object({ tactics: z.array(DetectionAggregate), techniques: z.array(DetectionAggregate) }),
  byCase: z.record(z.string(), z.object({ tactics: z.array(Count), xdr: z.array(Count), techniques: z.array(Count) })),
  topAlerts: z.record(z.string(), z.array(z.object({ score: z.number(), description: z.string() }))),
  pages: z.object({ fetched: z.number(), failed: z.number() }),
})

const IngestionEntry = z.object({ id: z.string(), name: z.string(), type: z.string(), bytes: z.number(), events: z.number() })

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
  caseStats: CaseStats.nullable(),
  keyCases: z.array(CaseSummary),
  tactics: Tactics,
  ingestion: z.object({ bySensor: z.array(IngestionEntry), byConnector: z.array(IngestionEntry) }),
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

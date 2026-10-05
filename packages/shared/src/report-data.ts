import { z } from 'zod'

/**
 * Report Data: the figures one Sync condensed from the Instance API. Frozen once stored:
 * a Report renders it together with the PoC's current details.
 * Bump REPORT_DATA_VERSION on any breaking change and keep a reader for older versions.
 */
export const REPORT_DATA_VERSION = 3

export const AI_VERDICTS = ['True Positive', 'False Positive', 'Benign True Positive', 'Benign', 'Inconclusive'] as const
export type AiVerdict = (typeof AI_VERDICTS)[number]
export const AI_TRIAGE_STATUSES = ['ok', 'not_exposed', 'no_cases', 'failed'] as const

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
  /**
   * First day with a value above 0; stats, recommendation and scenarios start there (the days before
   * onboarding are zeros). null when every day is 0. Absent on Report Data from before it was recorded.
   */
  firstDataDate: z.string().nullable().optional(),
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

/** Alerts and Cases per value (a detection source, a Kill Chain stage, an entity…). */
const AlertCaseCount = z.object({ alerts: z.number(), cases: z.number() })

/** A user name, host name or external IP seen in the Alerts of Critical and High Key Cases. */
const EntityCount = AlertCaseCount.extend({ value: z.string() })
const ExternalIpCount = EntityCount.extend({
  /** ISO country code (`*_geo.countryCode`), reputation (`*_reputation`) and ASN organization (`*_asn_org`), first seen. */
  country: z.string().nullable(),
  reputation: z.string().nullable(),
  asnOrg: z.string().nullable(),
})

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
  /** Time of the Case's latest Alert (end_timestamp). */
  endedAt: z.number().nullable().optional(),
  acknowledgedAt: z.number().nullable(),
  closedAt: z.number().nullable(),
  /**
   * Every Alert of the Case when some fall outside the period; `alerts` then counts only the ones
   * inside it (a Case still open keeps collecting Alerts after the period ends).
   */
  alertsAll: z.number().optional(),
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
  /** Alerts of the period's Cases dated outside the period, left out of `alerts`. */
  alertsOutsidePeriod: z.number().optional(),
  /** Cases whose in-period Alert count could not be verified (a failed page); their full size is counted. */
  alertsUnverifiedCases: z.number().optional(),
})

const Tactics = z.object({
  mitre: z.object({ tactics: z.array(DetectionAggregate), techniques: z.array(DetectionAggregate) }),
  xdr: z.object({ tactics: z.array(DetectionAggregate), techniques: z.array(DetectionAggregate) }),
  byCase: z.record(z.string(), z.object({ tactics: z.array(Count), xdr: z.array(Count), techniques: z.array(Count) })),
  topAlerts: z.record(z.string(), z.array(z.object({ score: z.number(), description: z.string() }))),
  /** forbidden = pages the credential may not read (HTTP 403); failed = any other error after retries. */
  pages: z.object({ fetched: z.number(), failed: z.number(), forbidden: z.number() }),
  /** Alerts a Case still references but the index no longer holds (aged out). */
  alertsMissing: z.number(),
  /** Key Cases whose Alerts the credential may not read at all. */
  casesWithoutAlertAccess: z.number(),
  /** Alert documents received (found or not); with alertsMissing gives the share of aged-out Alerts. */
  alertsRead: z.number().optional(),
  /** XDR Kill Chain stage of each Alert (`xdr_event.xdr_killchain_stage`), in Kill Chain order. */
  killChain: z.array(AlertCaseCount.extend({ stage: z.string() })).optional(),
  /** Alerts per data source (`msg_origin.source`/`vendor`/`product`), most Alerts first. */
  sources: z
    .array(AlertCaseCount.extend({ source: z.string(), vendor: z.string(), product: z.string(), criticalHighCases: z.number() }))
    .optional(),
  /**
   * Alerts per engine (`engid`/`engid_name`), most Alerts first. `sensorId` is set when the engine is a
   * Data Sensor (joins ingestion.bySensor[].id); `connector` when it is a Connector (joins connectors[].name
   * and ingestion.byConnector[].name), matched by `msg_origin.processor.id` or by engid = "{type}_{name}".
   */
  engines: z
    .array(
      AlertCaseCount.extend({
        id: z.string(),
        name: z.string(),
        processorId: z.string().nullable(),
        criticalHighCases: z.number(),
        sensorId: z.string().nullable().optional(),
        connector: z.string().nullable().optional(),
      }),
    )
    .optional(),
  /** Most frequent entities (top 10 each) in the Alerts of Critical and High Key Cases. */
  entities: z
    .object({ users: z.array(EntityCount), hosts: z.array(EntityCount), externalIps: z.array(ExternalIpCount) })
    .optional(),
  /**
   * Top 2 entities of each Critical/High Key Case, for the threat cards. Capped: the Cases with an Auto Triage
   * True Positive first, then by Severity, score and Alerts.
   */
  entitiesByCase: z
    .record(z.string(), z.object({ users: z.array(z.string()), hosts: z.array(z.string()), externalIps: z.array(z.string()) }))
    .optional(),
  /** Median `stellar.detection_time` (ms) over the Key Cases' Alerts of the period; absent when no Alert has it. */
  detectionLatency: z.object({ medianMs: z.number(), alerts: z.number() }).optional(),
})

/** `known` is false when the entry's sensor/connector no longer exists (ingestion history outlives it). */
const IngestionEntry = z.object({ id: z.string(), name: z.string(), type: z.string(), bytes: z.number(), events: z.number(), known: z.boolean() })

export const ReportData = z.object({
  version: z.literal(REPORT_DATA_VERSION),
  collectedAt: z.iso.datetime(),
  instanceUrl: z.string(),
  tenant: z.object({ id: z.string(), name: z.string() }),
  period: z.object({ start: z.iso.date(), end: z.iso.date() }),
  cases: z.object({ total: z.number(), bySeverity: SeverityCounts }),
  assets: z.object({ daily: z.array(DailyPoint), compliance: LicenseCompliance }),
  volume: z.object({
    dailyGb: z.array(DailyPoint),
    compliance: LicenseCompliance,
    /** Licensing Volume per index over the period (GB), largest first; share is of their sum (0–1). */
    byIndex: z.array(z.object({ index: z.string(), gb: z.number(), share: z.number() })).optional(),
  }),
  connectors: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      category: z.string(),
      active: z.boolean(),
      lastActivity: z.number().nullable(),
      lastDataReceived: z.number().nullable(),
      /** Health reported by the API: code 0 = healthy; message explains anything else. */
      healthCode: z.number().nullable(),
      healthMessage: z.string(),
      /** `is_collect`/`is_respond`: a Responder (webhook, JIRA…) only receives actions and is not a data source. */
      collect: z.boolean().optional(),
      respond: z.boolean().optional(),
      /** Raw bytes ingested in the period (ingestion.byConnector, joined by name); absent when ingestion failed. */
      bytesInPeriod: z.number().optional(),
    }),
  ),
  dataSensors: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.string(),
      version: z.string(),
      status: z.string(),
      online: z.boolean(),
      /** Why the sensor is not healthy ("Disconnected, No activity in…"); empty when healthy. */
      message: z.string().optional(),
      needUpgrade: z.boolean().optional(),
      /** Last statistics received (epoch ms): when the sensor was last seen. */
      lastSeen: z.number().nullable().optional(),
      cpuPct: z.number().nullable().optional(),
      diskPct: z.number().nullable().optional(),
      localIp: z.string().optional(),
      natIp: z.string().optional(),
      profile: z.string().optional(),
    }),
  ),
  caseStats: CaseStats.nullable(),
  keyCases: z.array(CaseSummary),
  tactics: Tactics,
  ingestion: z.object({ bySensor: z.array(IngestionEntry), byConnector: z.array(IngestionEntry) }),
  /**
   * Present when the Owner marked AI Triage as tested. verdicts maps Case id → AI verdict: Key Cases only
   * on older Report Data; every Case of the period with a verdict when `bySeverity` is present.
   */
  aiTriage: z
    .object({
      available: z.boolean(),
      verdicts: z.record(z.string(), z.enum(AI_VERDICTS)),
      /**
       * ok: verdicts collected; not_exposed: the Instance has no Auto Triage endpoint (404/403);
       * no_cases: no Case in the period to triage; failed: the collection failed (a gap).
       * Absent on older Report Data: derive it from `available` and keyCases.
       */
      status: z.enum(AI_TRIAGE_STATUSES).optional(),
      /** Cases sent for a verdict (every Case of the period). */
      requested: z.number().optional(),
      /** Verdicts per Case Severity, over every Case of the period. */
      bySeverity: z.record(Severity, z.partialRecord(z.enum(AI_VERDICTS), z.number())).optional(),
    })
    .nullable(),
  /** Collectors that failed; the Report shows their sections as unavailable. */
  gaps: z.array(z.object({ collector: z.string(), reason: z.string() })),
  /**
   * The PoC Notebook's Success Criteria with their status, frozen when the Sync ran (ADR 0010); absent
   * for a PoC without a Notebook and for Report Data collected before it existed.
   */
  notebookCriteria: z
    .array(z.object({ text: z.string(), status: z.enum(['completed_success', 'completed_partial', 'completed_failed', 'ticket_open']).nullable(), notes: z.string() }))
    .optional(),
})
export type ReportData = z.infer<typeof ReportData>

/** The phases of a Sync, in order; the progress bar shows "phase n/5". */
export const SYNC_PHASES = ['connect', 'collect', 'alerts', 'process', 'save'] as const
export type SyncPhase = (typeof SYNC_PHASES)[number]

export const SyncProgress = z.object({
  step: z.string(),
  done: z.number(),
  total: z.number(),
  /** 1-based index in SYNC_PHASES; absent on Syncs from before phases existed. */
  phase: z.number().int().min(1).max(SYNC_PHASES.length).optional(),
})
export type SyncProgress = z.infer<typeof SyncProgress>

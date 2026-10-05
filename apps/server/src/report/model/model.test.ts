import { PocDetails, REPORT_DATA_VERSION, type CaseSummary, type ReportData } from '@poc-intel/shared'
import { fill } from '@poc-intel/shared/i18n/report'
import { describe, expect, it } from 'vitest'
import { aiTriageView, dataSources, deriveReport, isPending, mitreGap } from './derived.js'
import { recommendations } from './recommendations.js'
import { buildStory } from './story.js'

const T0 = Date.parse('2026-09-05T10:00:00Z')

const kase = (id: string, over: Partial<CaseSummary> = {}): CaseSummary => ({
  id,
  name: `Case ${id}`,
  severity: 'critical',
  status: 'New',
  resolution: '',
  score: 80,
  alerts: 3,
  createdAt: T0 + 5 * 60_000,
  startedAt: T0,
  acknowledgedAt: null,
  closedAt: null,
  ...over,
})

const base = (over: Partial<ReportData> = {}): ReportData => ({
  version: REPORT_DATA_VERSION,
  collectedAt: '2026-10-04T12:00:00.000Z',
  instanceUrl: 'https://acme.stellarcyber.cloud',
  tenant: { id: 't1', name: 'ACME' },
  period: { start: '2026-09-05', end: '2026-10-04' },
  cases: { total: 3, bySeverity: { critical: 3, high: 0, medium: 0, low: 0 } },
  assets: { daily: [], compliance: { stats: null, recommended: null, recommendedWindow: null, scenarios: [] } },
  volume: { dailyGb: [], compliance: { stats: null, recommended: null, recommendedWindow: null, scenarios: [] } },
  connectors: [],
  dataSensors: [],
  caseStats: null,
  keyCases: [kase('a'), kase('b'), kase('c')],
  tactics: { mitre: { tactics: [], techniques: [] }, xdr: { tactics: [], techniques: [] }, byCase: {}, topAlerts: {}, pages: { fetched: 0, failed: 0, forbidden: 0 }, alertsMissing: 0, casesWithoutAlertAccess: 0 },
  ingestion: { bySensor: [], byConnector: [] },
  aiTriage: null,
  gaps: [],
  ...over,
})

const details = PocDetails.parse({ customerName: 'ACME' })
const connector = (name: string, over: Partial<ReportData['connectors'][number]> = {}): ReportData['connectors'][number] => ({
  id: name,
  name,
  type: 'office365',
  category: 'saas',
  active: true,
  lastActivity: null,
  lastDataReceived: null,
  healthCode: 0,
  healthMessage: '',
  collect: true,
  respond: false,
  bytesInPeriod: 1000,
  ...over,
})

describe('case statuses', () => {
  it('treats New, In Progress and Escalated as pending; Resolved and Cancelled as done', () => {
    expect(['New', 'In Progress', 'Escalated', ''].map(isPending)).toEqual([true, true, true, true])
    expect(['Resolved', 'Cancelled', 'Closed'].map(isPending)).toEqual([false, false, false])
  })
  it('counts open and resolved Cases of the period with the same rule', () => {
    const data = base({
      caseStats: { cases: 10, total: 10, alerts: 30, byStatus: { New: 4, 'In Progress': 2, Escalated: 1, Resolved: 2, Cancelled: 1 }, byResolution: {}, handled: 6, closed: 3, medianCloseHours: null, acknowledged: 0, medianAckMinutes: null, top5Alerts: 0 },
    })
    const d = deriveReport(data, details)
    expect(d.openCount).toBe(7)
    expect(d.resolvedCount).toBe(3)
  })
})

describe('Auto Triage', () => {
  it('derives the status of older Report Data from `available` and the Cases', () => {
    expect(aiTriageView(base({ aiTriage: { available: true, verdicts: {} } }))?.status).toBe('ok')
    expect(aiTriageView(base({ aiTriage: { available: false, verdicts: {} } }))?.status).toBe('not_exposed')
    expect(aiTriageView(base({ keyCases: [], cases: { total: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 } }, aiTriage: { available: true, verdicts: {} } }))?.status).toBe('no_cases')
    expect(aiTriageView(base({ aiTriage: { available: false, status: 'failed', verdicts: {} } }))?.status).toBe('failed')
  })
  it('counts noise over every triaged Case when verdicts per severity exist', () => {
    const ai = aiTriageView(base({ aiTriage: { available: true, status: 'ok', verdicts: { a: 'False Positive' }, bySeverity: { critical: { 'False Positive': 30, 'True Positive': 3 }, high: {}, medium: {}, low: { Benign: 2 } } } }))!
    expect(ai.triaged).toBe(35)
    expect(ai.noise).toBe(32)
  })
  it('ranks True Positives first and leaves False Positives out of the pending and act-now counts', () => {
    const data = base({
      keyCases: [kase('fp1', { score: 99, alerts: 10 }), kase('fp2', { score: 95, alerts: 10 }), kase('tp', { score: 72, alerts: 10 })],
      caseStats: { cases: 3, total: 3, alerts: 22, byStatus: { New: 3 }, byResolution: {}, handled: 0, closed: 0, medianCloseHours: null, acknowledged: 0, medianAckMinutes: null, top5Alerts: 22 },
      aiTriage: { available: true, status: 'ok', verdicts: { fp1: 'False Positive', fp2: 'False Positive', tp: 'True Positive' } },
    })
    const d = deriveReport(data, details)
    const story = buildStory(data, d)
    expect(story.q2![0]!.id).toBe('tp')
    expect(story.q2![0]!.verdict).toBe('True Positive')
    expect(story.q1!.pending).toBe(1)
    expect(story.q1!.pendingNoise).toBe(2)
    expect(story.q4.critOpen).toBe(1)
    expect(story.q4.pendingNoise).toBe(2)
    expect(story.q3!.counts.act).toBe(1)
    expect(story.q3!.actNoise).toBe(2)
  })
})

describe('data sources and integration', () => {
  it('counts only sources that sent data, leaves Responders out and reads health codes', () => {
    const data = base({
      connectors: [
        connector('ok'),
        connector('error', { healthCode: 2, healthMessage: 'Internal Connector Error' }),
        connector('silent', { healthCode: 3, healthMessage: 'No data received in the past 24 hours', bytesInPeriod: 0 }),
        connector('jira', { collect: false, respond: true, bytesInPeriod: 0 }),
      ],
    })
    const s = dataSources(data)
    expect(s.connectors.map((c) => c.state)).toEqual(['online', 'error', 'nodata'])
    expect(s.responders.map((r) => r.name)).toEqual(['jira'])
    expect(s.integrationPct).toBe(67)
    const recs = recommendations(data, deriveReport(data, details))
    expect(recs.find((r) => r.id === 'connectorErrors')?.vars).toMatchObject({ n: 1 })
    expect(recs.find((r) => r.id === 'staleConnectors')?.vars).toMatchObject({ n: 1, pct: 33 })
  })
  it('has no integration figure without any data source', () => {
    expect(dataSources(base()).integrationPct).toBeNull()
  })
  it('bases the backlog recommendation on the pending Cases of the whole period', () => {
    const data = base({
      caseStats: { cases: 80, total: 80, alerts: 300, byStatus: { New: 60, Resolved: 20 }, byResolution: {}, handled: 20, closed: 20, medianCloseHours: null, acknowledged: 0, medianAckMinutes: null, top5Alerts: 0 },
    })
    expect(recommendations(data, deriveReport(data, details)).find((r) => r.id === 'caseBacklog')?.vars).toEqual({ open: 60 })
  })
})

describe('MITRE coverage gap', () => {
  it('flags coverage as underestimated when more than 20% of the Alerts could not be read', () => {
    const tactics = base().tactics
    expect(mitreGap(base({ tactics: { ...tactics, pages: { fetched: 70, failed: 0, forbidden: 30 } } }))).toBeCloseTo(0.3)
    expect(mitreGap(base({ tactics: { ...tactics, alertsRead: 100, alertsMissing: 10 } }))).toBeNull()
  })
})

describe('fill', () => {
  it('picks the singular or plural form', () => {
    expect(fill('{{n|# case|# cases}} abertos', { n: 1 })).toBe('1 case abertos')
    expect(fill('{{n|# case|# cases}} abertos', { n: '1.234' })).toBe('1.234 cases abertos')
  })
})

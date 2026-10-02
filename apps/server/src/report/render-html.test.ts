import { PocDetails, REPORT_DATA_VERSION, TEMPLATES, type ReportData } from '@poc-intel/shared'
import { describe, expect, it } from 'vitest'
import { licenseCompliance } from '../metrics/license-compliance.js'
import { renderReportHtml } from './render-html.js'

const daily = Array.from({ length: 10 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, value: 100 + i * 5 }))

const data: ReportData = {
  version: REPORT_DATA_VERSION,
  collectedAt: '2026-09-11T12:00:00.000Z',
  instanceUrl: 'https://acme.stellarcyber.cloud',
  tenant: { id: 't1', name: 'ACME Prod' },
  period: { start: '2026-09-01', end: '2026-09-10' },
  cases: { total: 42, bySeverity: { critical: 2, high: 10, medium: 20, low: 10 } },
  assets: { daily, compliance: licenseCompliance(daily, { integer: true }) },
  volume: { dailyGb: daily.map((d) => ({ ...d, value: d.value / 10 })), compliance: licenseCompliance(daily, { integer: false }) },
  connectors: [{ id: 'c1', name: 'O365', type: 'office365', category: 'saas', active: true, lastActivity: null, lastDataReceived: null, healthCode: 0, healthMessage: '' }],
  dataSensors: [{ id: 's1', name: 'ds-01', kind: 'Modular Sensor', version: '6.1.0', status: 'connected', online: true }],
  caseStats: null,
  keyCases: [],
  tactics: { mitre: { tactics: [], techniques: [] }, xdr: { tactics: [], techniques: [] }, byCase: {}, topAlerts: {}, pages: { fetched: 0, failed: 0, forbidden: 0 }, alertsMissing: 0, casesWithoutAlertAccess: 0 },
  ingestion: { bySensor: [], byConnector: [] },
  aiTriage: null,
  gaps: [],
}
const details = PocDetails.parse({ customerName: 'ACME <Corp>', verdict: 'approved', comments: 'Great results' })

describe('renderReportHtml', () => {
  for (const template of TEMPLATES) {
    it(`renders the ${template} Template as a self-contained document`, () => {
      const html = renderReportHtml(data, details, template, 'pt-BR')
      expect(html.startsWith('<!doctype html>')).toBe(true)
      expect(html).toContain('ACME &lt;Corp&gt;')
      expect(html).not.toMatch(/<script|<link|src="http/i)
    })
  }
  it('translates headings', () => {
    expect(renderReportHtml(data, details, 'technical', 'es')).toContain('Resumen')
  })
  it('prints the version and its history', () => {
    const versioning = {
      version: '2.1',
      history: [
        { version: '1.0', date: '2026-09-01T10:00:00Z', author: 'Ana SE', changes: null, first: true, period: null },
        { version: '2.0', date: '2026-09-10T10:00:00Z', author: 'Ana SE', changes: null, first: false, period: { start: '2026-09-01', end: '2026-09-09' } },
        { version: '2.1', date: '2026-09-11T10:00:00Z', author: 'Cliente X', changes: 'Ajuste <do> escopo', first: false, period: null },
      ],
    }
    const html = renderReportHtml(data, details, 'technical', 'pt-BR', { versioning })
    expect(html).toContain('Versão 2.1')
    expect(html).toContain('Versão inicial')
    expect(html).toContain('Nova coleta de dados (01/09/26–09/09/26)')
    expect(html).toContain('Ajuste &lt;do&gt; escopo')
    expect(renderReportHtml(data, details, 'technical', 'pt-BR')).toContain('Versão 1.0')
  })
})

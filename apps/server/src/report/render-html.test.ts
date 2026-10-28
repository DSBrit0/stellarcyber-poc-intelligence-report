import { PocDetails, REPORT_DATA_VERSION, TEMPLATES, type ReportData } from '@poc-intel/shared'
import { describe, expect, it } from 'vitest'
import { licenseCompliance } from '../metrics/license-compliance.js'
import { yAxis } from './charts.js'
import { shortClientName } from './context.js'
import { renderReportHtml } from './render-html.js'
import { pageCss } from './styles.js'

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
  it('shows the frozen Notebook criteria with their status in the Technical and Executive Templates only', () => {
    const withNotebook: ReportData = {
      ...data,
      notebookCriteria: [
        { text: 'Detecção de ataques em nuvem', status: 'completed_success', notes: 'Stratus Red Team' },
        { text: 'Integração com AWS', status: null, notes: '' },
      ],
    }
    for (const template of ['technical', 'executive'] as const) {
      const html = renderReportHtml(withNotebook, details, template, 'pt-BR')
      expect(html).toContain('Concluído – sucesso')
      expect(html).toContain('Não avaliado')
      expect(html).toContain('Stratus Red Team')
    }
    expect(renderReportHtml(withNotebook, details, 'insight', 'pt-BR')).not.toContain('Concluído – sucesso')
    // Without a Notebook nothing changes.
    expect(renderReportHtml(data, details, 'technical', 'pt-BR')).not.toContain('Concluído – sucesso')
  })
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
    expect(html).toContain('<b>Versão</b> 2.1')
    expect(html).toContain('Versão inicial')
    expect(html).toContain('Nova coleta de dados (01/09/26–09/09/26)')
    expect(html).toContain('Ajuste &lt;do&gt; escopo')
    expect(renderReportHtml(data, details, 'technical', 'pt-BR')).toContain('<b>Versão</b> 1.0')
  })
  it('states the Auto Triage add-on license only when the Sync collected Auto Triage', () => {
    const without = renderReportHtml(data, details, 'technical', 'pt-BR')
    expect(without).not.toContain('Licença Auto Triage')
    const collected = { ...data, aiTriage: { available: false, verdicts: {} } }
    for (const template of TEMPLATES) {
      const html = renderReportHtml(collected, details, template, 'pt-BR')
      expect(html).toContain('Licença Auto Triage')
      expect(html).toContain('add-on licenciado à parte')
      expect(html).not.toContain('Triagem por IA')
    }
  })
  it('labels the region as where the Instance is provisioned', () => {
    expect(renderReportHtml(data, PocDetails.parse({ customerName: 'X', region: 'Brasil' }), 'technical', 'pt-BR')).toContain('Instância provisionada em')
  })
  it('renders an honest empty Report when the period has no Cases and no data', () => {
    const empty: ReportData = {
      ...data,
      cases: { total: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 } },
      assets: { daily: daily.map((x) => ({ ...x, value: 0 })), compliance: { stats: null, recommended: null, recommendedWindow: null, scenarios: [], firstDataDate: null } },
      volume: { dailyGb: daily.map((x) => ({ ...x, value: 0 })), compliance: { stats: null, recommended: null, recommendedWindow: null, scenarios: [], firstDataDate: null } },
      connectors: [],
      dataSensors: [],
      aiTriage: { available: false, status: 'no_cases', verdicts: {} },
    }
    for (const template of TEMPLATES) {
      const html = renderReportHtml(empty, PocDetails.parse({ customerName: 'ACME' }), template, 'pt-BR')
      expect(html).toContain('nenhum dado foi ingerido')
      expect(html).not.toMatch(/60-80%|mais de \+|Nenhum case detectado/)
    }
    const exec = renderReportHtml(empty, PocDetails.parse({ customerName: 'ACME' }), 'executive', 'pt-BR')
    expect(exec).toContain('Sem cases no período, não há resultados de detecção nem cobertura MITRE ATT&amp;CK a apresentar.')
    expect(exec).toContain('Nenhuma fonte de dados (conector ou sensor) foi configurada no tenant.')
    expect(exec).toContain('Nenhum asset contado no período')
    expect(exec).toContain('Inconclusivo')
    expect(exec).toContain('não houve cases no período para a IA analisar')
    expect(exec).not.toContain('Análise de Cobertura MITRE ATT&amp;CK')
    expect(exec).not.toContain('4.3 Auto Triage')
  })
  it('builds the conclusion from the period numbers only', () => {
    const html = renderReportHtml(data, details, 'executive', 'en')
    expect(html).toContain('the platform correlated 42 cases with 0% MITRE coverage at ACME &lt;Corp&gt;')
    expect(html).not.toMatch(/60-80%|significant reduction in detection time/)
  })
  it('translates Case statuses in the Technical Template and counts In Progress as pending', () => {
    const withCases: ReportData = {
      ...data,
      keyCases: [
        { id: 'k1', name: 'Lateral movement', severity: 'critical', status: 'In Progress', resolution: '', score: 90, alerts: 4, createdAt: Date.parse('2026-09-02T10:00:00Z'), startedAt: Date.parse('2026-09-02T09:58:00Z'), acknowledgedAt: null, closedAt: null },
        { id: 'k2', name: 'Brute force', severity: 'high', status: 'Resolved', resolution: '', score: 70, alerts: 2, createdAt: Date.parse('2026-09-03T10:00:00Z'), startedAt: Date.parse('2026-09-03T10:00:00Z'), acknowledgedAt: null, closedAt: null },
      ],
    }
    const html = renderReportHtml(withCases, details, 'technical', 'pt-BR')
    expect(html).toContain('Em andamento')
    expect(html).toContain('Resolvido')
    expect(html).not.toContain('Analisado')
  })
  it('measures integration by the sources that sent data, not by configured connectors', () => {
    const conns: ReportData = {
      ...data,
      dataSensors: [],
      connectors: [
        { ...data.connectors[0]!, bytesInPeriod: 1e9, collect: true },
        { ...data.connectors[0]!, id: 'c2', name: 'S1', healthCode: 2, healthMessage: 'Internal Connector Error', bytesInPeriod: 0, collect: true },
        { ...data.connectors[0]!, id: 'c3', name: 'JIRA', bytesInPeriod: 0, collect: false, respond: true },
      ],
    }
    const html = renderReportHtml(conns, details, 'technical', 'pt-BR')
    expect(html).toContain('1/2 (50%)')
    expect(html).toMatch(/>erro<\/span><small class="cell-note clamp2">Internal Connector Error</)
    expect(html).toContain('Responders (recebem ações e não enviam dados)')
    expect(html).toContain('1,00 GB')
  })

  it('numbers sections and subsections by render order, without gaps', () => {
    for (const template of TEMPLATES.filter((t) => t !== 'insight')) {
      const html = renderReportHtml(data, details, template, 'pt-BR')
      const sections = [...html.matchAll(/<span class="sec-num">(\d+)<\/span>/g)].map((m) => Number(m[1]))
      expect(sections).toEqual(sections.map((_, i) => i + 1))
      for (const n of sections) {
        const subs = [...html.matchAll(new RegExp(`<h3 class="sub">${n}\\.(\\d+) `, 'g'))].map((m) => Number(m[1]))
        expect(subs).toEqual(subs.map((_, i) => i + 1))
      }
    }
  })

  it('keeps the cover to six stakeholders and uses a short client name in running text', () => {
    const long = PocDetails.parse({
      customerName: 'NetUno — Holding de Serviços Financeiros e Tecnologia Integrada de Grande Porte',
      analysts: Array.from({ length: 9 }, (_, i) => `Analyst ${i + 1}`),
    })
    const html = renderReportHtml(data, long, 'executive', 'pt-BR')
    expect(html).toContain('Analyst 6')
    expect(html).not.toContain('Analyst 7')
    expect(html).toContain('+3 outros')
    expect(html).toContain('@bottom-left{content:"CONFIDENCIAL — NetUno"')
  })

  it('lists the Critical Cases with the highest score first and counts the rest', () => {
    const critical = Array.from({ length: 30 }, (_, i) => ({
      id: `c${i}`, name: `Threat ${i}`, severity: 'critical' as const, status: 'New', resolution: '', score: i, alerts: 1,
      createdAt: Date.parse('2026-09-02T10:00:00Z'), startedAt: null, acknowledgedAt: null, closedAt: null,
    }))
    const html = renderReportHtml({ ...data, cases: { total: 30, bySeverity: { critical: 30, high: 0, medium: 0, low: 0 } }, keyCases: critical }, details, 'technical', 'pt-BR')
    expect(html.indexOf('Threat 29')).toBeLessThan(html.indexOf('Threat 28'))
    expect(html).toContain('class="clamp2" title="Threat 5"')
    expect(html).not.toContain('class="clamp2" title="Threat 4"')
    expect(html).toContain('+5 cases Críticos não listados.')
  })
})

describe('Executive and Technical layout', () => {
  const withCases: ReportData = {
    ...data,
    keyCases: [
      { id: 'k1', name: 'Lateral movement', severity: 'critical', status: 'New', resolution: '', score: 90, alerts: 40, createdAt: Date.parse('2026-09-02T10:00:00Z'), startedAt: null, acknowledgedAt: null, closedAt: null },
    ],
  }
  it('has no ABNT captions, sources or lists of figures and tables', () => {
    for (const template of TEMPLATES) {
      const html = renderReportHtml(withCases, details, template, 'pt-BR')
      expect(html).not.toContain('class="caption"')
      expect(html).not.toContain('class="source"')
      expect(html).not.toContain('Lista de figuras')
      expect(html).not.toContain('Lista de tabelas')
    }
  })
  it('prints the navy bars on Executive and Technical pages only', () => {
    for (const template of ['executive', 'technical'] as const) {
      const html = renderReportHtml(withCases, details, template, 'pt-BR')
      expect(html).toContain(`<main class="report ${template}">`)
      expect(html).toContain('@page report{')
      expect(html).toContain('@top-center{content:"Relatório de Prova de Conceito"')
    }
    expect(renderReportHtml(withCases, details, 'insight', 'pt-BR')).not.toContain('@page report{')
  })
  it('opens with the formal presentation, stating the measured noise reduction', () => {
    const html = renderReportHtml(withCases, details, 'executive', 'pt-BR')
    expect(html).toContain('da plataforma Stellar Cyber Open XDR, executada no ambiente da ACME &lt;Corp&gt;')
    expect(html).toContain('resultando na identificação e agrupamento de 42 cases de segurança.')
    expect(html).not.toContain('mais de +')
    expect(html).toContain('evidenciando a eficiência da solução na redução de 98% do ruído de alertas')
    const quiet = renderReportHtml({ ...withCases, keyCases: withCases.keyCases.map((c) => ({ ...c, alerts: 1 })) }, details, 'executive', 'pt-BR')
    expect(quiet).toContain('MITRE ATT&amp;CK® Enterprise.</p>')
    expect(quiet).not.toContain('ruído de alertas')
  })
  it('says there is no detection result when the period has no Cases', () => {
    const none = renderReportHtml({ ...data, cases: { total: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 } } }, details, 'technical', 'pt-BR')
    expect(none).toContain('foram configuradas 2 fontes de dados no tenant; entretanto, nenhum case de segurança foi criado no período')
  })
})

describe('shortClientName', () => {
  it('keeps short names, else the text before " — ", else the Tenant name', () => {
    expect(shortClientName('ACME', 't')).toBe('ACME')
    expect(shortClientName(`NetUno — ${'x'.repeat(60)}`, 't')).toBe('NetUno')
    expect(shortClientName('y'.repeat(80), 'Tenant')).toBe('Tenant')
    expect(shortClientName('y'.repeat(80), 'z'.repeat(50))).toHaveLength(40)
  })
})

describe('yAxis', () => {
  it('uses whole, evenly spaced ticks for counts', () => {
    expect(yAxis(1)).toEqual({ max: 1, ticks: [0, 1] })
    expect(yAxis(3).ticks).toEqual([0, 1, 2, 3])
    expect(yAxis(37)).toEqual({ max: 40, ticks: [0, 10, 20, 30, 40] })
    expect(yAxis(0.7, false).ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8])
  })
})

describe('pageCss', () => {
  it('writes the footer as an escaped CSS string and an uncounted cover', () => {
    const css = pageCss('A"B</style> · Confidencial')
    expect(css).toContain('content:"A\\"B\\3c /style> · Confidencial"')
    expect(css).not.toContain('</style>')
    expect(css).not.toContain('@page report{')
    expect(css).toContain('@page cover{size:A4;margin:0;counter-increment:page 0}')
  })
  it('puts the Report type, page number and escaped footer in the navy bars', () => {
    const css = pageCss('x', { header: 'Relatório', footer: 'CONFIDENCIAL — A"B</style>' })
    expect(css).toMatch(/@page report\{size:A4;margin:18mm 14mm 16mm;@top-left-corner\{content:url\("data:image\/svg\+xml,/)
    expect(decodeURIComponent(css)).toContain("<rect width='210' height='10' fill='#1f3864'/><rect y='289' width='210' height='8' fill='#1f3864'/>")
    expect(css).toContain('@top-center{content:"Relatório"')
    expect(css).toMatch(/@top-right\{content:counter\(page\);[^}]*color:#fff\}/)
    expect(css).toMatch(/@bottom-right\{content:"© Stellar Cyber, Inc\.";[^}]*margin-top:8mm/)
    expect(css).toContain('@bottom-left{content:"CONFIDENCIAL — A\\"B\\3c /style>"')
    expect(css).not.toContain('</style>')
  })
})

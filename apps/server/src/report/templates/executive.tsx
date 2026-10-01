import { ComplianceTable, Cover, Kpi, Section, SeverityBars, Unavailable, hasGap } from '../components.js'
import type { ReportContext } from '../context.js'

// Template 2 (Executive), carried over from the previous tool: dark cover, executive dashboard,
// Detection Story in 4.1 (ported in a later step), section 8 right after 5.
export function ExecutiveTemplate({ ctx }: { ctx: ReportContext }) {
  const { data, details, t, fmt } = ctx
  const premises = details.effortPremises
  const effortHours = (data.cases.total * premises.minutesPerCase) / 60
  return (
    <main className="report executive">
      <Cover ctx={ctx} variant="dark" />

      <Section id="summary" number="1" title={t('section.executiveSummary')}>
        <div className="kpis">
          <Kpi label={t('metric.cases')} value={fmt.int(data.cases.total)} />
          <Kpi label={t('severity.critical')} value={fmt.int(data.cases.bySeverity.critical)} tone="critical" />
          <Kpi label="h" value={fmt.int(effortHours)} />
        </div>
      </Section>

      <Section id="detection" number="4" title={t('section.detection')}>
        {hasGap(data, 'cases') ? <Unavailable ctx={ctx} /> : <SeverityBars ctx={ctx} />}
      </Section>

      <Section id="license" number="7.3" title={t('section.licenseCompliance')}>
        <ComplianceTable ctx={ctx} compliance={data.assets.compliance} unit="assets" />
      </Section>

      <Section id="conclusion" number="10" title={t('section.conclusion')}>
        {details.verdict ? <p className={`verdict verdict-${details.verdict}`}>{details.verdict}</p> : null}
        {details.comments ? <p className="prose">{details.comments}</p> : null}
      </Section>
    </main>
  )
}

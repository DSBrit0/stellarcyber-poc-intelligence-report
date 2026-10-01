import { ComplianceTable, Cover, Kpi, Section, SeverityBars, Sparkline, Unavailable, hasGap } from '../components.js'
import type { ReportContext } from '../context.js'

// Template 1 (Technical), carried over from the previous tool. Section numbers match the original;
// sections whose collectors are not ported yet (2, 5, 6, 7.1–7.2, 8, 9) are added as they land.
export function TechnicalTemplate({ ctx }: { ctx: ReportContext }) {
  const { data, details, t, fmt } = ctx
  return (
    <main className="report technical">
      <Cover ctx={ctx} variant="light" />

      <Section id="summary" number="1" title={t('section.executiveSummary')}>
        <div className="kpis">
          <Kpi label={t('metric.cases')} value={fmt.int(data.cases.total)} />
          <Kpi label={t('severity.critical')} value={fmt.int(data.cases.bySeverity.critical)} tone="critical" />
          <Kpi label={t('severity.high')} value={fmt.int(data.cases.bySeverity.high)} tone="high" />
          <Kpi label={t('metric.assets')} value={data.assets.compliance.stats ? fmt.int(data.assets.compliance.stats.avg) : '–'} />
        </div>
      </Section>

      <Section id="data-sources" number="3" title={t('section.dataSources')}>
        {hasGap(data, 'connectors') && hasGap(data, 'dataSensors') ? (
          <Unavailable ctx={ctx} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.dataSensors.map((s) => (
                <tr key={`s-${s.id}`}>
                  <td>{s.name}</td>
                  <td>{s.kind}</td>
                  <td>{s.online ? 'online' : 'offline'}</td>
                </tr>
              ))}
              {data.connectors.map((c) => (
                <tr key={`c-${c.id}`}>
                  <td>{c.name}</td>
                  <td>{c.type}</td>
                  <td>{c.active ? 'active' : 'inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section id="detection" number="4" title={t('section.detection')}>
        {hasGap(data, 'cases') ? <Unavailable ctx={ctx} /> : <SeverityBars ctx={ctx} />}
      </Section>

      <Section id="license" number="7.3" title={t('section.licenseCompliance')}>
        <h3>{t('metric.assets')}</h3>
        <Sparkline points={data.assets.daily} />
        <ComplianceTable ctx={ctx} compliance={data.assets.compliance} unit="assets" />
        <h3>{t('metric.volume')}</h3>
        <Sparkline points={data.volume.dailyGb} />
        <ComplianceTable ctx={ctx} compliance={data.volume.compliance} unit="gb" />
      </Section>

      <Section id="conclusion" number="10" title={t('section.conclusion')}>
        {details.verdict ? <p className={`verdict verdict-${details.verdict}`}>{details.verdict}</p> : null}
        {details.comments ? <p className="prose">{details.comments}</p> : null}
      </Section>
    </main>
  )
}

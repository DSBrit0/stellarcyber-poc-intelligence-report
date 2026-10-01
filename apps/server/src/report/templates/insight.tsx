import { ComplianceTable, Kpi, SeverityBars, Sparkline, Unavailable, hasGap } from '../components.js'
import type { ReportContext } from '../context.js'

// Insight: the new Template. One-page-first layout: the outcome and the three numbers a decision-maker
// needs sit above the fold; evidence follows as cards that reflow from three columns to one on a phone.
export function InsightTemplate({ ctx }: { ctx: ReportContext }) {
  const { data, details, t, fmt } = ctx
  return (
    <main className="report insight">
      <header className="hero">
        <div className="hero-kicker">
          {fmt.date(data.period.start)} – {fmt.date(data.period.end)} · {data.tenant.name || data.tenant.id}
        </div>
        <h1>{details.customerName}</h1>
        {details.verdict ? <span className={`pill verdict-${details.verdict}`}>{details.verdict}</span> : null}
        <div className="kpis hero-kpis">
          <Kpi label={t('metric.cases')} value={fmt.int(data.cases.total)} />
          <Kpi label={t('severity.critical')} value={fmt.int(data.cases.bySeverity.critical)} tone="critical" />
          <Kpi
            label={t('metric.recommendedLicense')}
            value={data.assets.compliance.recommended != null ? fmt.int(data.assets.compliance.recommended) : '–'}
            tone="ok"
          />
        </div>
      </header>

      <div className="cards">
        <article className="card">
          <h2>{t('section.detection')}</h2>
          {hasGap(data, 'cases') ? <Unavailable ctx={ctx} /> : <SeverityBars ctx={ctx} />}
        </article>
        <article className="card">
          <h2>{t('metric.assets')}</h2>
          <Sparkline points={data.assets.daily} />
          <ComplianceTable ctx={ctx} compliance={data.assets.compliance} unit="assets" />
        </article>
        <article className="card">
          <h2>{t('metric.volume')}</h2>
          <Sparkline points={data.volume.dailyGb} />
          <ComplianceTable ctx={ctx} compliance={data.volume.compliance} unit="gb" />
        </article>
      </div>

      {details.comments ? (
        <article className="card wide">
          <h2>{t('section.conclusion')}</h2>
          <p className="prose">{details.comments}</p>
        </article>
      ) : null}
    </main>
  )
}

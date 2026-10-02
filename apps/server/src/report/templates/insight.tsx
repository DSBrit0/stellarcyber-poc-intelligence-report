import { C, Donut, Gauge, HBars, Lines } from '../charts.js'
import type { ReportContext } from '../context.js'
import { ScoreBars } from '../sections/overview.js'
import { Card, Grid, Kpis } from '../ui.js'

// Insight — the new Template, built on the same model as Technical/Executive. Decision-first: the
// verdict and the numbers that matter above the fold; evidence as cards that reflow down to one column.
export function InsightTemplate({ rc }: { rc: ReportContext }) {
  const { t, fmt, d, data, details } = rc
  const verdict = details.verdict
  return (
    <main className="report insight">
      <header className="hero">
        <div className="eyebrow">
          {t('coverReportType')} · {fmt.date(data.period.start)} – {fmt.date(data.period.end)} · {data.tenant.name || data.tenant.id}
        </div>
        <h1>{details.customerName}</h1>
        <span className={`verdict-pill verdict-${verdict ?? 'pending'}`}>{verdict ? rc.strings.verdict[verdict] : t('verdictPending')}</span>
        <Kpis
          rc={{ ...rc, template: 'executive' }}
          items={[
            { label: t('kpiCasesDetected'), value: fmt.num(d.totalCases), tone: 'navy' },
            { label: `${t('sevCritical')} + ${t('sevHigh')}`, value: fmt.num(d.critHigh.length), tone: 'crit' },
            { label: t('kpiMitreCov'), value: `${d.mitreCovPct}%`, tone: 'brand' },
            { label: t('kpiAvgEntities'), value: d.assetStats ? fmt.num(d.assetStats.avg) : '—', tone: 'mid' },
            { label: t('metTotalIngested'), value: d.vol ? fmt.vol(d.vol.total) : '—', tone: 'cyan' },
          ]}
        />
      </header>
      <Grid cols={3}>
        <Card title={t('chartMitre')}>
          <Gauge pct={d.mitreCovPct} label={`${d.detectedTactics.size} / 14 ${t('sc_tactics')}`} />
        </Card>
        <Card title={t('t2ChartSevPie')}>
          <Donut
            cutout={0.6}
            center={fmt.num(d.totalCases)}
            sub={t('totalLabel')}
            slices={[
              { label: t('sevCritical'), value: d.crit.length, color: C.critical },
              { label: t('sevHigh'), value: d.high.length, color: C.high },
              { label: t('sevMedium'), value: d.sev.medium, color: C.medium },
              { label: t('sevLow'), value: d.sev.low, color: C.low },
            ]}
          />
        </Card>
        <Card title={t('t2ChartScore')}>
          <ScoreBars rc={rc} />
        </Card>
      </Grid>
      {d.daily.days.length ? (
        <Card wide title={t('t2ChartTrend')}>
          <Lines
            labels={d.daily.days.map((x) => fmt.dayMonth(x))}
            series={[
              { name: t('sevCritical'), values: d.daily.critical, color: C.critical },
              { name: t('sevHigh'), values: d.daily.high, color: C.high },
            ]}
          />
        </Card>
      ) : null}
      <Grid>
        {data.tactics.mitre.techniques.length ? (
          <Card title={t('chartTechniques')}>
            <HBars items={data.tactics.mitre.techniques.slice(0, 8).map((x) => ({ label: fmt.trunc(`${x.id} ${x.name}`, 36), value: x.caseCount }))} />
          </Card>
        ) : null}
        {data.assets.compliance.recommended != null ? (
          <Card title={t('t2ChartAssets')}>
            <Lines
              labels={data.assets.daily.map((x) => fmt.dayMonth(x.date))}
              series={[{ name: t('t2SeriesAssets'), values: data.assets.daily.map((x) => x.value), color: C.brand }]}
              refs={[{ name: `${t('t2SeriesLicense')} (${fmt.num(data.assets.compliance.recommended)})`, value: data.assets.compliance.recommended, color: C.green }]}
            />
          </Card>
        ) : null}
      </Grid>
      {details.comments ? (
        <Card wide title={t('seCommentsTitle')}>
          <p className="body prose">{details.comments}</p>
        </Card>
      ) : null}
    </main>
  )
}

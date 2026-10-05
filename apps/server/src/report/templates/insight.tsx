import { C, Donut, Gauge, HBars, Lines } from '../charts.js'
import type { ReportContext } from '../context.js'
import { conclusionText } from '../sections/closing.js'
import { ScoreBars, summaryText } from '../sections/overview.js'
import { Banner, Card, Grid, Kpis, VolumeNote } from '../ui.js'

/** The Insight is a two-page brief: the SE's comments are cut at this length ("…"); the full text is in the other Templates. */
const COMMENTS_MAX = 650

// Insight — the new Template, built on the same model as Technical/Executive. Decision-first: the
// verdict and the numbers that matter above the fold; evidence as cards that reflow down to one column.
export function InsightTemplate({ rc }: { rc: ReportContext }) {
  const { t, fmt, d, data, details } = rc
  const verdict = details.verdict
  const trend = [...d.daily.critical, ...d.daily.high].some((v) => v > 0)
  return (
    <main className="report insight">
      <header className="hero">
        <div className="eyebrow">
          {t('coverReportType')} · {fmt.date(data.period.start)} – {fmt.date(data.period.end)} · {data.tenant.name || data.tenant.id}
        </div>
        <h1 className="clamp2" title={details.customerName}>
          {details.customerName}
        </h1>
        <span className={`verdict-pill verdict-${verdict ?? 'pending'}`}>{verdict ? rc.strings.verdict[verdict] : d.noCases ? rc.x('verdictInconclusive') : t('verdictPending')}</span>
        <p className="body strong">{summaryText(rc)}</p>
        <Kpis
          rc={{ ...rc, template: 'executive' }}
          items={[
            ...(d.noCases
              ? []
              : [
                  { label: t('kpiCasesDetected'), value: fmt.num(d.totalCases), tone: 'navy' as const },
                  { label: `${t('sevCritical')} + ${t('sevHigh')}`, value: fmt.num(d.sev.critical + d.sev.high), tone: 'crit' as const },
                  { label: t('kpiMitreCov'), value: `${d.mitreCovPct}%`, tone: 'brand' as const },
                ]),
            { label: t('kpiAvgEntities'), value: d.assetStats ? fmt.num(d.assetStats.avg) : '—', tone: 'mid' },
            { label: t('metTotalIngested'), value: d.vol ? fmt.vol(d.volTotal) : '—', tone: 'cyan' },
          ]}
        />
        <VolumeNote rc={rc} />
      </header>
      {d.noCases ? <Banner>{rc.x('noCasesBanner', { start: fmt.date(data.period.start), end: fmt.date(data.period.end) })}</Banner> : null}
      <Grid cols={3}>
        <Card rc={rc} title={t('chartMitre')}>{d.mitreCovPct > 0 ? <Gauge pct={d.mitreCovPct} label={`${d.detectedTactics.size} / 14 ${t('sc_tactics')}`} /> : null}</Card>
        <Card rc={rc} title={t('t2ChartSevPie')}>
          {d.noCases ? null : <Donut
            cutout={0.6}
            center={fmt.num(d.totalCases)}
            sub={t('totalLabel')}
            slices={[
              { label: t('sevCritical'), value: d.sev.critical, color: C.critical },
              { label: t('sevHigh'), value: d.sev.high, color: C.high },
              { label: t('sevMedium'), value: d.sev.medium, color: C.medium },
              { label: t('sevLow'), value: d.sev.low, color: C.low },
            ]}
            format={fmt.num}
          />}
        </Card>
        <Card rc={rc} title={t('t2ChartScore')}>
          <ScoreBars rc={rc} />
        </Card>
      </Grid>
      {trend ? (
        <Card rc={rc} wide title={t('t2ChartTrend')}>
          <Lines
            labels={d.daily.days.map((x) => fmt.dayMonth(x))}
            series={[
              { name: t('sevCritical'), values: d.daily.critical, color: C.critical },
              { name: t('sevHigh'), values: d.daily.high, color: C.high },
            ]}
            yFormat={fmt.num}
          />
        </Card>
      ) : null}
      <Grid>
        {data.tactics.mitre.techniques.length ? (
          <Card rc={rc} title={t('chartTechniques')}>
            <HBars format={fmt.num} items={data.tactics.mitre.techniques.slice(0, 8).map((x) => ({ label: fmt.trunc(`${x.id} ${x.name}`, 60), value: x.caseCount }))} />
          </Card>
        ) : null}
        {!d.assetsZero && data.assets.compliance.recommended != null ? (
          <Card rc={rc} title={t('t2ChartAssets')}>
            <Lines
              labels={data.assets.daily.map((x) => fmt.dayMonth(x.date))}
              series={[{ name: t('t2SeriesAssets'), values: data.assets.daily.map((x) => x.value), color: C.brand }]}
              refs={[{ name: `${t('t2SeriesLicense')} (${fmt.num(data.assets.compliance.recommended)})`, value: data.assets.compliance.recommended, color: C.green }]}
              width={340}
              yFormat={fmt.num}
            />
          </Card>
        ) : null}
      </Grid>
      {/* No numbered sections here: the add-on license note becomes a card. */}
      {d.ai ? (
        <Card rc={rc} wide title={rc.x('licAutoTriageTitle')}>
          <p className="body">{d.ai.status === 'no_cases' ? rc.x('licAutoTriageNoCases') : rc.x('licAutoTriage')}</p>
        </Card>
      ) : null}
      <Card rc={rc} wide title={t('sec10')}>
        <p className="body">{conclusionText(rc)}</p>
      </Card>
      {details.comments ? (
        <Card rc={rc} wide className="breakable" title={t('seCommentsTitle')}>
          <p className="body prose">{fmt.trunc(details.comments, COMMENTS_MAX)}</p>
        </Card>
      ) : null}
    </main>
  )
}

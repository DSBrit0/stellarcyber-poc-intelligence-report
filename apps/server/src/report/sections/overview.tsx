import { C, Bars, Donut, Gauge, HBars, PALETTE } from '../charts.js'
import type { ReportContext } from '../context.js'
import { rate } from '../model/derived.js'
import { Banner, Card, Figure, Grid, Kpis, Muted, Note, P, Section, Sub, Table, VolumeNote } from '../ui.js'

// Cover, sections 1–3 and the architecture page (spec T1.0–T1.3, E.0–E.3).

/** A cover line: names wrap to 2 lines at most, contacts (e-mail, site, phone) stay on 1 line; both end in "…". */
type Line = { text: string | undefined; kind?: 'name' | 'line' }

function InfoBlock({ title, lines, list }: { title: string; lines: Line[]; list?: boolean }) {
  const shown = lines.filter((l) => l.text)
  if (shown.length === 0) return null
  return (
    <div className="info-block">
      <div className="info-title">{title}</div>
      {shown.map((l, i) => (
        <div key={i} className={`${i === 0 && !list ? 'info-strong ' : ''}${l.kind === 'name' ? 'clamp2' : 'clamp1'}`} title={l.text}>
          {l.text}
        </div>
      ))}
    </div>
  )
}

/**
 * The Executive cover's network map: the previous tool's fixed pseudo-random nodes (seed 7) on the 210 × 166 mm
 * dark band, linked when closer than 38 mm, so every Report shows the same texture.
 */
function NetworkTexture() {
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const pts = Array.from({ length: 44 }, () => [210 * 0.35 + rnd() * 210 * 0.7, rnd() * 166] as const)
  const links: string[] = []
  pts.forEach((p, a) =>
    pts.slice(a + 1).forEach((q) => {
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 38) links.push(`M${p[0].toFixed(2)} ${p[1].toFixed(2)}L${q[0].toFixed(2)} ${q[1].toFixed(2)}`)
    }),
  )
  return (
    <svg className="cover-texture" viewBox="0 0 210 166" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path d={links.join('')} stroke="#0e4c6a" strokeWidth="0.2" fill="none" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0].toFixed(2)} cy={p[1].toFixed(2)} r="0.8" fill="#0689aa" />
      ))}
    </svg>
  )
}

/** Stakeholders shown on the cover; the rest are counted ("+{n} others"). */
const COVER_STAKEHOLDERS = 6

export function Cover({ rc }: { rc: ReportContext }) {
  const { details: p, t, fmt, data } = rc
  const exec = rc.template === 'executive'
  const analysts = p.analysts.map((a) => a.trim()).filter(Boolean)
  const shownAnalysts = analysts.slice(0, COVER_STAKEHOLDERS)
  const more = analysts.length - shownAnalysts.length
  return (
    <header className={`cover ${exec ? 'cover-exec' : 'cover-tech'}`}>
      {exec ? <NetworkTexture /> : null}
      <div className="cover-top">
        <div className="brand">
          STELLAR CYBER <span>| Open XDR</span>
        </div>
        <span className="pill">{t('coverConfidential')}</span>
      </div>
      <div className="cover-hero">
        {exec ? <div className="eyebrow">{t('coverReportType')}</div> : null}
        <h1>
          {exec ? t('t2CoverTitle1') : t('coverTitle1')}
          <br />
          {t('coverTitle2')}
        </h1>
        {exec ? (
          p.customerName ? (
            <div className="cover-client clamp2">{[p.customerName, p.department].filter(Boolean).join('  ·  ')}</div>
          ) : null
        ) : (
          <>
            <div className="cover-sub">{t('coverReportType')}</div>
            <div className="cover-rule" />
          </>
        )}
      </div>
      <div className="info-blocks">
        <InfoBlock
          title={t('blockPreparedFor')}
          lines={[
            { text: p.customerName, kind: 'name' },
            { text: p.department, kind: 'name' },
            { text: p.customerEmail },
          ]}
        />
        <InfoBlock
          title={t('blockStellarCyber')}
          lines={[{ text: p.salesEngineer.name, kind: 'name' }, { text: p.salesEngineer.email }, { text: p.salesEngineer.phone }]}
        />
        <InfoBlock
          title={t('blockStakeholders')}
          list
          lines={[...shownAnalysts.map((a) => ({ text: a })), ...(more > 0 ? [{ text: rc.x('stakeholdersMore', { n: fmt.num(more) }) }] : [])]}
        />
        <InfoBlock title={t('blockPartner')} lines={[{ text: p.partner.name, kind: 'name' }, { text: p.partner.email }, { text: p.partner.site }]} />
      </div>
      <div className="cover-foot">
        <b>{t('footerVersion')}</b> {rc.version}
        <i> | </i>
        <b>{t('footerPocPeriod')}</b> {fmt.date(data.period.start)}–{fmt.date(data.period.end)}
        <i> | </i>
        <b>{t('footerReportDate')}</b> {fmt.date(rc.generatedAt)}
      </div>
    </header>
  )
}

/** The customer's short name for running text; the full name appears only on the cover and in the environment table. */
export const clientName = (rc: ReportContext) => rc.client

/** Sources counted in running text: data sources that sent data, else the detection sources seen in the Alerts. */
export function activeSourceCount(rc: ReportContext): number {
  const { d, data } = rc
  return d.sources.withData || data.tactics.sources?.length || d.sources.all.length
}

/** The Insight's one-line lead: a finding with the period's numbers (or why there is none). */
export function summaryText(rc: ReportContext): string {
  const { x, fmt, data, d } = rc
  const vars = {
    startDate: fmt.date(data.period.start),
    endDate: fmt.date(data.period.end),
    connCount: fmt.num(activeSourceCount(rc)),
    caseCount: fmt.num(d.totalCases),
    mitrePct: d.mitreCovPct,
  }
  if (d.noCases) return d.volumeZero && d.sources.withData === 0 ? x('summaryNoData', vars) : x('summaryNoCases', vars)
  return d.critHigh.length || d.sev.critical + d.sev.high > 0 ? x('summaryShort', vars) : x('summaryNoCritHigh', vars)
}

/**
 * The presentation that opens every official Report (1.1): the PoC's purpose, the success criteria, then the
 * period's figures. The alert-noise claim is made only with a measured reduction, and states it; without Cases
 * the second paragraph says there is no detection result.
 */
function presentation(rc: ReportContext): string {
  const { t, x, fmt, data, d } = rc
  const vars = { startDate: fmt.date(data.period.start), endDate: fmt.date(data.period.end) }
  if (d.noCases) return d.sources.all.length ? x('body1_2NoCases', { ...vars, connCount: fmt.num(d.sources.all.length) }) : x('body1_2NoSources', vars)
  const noisePct = d.noise?.pct ?? 0
  return t('body1_2', {
    ...vars,
    connCount: fmt.num(activeSourceCount(rc)),
    caseCount: fmt.num(d.totalCases),
    mitrePct: d.mitreCovPct,
    noiseClause: noisePct > 0 ? x('noiseClause', { noisePct }) : '.',
  })
}

const CRITERIA_PILL = { completed_success: 'good', completed_partial: 'warn', completed_failed: 'bad', ticket_open: '' } as const

/**
 * Context and objectives: the presentation paragraphs with the success criteria between them. With a
 * PoC Notebook, the Technical and Executive Templates show each criterion with its status, as frozen
 * when the Sync ran.
 */
function Context({ rc }: { rc: ReportContext }) {
  const { t, x, details } = rc
  const frozen = rc.template !== 'insight' ? (rc.data.notebookCriteria ?? []) : []
  const criteria = details.successCriteria
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (frozen.length > 0) {
    return (
      <>
        <Sub rc={rc}>{t('sub1_2')}</Sub>
        <P>{`${t('body1_1', { clientName: clientName(rc), client: clientName(rc) })}${x('criteriaLead')}`}</P>
        <Table
          rc={rc}
          compact
          cols={['46%', '22%', '32%']}
          head={[x('criteriaColCriterion'), x('criteriaColStatus'), x('criteriaColNotes')]}
          rows={frozen.map((c) => [
            c.text,
            <span key="s" className={`pill-status ${c.status ? CRITERIA_PILL[c.status] : ''}`}>
              {x(c.status ? `criteriaStatus_${c.status}` : 'criteriaStatus_none')}
            </span>,
            c.notes || '—',
          ])}
        />
        <P>{presentation(rc)}</P>
      </>
    )
  }
  return (
    <>
      <Sub rc={rc}>{t('sub1_2')}</Sub>
      <P>{`${t('body1_1', { clientName: clientName(rc), client: clientName(rc) })}${criteria.length ? x('criteriaLead') : '.'}`}</P>
      {criteria.length ? (
        <ul className="bullets">
          {criteria.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : null}
      <P>{presentation(rc)}</P>
    </>
  )
}

function entDaysNote(rc: ReportContext) {
  const s = rc.d.assetStats
  return s ? rc.t('entitiesDaysNote', { days: s.days, zero: s.zeroDays }) : ''
}

/** "withData/total (pct%)" of the data sources, or "—" without any. */
export function integrationText(rc: ReportContext): string {
  const { d, fmt } = rc
  return d.integrationPct == null ? '—' : `${fmt.num(d.sources.withData)}/${fmt.num(d.sources.all.length)} (${d.integrationPct}%)`
}

/** Technical 1.1 KPI table (the Executive Template shows the same figures as tiles). */
export function KpiTable({ rc }: { rc: ReportContext }) {
  const { t, fmt, d } = rc
  const s = d.assetStats
  const note = entDaysNote(rc)
  const caseRows = d.noCases
    ? []
    : [
        [t('kpiCasesDetected'), fmt.num(d.totalCases), `${fmt.num(d.sev.critical)} ${t('critLabel')}, ${fmt.num(d.sev.high)} ${t('highLabel')}`],
        [t('kpiMitreCov'), `${d.mitreCovPct}% (${d.detectedTactics.size}/14)`, t('kpiMitreNote')],
        [t('kpiOpenCases'), fmt.num(d.openCount), `${fmt.pct(d.openCount, d.statusBase)} ${t('ofTotal')}`],
      ]
  return (
    <Table
      rc={rc}
      caption={rc.x('tabKpis')}
      head={[t('kpiMetric'), t('kpiValue'), t('kpiNotes')]}
      rows={[
        ...caseRows,
        [t('kpiAvgEntities'), s ? fmt.num(s.avg) : '—', `${t('kpiEntitiesNote')}${note ? ` · ${note}` : ''}`],
        [t('kpiMinEntities'), s ? fmt.num(s.min) : '—', t('minEntitiesNote')],
        [t('kpiMaxEntities'), s ? fmt.num(s.max) : '—', t('maxEntitiesNote')],
        [t('kpiActiveConn'), integrationText(rc), t('kpiConnNote')],
      ]}
    />
  )
}

function severitySlices(rc: ReportContext) {
  const { t, d } = rc
  return [
    { label: t('sevCritical'), value: d.sev.critical, color: C.critical },
    { label: t('sevHigh'), value: d.sev.high, color: C.high },
    { label: t('sevMedium'), value: d.sev.medium, color: C.medium },
    { label: t('sevLow'), value: d.sev.low, color: C.low },
  ]
}

/** The Technical sources donut keeps the previous tool's Template 1 order: blue, mid blue, navy, green, orange, yellow, red. */
const TECHNICAL_PALETTE = [C.brand, C.mid, C.navy, C.green, C.orange, C.medium, C.red]

function categorySlices(rc: ReportContext) {
  const palette = rc.template === 'technical' ? TECHNICAL_PALETTE : PALETTE
  return rc.d.connByCategory.map(([k, v], i) => ({ label: k || rc.t('connectorCatOther'), value: v, color: palette[i % palette.length] }))
}

/** KPIs that do not depend on Cases: shown alone (under a banner) when the period has none. */
function sourceKpis(rc: ReportContext) {
  const { t, fmt, d, x } = rc
  return [
    { label: t('kpiAvgEntities'), value: d.assetStats ? fmt.num(d.assetStats.avg) : '—', tone: 'mid' as const, tip: x('kpiTipAssets') },
    { label: t('metTotalIngested'), value: d.vol ? fmt.vol(d.volTotal) : '—', tone: 'cyan' as const, tip: x('kpiTipVolume') },
    { label: t('kpiActiveConn'), value: d.integrationPct == null ? '—' : `${fmt.num(d.sources.withData)}/${fmt.num(d.sources.all.length)}`, tone: 'navy' as const, tip: x('kpiTipConnectors') },
  ]
}

/** The non-Case KPIs and the volume note, left out when none of them has a value. */
function SourceKpis({ rc }: { rc: ReportContext }) {
  const items = sourceKpis(rc)
  if (items.every((k) => k.value === '—')) return null
  return (
    <>
      <Kpis rc={rc} items={items} />
      <VolumeNote rc={rc} />
    </>
  )
}

function NoCasesBanner({ rc }: { rc: ReportContext }) {
  return <Banner>{rc.x('noCasesBanner', { start: rc.fmt.date(rc.data.period.start), end: rc.fmt.date(rc.data.period.end) })}</Banner>
}

/** Technical 1.1: KPI cards and the 2×2 doughnuts. */
function TechnicalKpis({ rc }: { rc: ReportContext }) {
  const { t, fmt, d } = rc
  if (d.noCases) {
    return (
      <div className="page-break">
        <Sub rc={rc}>{t('sub1_1')}</Sub>
        <NoCasesBanner rc={rc} />
        <SourceKpis rc={rc} />
      </div>
    )
  }
  const sevSum = d.sev.critical + d.sev.high + d.sev.medium + d.sev.low
  const statusTotal = d.openCount + d.resolvedCount
  return (
    <div className="page-break">
      <Sub rc={rc}>{t('sub1_1')}</Sub>
      <Kpis
        rc={rc}
        items={[
          { label: t('kpiCasesDetected'), value: fmt.num(d.totalCases), tone: 'brand', tip: rc.x('kpiTipCases') },
          { label: t('kpiCritCases'), value: fmt.num(d.sev.critical), tone: 'crit' },
          { label: t('kpiOpenCases'), value: fmt.num(d.openCount), tone: 'high', tip: `${rc.x('kpiTipOpen')} ${fmt.pct(d.openCount, d.statusBase)}` },
          { label: t('kpiResolvedCases'), value: fmt.num(d.resolvedCount), tone: 'ok' },
          { label: t('kpiAvgEntities'), value: d.assetStats ? fmt.num(d.assetStats.avg) : '—', tone: 'navy', tip: rc.x('kpiTipAssets') },
          { label: t('kpiActiveConn'), value: d.integrationPct == null ? '—' : `${fmt.num(d.sources.withData)}/${fmt.num(d.sources.all.length)}`, tone: 'mid', tip: rc.x('kpiTipConnectors') },
          { label: t('kpiMitreCov'), value: `${d.mitreCovPct}%`, tone: 'brand', tip: rc.x('kpiTipMitre') },
        ]}
      />
      <Grid>
        <Card rc={rc} title={t('chartSeverity')}>{sevSum ? <Donut slices={severitySlices(rc)} center={fmt.num(sevSum)} sub={t('totalLabel')} format={fmt.num} /> : null}</Card>
        <Card rc={rc} title={t('chartStatus')}>
          {d.openCount && d.resolvedCount ? (
            <Donut
              slices={[
                { label: t('statusOpen'), value: d.openCount, color: C.orange },
                { label: t('statusClosed'), value: d.resolvedCount, color: C.mid },
              ]}
              center={fmt.num(d.openCount)}
              sub={`${t('statusOpen').toLowerCase()} · ${fmt.pct(d.openCount, statusTotal)}`}
              format={fmt.num}
            />
          ) : null}
        </Card>
        <Card rc={rc} title={t('chartMitre')}>{d.mitreCovPct > 0 ? <Gauge pct={d.mitreCovPct} label={t('chartMitreLabel')} /> : null}</Card>
        <Card rc={rc} title={t('chartSources')}>
          {d.connByCategory.length ? <Donut slices={categorySlices(rc)} center={fmt.num(d.sources.connectors.length)} sub={t('sourcesLabel')} format={fmt.num} /> : null}
        </Card>
      </Grid>
    </div>
  )
}

/** Detection Capability (average score), Investigation Efficiency, Integration and MITRE as rated bars. */
export function scorecardRows(rc: ReportContext) {
  const { d, x, fmt } = rc
  const rows: { key: 'sc10_1' | 'sc10_2' | 'sc10_4' | 'sc10_6'; pct: number; value: string }[] = []
  if (!d.noCases) {
    rows.push({ key: 'sc10_1', pct: d.avgScore, value: x('scoreAvg', { n: fmt.num(d.avgScore) }) })
    rows.push({ key: 'sc10_2', pct: d.investigation.pct, value: `${d.investigation.pct}%` })
  }
  if (d.integrationPct != null) rows.push({ key: 'sc10_4', pct: d.integrationPct, value: `${d.integrationPct}%` })
  if (!d.noCases) rows.push({ key: 'sc10_6', pct: d.mitreCovPct, value: `${d.mitreCovPct}%` })
  return rows
}

const RATING_KEY = { high: 'ratingHigh', medium: 'ratingMed', low: 'ratingLow' } as const

export function ScoreBars({ rc }: { rc: ReportContext }) {
  const { t } = rc
  const rows = scorecardRows(rc)
  if (rows.length === 0) return null
  return (
    <div className="score-bars">
      {rows.map((r) => {
        const level = rate(r.pct)
        return (
          <div key={r.key} className={`score-row rating-${level}`}>
            <div className="score-head">
              <span>{rc.fmt.trunc(t(r.key), 34)}</span>
              <span>
                {t(RATING_KEY[level])} · {r.value}
              </span>
            </div>
            <div className="score-track">
              <span style={{ width: `${Math.max(0, Math.min(100, r.pct))}%` }} />
            </div>
          </div>
        )
      })}
      <Muted>
        {t('t2ScoreLegendHigh')} · {t('t2ScoreLegendMed')} · {t('t2ScoreLegendLow')}
      </Muted>
    </div>
  )
}

/** The data source with the most raw data received, and its share of everything received. */
export function topSource(rc: ReportContext) {
  const known = rc.d.sources.all.filter((s) => s.bytes != null && s.bytes > 0)
  const total = known.reduce((s, x) => s + x.bytes!, 0)
  const top = [...known].sort((a, b) => b.bytes! - a.bytes!)[0]
  return top && total > 0 ? { name: top.name, pct: Math.round((top.bytes! / total) * 100) } : null
}

function findingItems(rc: ReportContext): string[] {
  const { t, fmt, d, data } = rc
  const items: string[] = []
  const sums = d.daily.days.map((_, i) => (d.daily.critical[i] ?? 0) + (d.daily.high[i] ?? 0))
  const peak = sums.length ? sums.indexOf(Math.max(...sums)) : -1
  if (peak >= 0 && sums[peak]! > 0) items.push(t('t2FindPeak', { n: fmt.num(sums[peak]!), d: fmt.date(d.daily.days[peak]!) }))
  const topTactic = [...data.tactics.mitre.tactics].sort((a, b) => b.alertCount - a.alertCount)[0]
  if (topTactic) items.push(t('t2FindTactic', { t: topTactic.name, a: fmt.num(topTactic.alertCount), c: fmt.num(topTactic.caseCount) }))
  const top = topSource(rc)
  if (top) items.push(t('t2FindSource', { s: top.name, p: top.pct }))
  if (!d.assetsZero && data.assets.compliance.recommended) items.push(t('t2FindLicense', { l: fmt.num(data.assets.compliance.recommended) }))
  if (!d.volumeZero && data.volume.compliance.recommended) items.push(t('t2FindVolume', { l: fmt.vol(data.volume.compliance.recommended) }))
  return items
}

function Findings({ items }: { items: string[] }) {
  return (
    <ul className="bullets findings">
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  )
}

/** Executive 1.1 dashboard. */
function ExecutiveDashboard({ rc }: { rc: ReportContext }) {
  const { t, fmt, d, x } = rc
  const sev = severitySlices(rc)
  const findings = findingItems(rc)
  if (d.noCases) {
    return (
      <>
        <Sub rc={rc}>{t('sub1_1')}</Sub>
        <NoCasesBanner rc={rc} />
        <SourceKpis rc={rc} />
        {findings.length ? (
          <Card rc={rc} figure={false} title={t('t2Findings')}>
            <Findings items={findings} />
          </Card>
        ) : null}
      </>
    )
  }
  const perDay = d.daily.days.length && [...d.daily.critical, ...d.daily.high].some((v) => v > 0)
  return (
    <>
      <Sub rc={rc}>{t('sub1_1')}</Sub>
      <Kpis
        rc={rc}
        items={[
          { label: t('kpiCasesDetected'), value: fmt.num(d.totalCases), tone: 'navy', tip: x('kpiTipCases') },
          { label: x('kpiCritical'), value: fmt.num(d.sev.critical), tone: 'crit' },
          { label: x('kpiHigh'), value: fmt.num(d.sev.high), tone: 'high' },
          { label: `${t('kpiMitreCov')} (${d.detectedTactics.size}/14)`, value: `${d.mitreCovPct}%`, tone: 'brand', tip: x('kpiTipMitre') },
          { label: t('kpiAvgEntities'), value: d.assetStats ? fmt.num(d.assetStats.avg) : '—', tone: 'mid', tip: x('kpiTipAssets') },
          { label: t('metTotalIngested'), value: d.vol ? fmt.vol(d.volTotal) : '—', tone: 'cyan', tip: x('kpiTipVolume') },
        ]}
      />
      <VolumeNote rc={rc} />
      <div className="grid cols-57">
        <Card rc={rc} title={t('t2ChartPerDay')}>
          {perDay ? (
            <Bars
              labels={d.daily.days.map((x) => fmt.dayMonth(x))}
              series={[
                { name: t('sevCritical'), values: d.daily.critical, color: C.critical },
                { name: t('sevHigh'), values: d.daily.high, color: C.high },
              ]}
              width={380}
              height={210}
              yFormat={fmt.num}
            />
          ) : null}
        </Card>
        <Card rc={rc} title={t('t2ChartSevPie')}>{sev.some((s) => s.value > 0) ? <Donut slices={sev} cutout={0} format={fmt.num} /> : null}</Card>
      </div>
      {/* The previous tool's second row: MITRE gauge, scorecard and key findings side by side. */}
      <Grid cols={3}>
        <Card rc={rc} title={t('chartMitre')}>{d.mitreCovPct > 0 ? <Gauge pct={d.mitreCovPct} label={`${d.detectedTactics.size} / 14 ${t('sc_tactics')}`} /> : null}</Card>
        <Card rc={rc} title={t('t2ChartScore')}>
          <ScoreBars rc={rc} />
        </Card>
        <Card rc={rc} figure={false} title={t('t2Findings')}>{findings.length ? <Findings items={findings} /> : null}</Card>
      </Grid>
    </>
  )
}

export function Section1({ rc }: { rc: ReportContext }) {
  const exec = rc.template === 'executive'
  return (
    <Section rc={rc} title={rc.t('sec1')}>
      <Context rc={rc} />
      {exec ? (
        <ExecutiveDashboard rc={rc} />
      ) : (
        <>
          <KpiTable rc={rc} />
          <TechnicalKpis rc={rc} />
        </>
      )}
    </Section>
  )
}

type GoalStatus = 'achieved' | 'partial' | 'notAchieved'
const grade = (v: number | null, ok: (v: number) => boolean, partial: (v: number) => boolean): GoalStatus | null =>
  v == null ? null : ok(v) ? 'achieved' : partial(v) ? 'partial' : 'notAchieved'

/** 2.3 reference targets: the measured value and whether the PoC met it. Case and MITRE rows need Cases. */
export function goals(rc: ReportContext) {
  const { t, d, fmt } = rc
  const rows: { name: string; target: string; result: string; status: GoalStatus | null }[] = []
  if (!d.noCases) {
    rows.push({ name: t('sc1'), target: t('sc1target'), result: `${d.mitreCovPct}%`, status: grade(d.mitreCovPct, (v) => v > 85, (v) => v >= 43) })
    rows.push({
      name: t('sc2'),
      target: t('sc2target'),
      result: d.mttdMinutes == null ? '—' : fmt.dur(d.mttdMinutes),
      status: grade(d.mttdMinutes, (v) => v <= 5, (v) => v <= 15),
    })
  }
  rows.push({ name: t('sc3'), target: t('sc3target'), result: integrationText(rc), status: grade(d.integrationPct, (v) => v >= 100, (v) => v >= 80) })
  if (!d.noCases) {
    rows.push({
      name: t('sc4'),
      target: t('sc4target'),
      result: d.noise ? `${d.noise.pct}% (${fmt.ratio(d.noise.ratio)})` : '—',
      status: grade(d.noise?.pct ?? null, (v) => v > 80, (v) => v >= 50),
    })
  }
  return rows
}

export function Section2({ rc }: { rc: ReportContext }) {
  const { t, x, fmt, d, details: p, data } = rc
  const phases = [1, 2, 3, 4, 5].map((n) => ({ n, name: t(`phase${n}` as 'phase1'), desc: t(`phase${n}desc` as 'phase1desc') }))
  const rows = goals(rc)
  const rated = rows.filter((r) => r.status != null)
  const missed = rated.filter((r) => r.status !== 'achieved')
  const latency = data.tactics.detectionLatency
  const hasGoals = rows.some((r) => r.result !== '—')
  return (
    <Section rc={rc} title={t('sec2')}>
      <Sub rc={rc}>{t('sub2_1')}</Sub>
      <Table
        rc={rc}
        head={[t('envParam'), t('envValue')]}
        rows={[
          [t('envClient'), p.customerName || '—'],
          [t('envDept'), p.department || '—'],
          [t('envSE'), p.salesEngineer.name || '—'],
          [t('envPartner'), p.partner.name || '—'],
          [t('envStart'), fmt.date(data.period.start)],
          [t('envEnd'), fmt.date(data.period.end)],
          [t('envVersion'), p.platformVersion || '—'],
          [t('envRegion'), p.region || '—'],
        ]}
      />
      {hasGoals ? (
        <>
          <Sub rc={rc}>{t('sub2_3')}</Sub>
          {rated.length ? (
            <p className="body strong">
              {missed.length ? x('goalsLead', { met: rated.length - missed.length, total: rated.length, missed: missed.map((r) => r.name).join(', ') }) : x('goalsLeadAll', { total: rated.length })}
            </p>
          ) : null}
          <Table
            rc={rc}
            head={[t('scCriteria'), t('scTarget'), t('scResult'), t('successStatus')]}
            rows={[
              ...rows.map((r) => [
                r.name,
                r.target,
                r.result,
                r.status ? <span className={r.status === 'achieved' ? 'ok strong' : r.status === 'partial' ? 'warn strong' : 'bad strong'}>{t(r.status)}</span> : '—',
              ]),
              ...(latency && !d.noCases ? [[x('latencyLabel'), x('noTarget'), fmt.dur(latency.medianMs / 60_000), '—']] : []),
            ]}
          />
        </>
      ) : null}
      <Sub rc={rc}>{t('sub2_2')}</Sub>
      {rc.template === 'executive' ? (
        <Figure rc={rc} title={t('sub2_2')}>
          <ol className="flow">
            {phases.map((ph) => (
              <li key={ph.n}>
                <div className="chevron">
                  <b>
                    {t('t2PhaseLabel').toUpperCase()} {ph.n}
                  </b>
                  <span>{ph.name.replace(/^\s*\d+\s*[—–-]\s*/, '')}</span>
                </div>
                <p>{ph.desc}</p>
              </li>
            ))}
          </ol>
        </Figure>
      ) : (
        <Table rc={rc} source="static" head={[t('phaseNum'), t('phaseName'), t('phaseDesc')]} rows={phases.map((ph) => [ph.n, ph.name, ph.desc])} />
      )}
    </Section>
  )
}

/** Technical only: the customer's architecture image; the section is left out without one. */
export function ArchitecturePage({ rc, image }: { rc: ReportContext; image: string | null }) {
  if (!image) return null
  return (
    <Section rc={rc} numbered={false} title={rc.t('secArch')}>
      <img className="arch" src={image} alt="" />
    </Section>
  )
}

const STATE_KEY = { online: 'stOnline', offline: 'stOffline', error: 'stError', nodata: 'stNoData' } as const

/** Sensor names repeat (several "modular" appliances): tell them apart by IP. */
function sensorLabel(rc: ReportContext, id: string, name: string): string {
  const all = rc.data.dataSensors
  const s = all.find((x) => x.id === id)
  if (!s || all.filter((x) => x.name === s.name).length < 2) return name
  return `${name} (${s.localIp || s.natIp || id.slice(0, 8)})`
}

/** 3.x Detections by source: Alerts and Cases per engine, joined with the raw data each one sent. */
function DetectionsBySource({ rc }: { rc: ReportContext }) {
  const { x, fmt, data, d } = rc
  if (d.noCases) return null
  const engines = data.tactics.engines ?? []
  const bySensor = new Map(data.ingestion.bySensor.map((s) => [s.id, s.bytes]))
  const connBytes = (name: string) => d.sources.connectors.find((c) => c.name === name)?.bytes ?? data.ingestion.byConnector.find((c) => c.name === name)?.bytes ?? null
  const rows = engines.length
    ? engines.slice(0, 15).map((e) => {
        const sensor = e.sensorId ? data.dataSensors.find((s) => s.id === e.sensorId) : undefined
        const name = e.connector ?? (sensor ? sensorLabel(rc, sensor.id, sensor.name) : e.name)
        const bytes = e.sensorId ? (bySensor.get(e.sensorId) ?? null) : e.connector ? connBytes(e.connector) : null
        return [fmt.trunc(name, 48), bytes == null ? '—' : fmt.bytes(bytes), fmt.num(e.alerts), fmt.num(e.cases), fmt.num(e.criticalHighCases)]
      })
    : (data.tactics.sources ?? []).slice(0, 15).map((s) => [fmt.trunc([s.source, s.vendor, s.product].filter(Boolean).join(' · '), 48), '—', fmt.num(s.alerts), fmt.num(s.cases), fmt.num(s.criticalHighCases)])
  if (rows.length === 0) return null
  return (
    <>
      <Sub rc={rc}>{x('subDetBySource')}</Sub>
      <Table rc={rc} compact cols={['40%', '17%', '13%', '12%', '18%']} head={[x('colSource'), x('colReceived'), x('colAlerts'), rc.t('xtaCases'), x('colCritHigh')]} rows={rows} />
    </>
  )
}

/** Technical 3.3: Data Sensor health and the raw data each one sent. */
function SensorHealth({ rc }: { rc: ReportContext }) {
  const { t, x, fmt, data } = rc
  const ingest = new Map(data.ingestion.bySensor.map((s) => [s.id, s]))
  const known = data.dataSensors.map((s) => {
    const status = s.online ? (
      <span className="ok">{x('stOnline')}</span>
    ) : (
      <>
        <span className="bad strong">{x('stOffline')}</span>
        {s.message ? <small className="cell-note clamp2">{s.message}</small> : null}
      </>
    )
    const version = (
      <>
        {s.version || '—'}
        {s.needUpgrade ? <small className="cell-note warn">{x('upgradePending')}</small> : null}
      </>
    )
    const usage = s.cpuPct != null || s.diskPct != null ? `${s.cpuPct == null ? '—' : `${fmt.dec(s.cpuPct, 0)}%`} / ${s.diskPct == null ? '—' : `${fmt.dec(s.diskPct, 0)}%`}` : '—'
    const bytes = ingest.get(s.id)?.bytes
    return [fmt.trunc(sensorLabel(rc, s.id, s.name), 40), s.kind || '—', status, version, s.lastSeen ? fmt.dayTimeUTC(s.lastSeen) : '—', usage, bytes == null ? '—' : fmt.bytes(bytes)]
  })
  const removed = data.ingestion.bySensor
    .filter((s) => !data.dataSensors.some((x2) => x2.id === s.id))
    .map((s) => [fmt.trunc(`${s.name} (${x('removed')})`, 40), s.type || '—', '—', '—', '—', '—', fmt.bytes(s.bytes)])
  const rows = [...known, ...removed]
  if (rows.length === 0) return null
  return (
    <Table
      rc={rc}
      compact
      className="sensors"
      cols={['17%', '13%', '24%', '13%', '13%', '9%', '11%']}
      head={[t('sensorName'), t('sensorType'), x('colStatus'), x('colVersion'), x('colLastSeen'), x('colCpuDisk'), x('colReceived')]}
      rows={rows}
    />
  )
}

export function Section3({ rc }: { rc: ReportContext }) {
  const { t, x, fmt, d, data } = rc
  const exec = rc.template === 'executive'
  const sensorTypes = new Set(data.dataSensors.map((s) => s.kind)).size // FIX: distinct types, as labelled
  const sensorBytes = data.ingestion.bySensor.reduce((s, x) => s + x.bytes, 0)
  const connectorBytes = d.sources.connectors.reduce((s, c) => s + (c.bytes ?? 0), 0)
  const toGb = (b: number) => b / 1e9
  const src = d.sources
  const noSources = src.all.length === 0
  const top = topSource(rc)
  const sensorsWithData = data.ingestion.bySensor.filter((s) => s.bytes > 0)
  return (
    <Section rc={rc} title={t('sec3')}>
      <Sub rc={rc}>{t('sub3_1')}</Sub>
      {noSources ? null : (
        <p className="body strong">
          {top ? x('sourcesLead', { active: fmt.num(src.withData), total: fmt.num(src.all.length), top: top.name, p: top.pct }) : x('sourcesLeadShort', { active: fmt.num(src.withData), total: fmt.num(src.all.length) })}
        </p>
      )}
      {noSources && !d.vol ? null : (
        <>
          <Kpis
            rc={rc}
            items={[
              { label: t('statTotalSources'), value: fmt.num(src.all.length), tone: 'navy' },
              { label: t('statActiveSources'), value: fmt.num(src.withData), tone: 'ok' },
              { label: t('statTotalIngested'), value: d.vol ? fmt.vol(d.volTotal) : '—', tone: 'brand' },
              { label: t('statSensorTypes'), value: fmt.num(sensorTypes), tone: 'mid' },
            ]}
          />
          <VolumeNote rc={rc} />
        </>
      )}
      {d.outside31 ? <Note>{x('window31')}</Note> : null}
      {exec && !noSources ? (
        <>
          <Grid>
            <Card rc={rc} title={t('t2ChartOrigin')} note={t('t2OriginNote')}>
              {sensorBytes + connectorBytes > 0 ? (
                <Donut
                  cutout={0.58}
                  format={(v) => fmt.gb(v)}
                  slices={[
                    { label: t('t2Sensors'), value: toGb(sensorBytes), color: C.brand },
                    { label: t('t2Connectors'), value: toGb(connectorBytes), color: C.cyan },
                  ]}
                />
              ) : null}
            </Card>
            <Card rc={rc} title={t('t2ChartConnCat')}>{d.connByCategory.length > 1 ? <Donut cutout={0} slices={categorySlices(rc)} format={fmt.num} /> : null}</Card>
          </Grid>
          {sensorsWithData.length ? (
            <Card rc={rc} wide title={t('t2ChartSensorGB')}>
              <HBars
                format={fmt.gb}
                items={[...sensorsWithData]
                  .sort((a, b) => b.bytes - a.bytes)
                  .slice(0, 10)
                  .map((s) => ({ label: fmt.trunc(sensorLabel(rc, s.id, s.name), 28), value: toGb(s.bytes), color: /modular/i.test(s.type) ? C.navy : C.brand }))}
              />
            </Card>
          ) : null}
        </>
      ) : null}

      <Sub rc={rc}>{t('sub3_2')}</Sub>
      {noSources ? (
        <Note>{x('noSources')}</Note>
      ) : src.connectors.length === 0 ? (
        <Note>{x('noConnectorsSensors')}</Note>
      ) : (
        <Table
          rc={rc}
          compact
          cols={exec ? ['32%', '18%', '32%', '18%'] : ['26%', '15%', '29%', '14%', '16%']}
          head={exec ? [t('connName'), t('connType'), t('connStatus'), t('connIngested')] : [t('connName'), t('connType'), t('connStatus'), t('connLastSeen'), t('connIngested')]}
          rows={src.connectors.map((c) => {
            const raw = data.connectors.find((x2) => x2.id === c.id)
            const ingested = c.bytes == null ? '—' : fmt.bytes(c.bytes)
            const name = <span className="clamp2">{c.name}</span>
            const status = (
              <>
                <span className={c.state === 'online' ? 'ok' : 'bad strong'}>{x(STATE_KEY[c.state])}</span>
                {c.reason ? <small className="cell-note clamp2">{c.reason}</small> : null}
              </>
            )
            return exec ? [name, c.type || '—', status, ingested] : [name, c.type || '—', status, fmt.date(raw?.lastDataReceived ?? raw?.lastActivity), ingested]
          })}
        />
      )}
      {src.responders.length ? <Muted>{x('responders', { names: src.responders.map((r) => r.name).join(', ') })}</Muted> : null}

      {exec ? (
        <DetectionsBySource rc={rc} />
      ) : (
        <>
          {data.dataSensors.length || data.ingestion.bySensor.length || data.ingestion.byConnector.length ? (
            <>
              <Sub rc={rc}>{t('sub3_3')}</Sub>
              <SensorHealth rc={rc} />
              {data.ingestion.byConnector.length ? (
                <Table
                  rc={rc}
                  compact
                  caption={x('tabConnIngest')}
                  head={[t('connIngName'), t('connIngBytes')]}
                  rows={data.ingestion.byConnector.map((c) => [fmt.trunc(c.known ? c.name : `${c.name} (${x('removed')})`, 50), fmt.bytes(c.bytes)])}
                />
              ) : null}
            </>
          ) : null}
          <DetectionsBySource rc={rc} />
        </>
      )}
    </Section>
  )
}

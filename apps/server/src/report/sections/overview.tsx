import { C, Bars, Donut, Gauge, HBars, PALETTE } from '../charts.js'
import type { ReportContext } from '../context.js'
import { rate } from '../model/derived.js'
import { Card, Grid, Kpis, Muted, Note, P, Section, Sub, Table } from '../ui.js'

// Cover, sections 1–3 and the architecture page (spec T1.0–T1.3, E.0–E.3).

function InfoBlock({ title, lines }: { title: string; lines: (string | undefined)[] }) {
  const shown = lines.filter(Boolean)
  if (shown.length === 0) return null
  return (
    <div className="info-block">
      <div className="info-title">{title}</div>
      {shown.map((l, i) => (
        <div key={i} className={i === 0 ? 'info-strong' : ''}>
          {l}
        </div>
      ))}
    </div>
  )
}

export function Cover({ rc }: { rc: ReportContext }) {
  const { details: p, t, fmt, data } = rc
  const exec = rc.template === 'executive'
  return (
    <header className={`cover ${exec ? 'cover-exec' : 'cover-tech'}`}>
      <div className="cover-top">
        <div className="brand">
          STELLAR CYBER <span>| ISOC Platform</span>
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
          p.customerName ? <div className="cover-client">{[p.customerName, p.department].filter(Boolean).join('  ·  ')}</div> : null
        ) : (
          <div className="cover-sub">{t('coverReportType')}</div>
        )}
      </div>
      <div className="info-blocks">
        <InfoBlock title={t('blockPreparedFor')} lines={[p.customerName, p.department, p.customerEmail]} />
        <InfoBlock title={t('blockStellarCyber')} lines={[p.salesEngineer.name, p.salesEngineer.email, p.salesEngineer.phone]} />
        <InfoBlock title={t('blockStakeholders')} lines={[p.analysts.filter(Boolean).join('; ')]} />
        <InfoBlock title={t('blockPartner')} lines={[p.partner.name, p.partner.email, p.partner.site]} />
      </div>
      <div className="cover-foot">
        {t('footerVersion')} {p.version || '1.0'} | {t('footerPocPeriod')} {fmt.date(data.period.start)}–{fmt.date(data.period.end)} | {t('footerReportDate')} {fmt.date(rc.generatedAt)}
      </div>
    </header>
  )
}

const clientName = (rc: ReportContext) => rc.details.customerName || rc.t('clientNamePlaceholder')

/** Context paragraph, success criteria and the summary paragraph (1.2, drawn before 1.1). */
function Context({ rc }: { rc: ReportContext }) {
  const { t, fmt, data, d, details } = rc
  const criteria = details.successCriteria
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
  return (
    <>
      <Sub rc={rc}>{t('sub1_2')}</Sub>
      <P>{t('body1_1', { clientName: clientName(rc), client: clientName(rc), pocStartDate: fmt.date(data.period.start), pocEndDate: fmt.date(data.period.end) })}</P>
      {criteria.length ? (
        <>
          <p className="body strong">{t('successCriteriaTitle')}</p>
          <ul className="bullets">
            {criteria.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </>
      ) : null}
      <P>
        {t('body1_2', {
          startDate: fmt.date(data.period.start),
          endDate: fmt.date(data.period.end),
          connCount: data.connectors.length,
          caseCount: d.totalCases,
          mitrePct: d.mitreCovPct,
        })}
      </P>
    </>
  )
}

function entDaysNote(rc: ReportContext) {
  const s = rc.d.assetStats
  return s ? rc.t('entitiesDaysNote', { days: s.days, zero: s.zeroDays }) : ''
}

export function KpiTable({ rc }: { rc: ReportContext }) {
  const { t, fmt, d, data } = rc
  const s = d.assetStats
  const note = entDaysNote(rc)
  return (
    <Table
      head={[t('kpiMetric'), t('kpiValue'), t('kpiNotes')]}
      rows={[
        [t('kpiCasesDetected'), fmt.num(d.totalCases), `${d.crit.length} ${t('critLabel')}, ${d.high.length} ${t('highLabel')}`],
        [t('kpiAvgEntities'), s ? fmt.num(s.avg) : '—', `${t('kpiEntitiesNote')}${note ? ` · ${note}` : ''}`],
        [t('kpiMinEntities'), s ? fmt.num(s.min) : '—', t('minEntitiesNote')],
        [t('kpiMaxEntities'), s ? fmt.num(s.max) : '—', t('maxEntitiesNote')],
        [t('kpiActiveConn'), `${d.activeConnectors} / ${data.connectors.length}`, t('kpiConnNote')],
        [t('kpiMitreCov'), `${d.mitreCovPct}% (${d.detectedTactics.size}/14)`, t('kpiMitreNote')],
        [t('kpiOpenCases'), fmt.num(d.openCount), `${fmt.pct(d.openCount, d.statusBase)} ${t('ofTotal')}`],
      ]}
    />
  )
}

function severitySlices(rc: ReportContext) {
  const { t, d } = rc
  return [
    { label: t('sevCritical'), value: d.crit.length, color: C.critical },
    { label: t('sevHigh'), value: d.high.length, color: C.high },
    { label: t('sevMedium'), value: d.sev.medium, color: C.medium },
    { label: t('sevLow'), value: d.sev.low, color: C.low },
  ]
}

function categorySlices(rc: ReportContext) {
  return rc.d.connByCategory.map(([k, v], i) => ({ label: k || rc.t('connectorCatOther'), value: v, color: PALETTE[i % PALETTE.length] }))
}

/** Technical 1.1: KPI cards and the 2×2 doughnuts. */
function TechnicalKpis({ rc }: { rc: ReportContext }) {
  const { t, fmt, d, data } = rc
  const sevSum = d.crit.length + d.high.length + d.sev.medium + d.sev.low
  const statusTotal = d.openCount + d.resolvedCount
  return (
    <div className="page-break">
      <Sub rc={rc}>{t('sub1_1')}</Sub>
      <Kpis
        rc={rc}
        items={[
          { label: t('kpiCasesDetected'), value: fmt.num(d.totalCases), tone: 'brand', tip: rc.x('kpiTipCases') },
          { label: t('kpiCritCases'), value: String(d.crit.length), tone: 'crit' },
          { label: t('kpiOpenCases'), value: fmt.num(d.openCount), tone: 'high', tip: `${rc.x('kpiTipOpen')} ${fmt.pct(d.openCount, d.statusBase)}` },
          { label: t('kpiResolvedCases'), value: fmt.num(d.resolvedCount), tone: 'ok' },
          { label: t('kpiAvgEntities'), value: d.assetStats ? fmt.num(d.assetStats.avg) : '—', tone: 'navy', tip: rc.x('kpiTipAssets') },
          { label: t('kpiActiveConn'), value: `${d.activeConnectors}/${data.connectors.length}`, tone: 'mid', tip: rc.x('kpiTipConnectors') },
          { label: t('kpiMitreCov'), value: `${d.mitreCovPct}%`, tone: 'brand', tip: rc.x('kpiTipMitre') },
        ]}
      />
      <Grid>
        <Card title={t('chartSeverity')}>{sevSum ? <Donut slices={severitySlices(rc)} center={fmt.num(sevSum)} sub={t('totalLabel')} /> : null}</Card>
        <Card title={t('chartStatus')}>
          {statusTotal ? (
            <Donut
              slices={[
                { label: t('statusOpen'), value: d.openCount, color: C.orange },
                { label: t('statusClosed'), value: d.resolvedCount, color: C.mid },
              ]}
              center={fmt.num(d.openCount)}
              sub={`${t('statusOpen').toLowerCase()} · ${Math.round((d.openCount / statusTotal) * 100)}%`}
            />
          ) : null}
        </Card>
        <Card title={t('chartMitre')}>
          <Gauge pct={d.mitreCovPct} label={t('chartMitreLabel')} />
        </Card>
        <Card title={t('chartSources')}>
          {data.connectors.length ? <Donut slices={categorySlices(rc)} center={fmt.num(data.connectors.length)} sub={t('sourcesLabel')} /> : null}
        </Card>
      </Grid>
    </div>
  )
}

/** Detection Capability, Investigation Efficiency, Integration and MITRE as rated bars. */
export function scorecardRows(rc: ReportContext) {
  const { d } = rc
  return [
    { key: 'sc10_1' as const, pct: d.avgScore },
    { key: 'sc10_2' as const, pct: d.investigation.pct },
    { key: 'sc10_4' as const, pct: d.integrationPct },
    { key: 'sc10_6' as const, pct: d.mitreCovPct },
  ]
}

const RATING_KEY = { high: 'ratingHigh', medium: 'ratingMed', low: 'ratingLow' } as const

function ScoreBars({ rc }: { rc: ReportContext }) {
  const { t } = rc
  return (
    <div className="score-bars">
      {scorecardRows(rc).map((r) => {
        const level = rate(r.pct)
        return (
          <div key={r.key} className={`score-row rating-${level}`}>
            <div className="score-head">
              <span>{rc.fmt.trunc(t(r.key), 34)}</span>
              <span>
                {t(RATING_KEY[level])} · {r.pct}%
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

function Findings({ rc }: { rc: ReportContext }) {
  const { t, fmt, d, data } = rc
  const items: string[] = []
  const sums = d.daily.days.map((_, i) => (d.daily.critical[i] ?? 0) + (d.daily.high[i] ?? 0))
  const peak = sums.length ? sums.indexOf(Math.max(...sums)) : -1
  if (peak >= 0 && sums[peak]! > 0) items.push(t('t2FindPeak', { n: fmt.num(sums[peak]!), d: fmt.date(d.daily.days[peak]!) }))
  const topTactic = [...data.tactics.mitre.tactics].sort((a, b) => b.alertCount - a.alertCount)[0]
  if (topTactic) items.push(t('t2FindTactic', { t: topTactic.name, a: fmt.num(topTactic.alertCount), c: fmt.num(topTactic.caseCount) }))
  const sensorTotal = data.ingestion.bySensor.reduce((s, x) => s + x.bytes, 0)
  const topSensor = [...data.ingestion.bySensor].sort((a, b) => b.bytes - a.bytes)[0]
  if (topSensor && sensorTotal > 0) items.push(t('t2FindSource', { s: topSensor.name || '—', p: Math.round((topSensor.bytes / sensorTotal) * 100) }))
  if (data.assets.compliance.recommended != null) items.push(t('t2FindLicense', { l: fmt.num(data.assets.compliance.recommended) }))
  if (data.volume.compliance.recommended != null) items.push(t('t2FindVolume', { l: fmt.vol(data.volume.compliance.recommended) }))
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
  const { t, fmt, d } = rc
  const sev = severitySlices(rc)
  return (
    <>
      <Sub rc={rc}>{t('sub1_1')}</Sub>
      <Kpis
        rc={rc}
        items={[
          { label: t('kpiCasesDetected'), value: fmt.num(d.totalCases), tone: 'navy', tip: rc.x('kpiTipCases') },
          { label: t('sevCritical'), value: fmt.num(d.crit.length), tone: 'crit' },
          { label: t('sevHigh'), value: fmt.num(d.high.length), tone: 'high' },
          { label: `${t('kpiMitreCov')} (${d.detectedTactics.size}/14)`, value: `${d.mitreCovPct}%`, tone: 'brand', tip: rc.x('kpiTipMitre') },
          { label: t('kpiAvgEntities'), value: d.assetStats ? fmt.num(d.assetStats.avg) : '—', tone: 'mid', tip: rc.x('kpiTipAssets') },
          { label: t('metTotalIngested'), value: d.vol ? fmt.vol(d.vol.total) : '—', tone: 'cyan', tip: rc.x('kpiTipVolume') },
        ]}
      />
      <div className="grid cols-57">
        <Card title={t('t2ChartPerDay')}>
          {d.daily.days.length ? (
            <Bars
              labels={d.daily.days.map((x) => fmt.dayMonth(x))}
              series={[
                { name: t('sevCritical'), values: d.daily.critical, color: C.critical },
                { name: t('sevHigh'), values: d.daily.high, color: C.high },
              ]}
            />
          ) : null}
        </Card>
        <Card title={t('t2ChartSevPie')}>{sev.some((s) => s.value > 0) ? <Donut slices={sev} cutout={0} /> : null}</Card>
      </div>
      <Grid cols={3}>
        <Card title={t('chartMitre')}>
          <Gauge pct={d.mitreCovPct} label={`${d.detectedTactics.size} / 14 ${t('sc_tactics')}`} />
        </Card>
        <Card title={t('t2ChartScore')}>
          <ScoreBars rc={rc} />
        </Card>
        <Card title={t('t2Findings')}>
          <Findings rc={rc} />
        </Card>
      </Grid>
    </>
  )
}

export function Section1({ rc }: { rc: ReportContext }) {
  const exec = rc.template === 'executive'
  return (
    <Section rc={rc} n={1} title={rc.t('sec1')}>
      <Context rc={rc} />
      {exec ? <ExecutiveDashboard rc={rc} /> : null}
      <KpiTable rc={rc} />
      {exec ? null : <TechnicalKpis rc={rc} />}
    </Section>
  )
}

export function Section2({ rc }: { rc: ReportContext }) {
  const { t, fmt, d, details: p, data } = rc
  const integStr = data.connectors.length ? `${d.activeConnectors}/${data.connectors.length} (${d.integrationPct}%)` : '—'
  const noiseStr = d.noise ? `${d.noise.pct}% (${d.noise.ratio}:1)` : '—'
  const phases = [1, 2, 3, 4, 5].map((n) => ({ n, name: t(`phase${n}` as 'phase1'), desc: t(`phase${n}desc` as 'phase1desc') }))
  return (
    <Section rc={rc} n={2} title={t('sec2')}>
      <Sub rc={rc}>{t('sub2_1')}</Sub>
      <Table
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
      <Sub rc={rc}>{t('sub2_3')}</Sub>
      <Table
        head={[t('scCriteria'), t('scTarget'), t('scResult')]}
        rows={[
          [t('sc1'), t('sc1target'), `${d.mitreCovPct}%`],
          [t('sc2'), t('sc2target'), d.mttdMinutes == null ? '—' : `${d.mttdMinutes.toFixed(1)} min`],
          [t('sc3'), t('sc3target'), integStr],
          [t('sc4'), t('sc4target'), noiseStr],
        ]}
      />
      <Sub rc={rc}>{t('sub2_2')}</Sub>
      {rc.template === 'executive' ? (
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
      ) : (
        <Table head={[t('phaseNum'), t('phaseName'), t('phaseDesc')]} rows={phases.map((ph) => [ph.n, ph.name, ph.desc])} />
      )}
    </Section>
  )
}

/** Technical only: the customer's architecture image. */
export function ArchitecturePage({ rc, image }: { rc: ReportContext; image: string | null }) {
  return (
    <Section rc={rc} title={rc.t('secArch')}>
      {image ? <img className="arch" src={image} alt="" /> : <Note>{rc.t('noArchImage')}</Note>}
    </Section>
  )
}

export function Section3({ rc }: { rc: ReportContext }) {
  const { t, fmt, d, data } = rc
  const exec = rc.template === 'executive'
  const sensorTypes = new Set(data.dataSensors.map((s) => s.kind)).size // FIX: distinct types, as labelled
  const ingestByName = new Map(data.ingestion.byConnector.map((c) => [c.name, c.bytes]))
  const sensorBytes = data.ingestion.bySensor.reduce((s, x) => s + x.bytes, 0)
  const connectorBytes = data.ingestion.byConnector.reduce((s, x) => s + x.bytes, 0)
  const toGb = (b: number) => b / 1024 ** 3
  return (
    <Section rc={rc} n={3} title={t('sec3')}>
      <Sub rc={rc}>{t('sub3_1')}</Sub>
      <Kpis
        rc={rc}
        items={[
          { label: t('statTotalSources'), value: fmt.num(data.connectors.length), tone: 'navy' },
          { label: t('statActiveSources'), value: fmt.num(d.activeConnectors), tone: 'ok' },
          { label: t('statTotalIngested'), value: d.vol ? fmt.vol(d.vol.total) : '—', tone: 'brand' },
          { label: t('statSensorTypes'), value: fmt.num(sensorTypes), tone: 'mid' },
        ]}
      />
      {exec ? (
        <>
          <Grid>
            <Card title={t('t2ChartOrigin')} note={t('t2OriginNote')}>
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
            <Card title={t('t2ChartConnCat')} note={t('t2ConnCatNote')}>
              {data.connectors.length ? <Donut cutout={0} slices={categorySlices(rc)} /> : null}
            </Card>
          </Grid>
          {data.ingestion.bySensor.length ? (
            <Card wide title={t('t2ChartSensorGB')} note={t('t2SensorGBNote')}>
              <HBars
                format={fmt.gb}
                items={[...data.ingestion.bySensor]
                  .sort((a, b) => b.bytes - a.bytes)
                  .slice(0, 10)
                  .map((s) => ({ label: fmt.trunc(s.name, 28), value: toGb(s.bytes), color: /modular/i.test(s.type) ? C.navy : C.brand }))}
              />
            </Card>
          ) : null}
          <Grid>
            <Card title={t('t2ChartSensorType')} note={t('t2SensorTypeNote')}>
              {data.dataSensors.length ? (
                <Donut cutout={0} slices={countSlices(data.dataSensors.map((s) => s.kind || '—'))} />
              ) : null}
            </Card>
            <Card title={t('t2ChartConnStatus')} note={t('t2ConnStatusNote')}>
              {data.connectors.length ? (
                <Donut
                  cutout={0.58}
                  slices={countSlices(data.connectors.map((c) => (c.active ? 'online' : 'offline'))).map((s) => ({
                    ...s,
                    color: /online|active|connected/i.test(s.label) ? C.green : C.red,
                  }))}
                />
              ) : null}
            </Card>
          </Grid>
        </>
      ) : null}

      <Sub rc={rc}>{t('sub3_2')}</Sub>
      {data.connectors.length === 0 ? (
        <Note>{t('noConnectors')}</Note>
      ) : (
        <Table
          compact
          head={exec ? [t('connName'), t('connType'), t('connIngested')] : [t('connName'), t('connType'), t('connStatus'), t('connLastSeen'), t('connIngested')]}
          rows={data.connectors.map((c) => {
            const ingested = fmt.bytes(ingestByName.get(c.name) ?? 0)
            const name = fmt.trunc(c.name || c.id, 35)
            const type = c.type || c.category || '—'
            return exec ? [name, type, ingested] : [name, type, c.active ? 'online' : 'offline', fmt.date(c.lastDataReceived ?? c.lastActivity), ingested]
          })}
        />
      )}

      {data.ingestion.bySensor.length || data.ingestion.byConnector.length ? (
        <>
          <Sub rc={rc}>{t('sub3_3')}</Sub>
          {data.ingestion.bySensor.length ? (
            <Table
              compact
              head={[t('sensorName'), t('sensorType'), t('sensorVersion'), t('sensorBytes')]}
              rows={data.ingestion.bySensor.map((s) => {
                const meta = data.dataSensors.find((x) => x.id === s.id)
                return [fmt.trunc(s.name, 30), s.type || '—', meta?.version || '—', fmt.bytes(s.bytes)]
              })}
            />
          ) : null}
          {data.ingestion.byConnector.length ? (
            <Table compact head={[t('connIngName'), t('connIngBytes')]} rows={data.ingestion.byConnector.map((c) => [fmt.trunc(c.name, 40), fmt.bytes(c.bytes)])} />
          ) : null}
        </>
      ) : null}
    </Section>
  )
}

function countSlices(keys: string[]) {
  const m = new Map<string, number>()
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }))
}

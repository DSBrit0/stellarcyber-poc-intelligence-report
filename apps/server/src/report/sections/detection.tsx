import { C, Bars, Donut, HBars, HeatGrid, Lines, PALETTE } from '../charts.js'
import type { ReportContext } from '../context.js'
import { detectionTypes, heatmap, scoreHistogram } from '../model/derived.js'
import type { Lamp, Quadrant, Threat } from '../model/story.js'
import { Card, Grid, Note, P, Section, Sev, Status, Sub, Table, statusLabel } from '../ui.js'

// Section 4 — Detection and Response (spec T1.4, E.4, §3).

const TONE = { critical: C.critical, high: C.high, brand: C.brand }

function DetectionMetrics({ rc }: { rc: ReportContext }) {
  const { t, fmt, d } = rc
  return (
    <>
      <Sub rc={rc}>{t('sub4_2')}</Sub>
      <Table
        head={[t('metMetric'), t('metValue'), t('metPct')]}
        rows={[
          [t('metCritical'), fmt.num(d.crit.length), fmt.pct(d.crit.length, d.totalCases)],
          [t('metHigh'), fmt.num(d.high.length), fmt.pct(d.high.length, d.totalCases)],
          [t('metMedium'), fmt.num(d.sev.medium), fmt.pct(d.sev.medium, d.totalCases)],
          [t('metLow'), fmt.num(d.sev.low), fmt.pct(d.sev.low, d.totalCases)],
          [t('metOpen'), fmt.num(d.openCount), fmt.pct(d.openCount, d.statusBase)],
          [t('metAvgScore'), String(d.avgScore), ''],
        ]}
      />
      {detectionTypes(d.loaded).length ? (
        <Card wide title={t('chartDetectionTypes')}>
          <HBars items={detectionTypes(d.loaded).map((g) => ({ label: fmt.trunc(g.name, 60), value: g.total, color: TONE[g.tone] }))} format={fmt.num} />
        </Card>
      ) : null}
    </>
  )
}

function CaseTable({ rc }: { rc: ReportContext }) {
  const { t, fmt, d, data } = rc
  const rows = d.loaded.flatMap((c) => {
    const row = [fmt.trunc(c.name || c.id, 35), <Sev rc={rc} sev={c.severity} />, <Status rc={rc} status={c.status} />, c.score == null ? '—' : String(c.score), fmt.num(c.alerts), fmt.date(c.startedAt ?? c.createdAt)]
    const top = c.severity === 'critical' ? (data.tactics.topAlerts[c.id] ?? []) : []
    return [row, ...top.map((a) => ({ full: <span className="top-alert">• {a.description}</span> }))]
  })
  return (
    <>
      <Sub rc={rc}>{t('sub4_1')}</Sub>
      <Table compact className="cases" head={[t('caseName'), t('caseSev'), t('caseStatus'), t('caseScore'), t('caseAlerts'), t('caseDate')]} rows={rows} />
      {d.sev.medium > 100 ? <Note>{t('mediumTruncated', { n: fmt.num(d.sev.medium) })}</Note> : null}
      {d.sev.low > 0 ? <Note>{t('lowOmitted', { n: fmt.num(d.sev.low) })}</Note> : null}
      <AlertAccessNote rc={rc} />
    </>
  )
}

/** New: says when the credential could not read some Cases' Alerts (HTTP 403), instead of hiding it. */
function AlertAccessNote({ rc }: { rc: ReportContext }) {
  const n = rc.data.tactics.casesWithoutAlertAccess
  return n ? <Note>{rc.x('alertAccess', { n: rc.fmt.num(n) })}</Note> : null
}

const VERDICT_COLOR: Record<string, string> = {
  'True Positive': C.critical,
  'False Positive': C.green,
  'Benign True Positive': C.cyan,
  Benign: C.mid,
  Inconclusive: 'var(--slate)',
}

/** New: AI Triage verdicts, shown only when the Owner marked AI Triage as tested in the PoC. */
function AiTriage({ rc }: { rc: ReportContext }) {
  const { fmt, d, data } = rc
  const ai = data.aiTriage
  if (!ai) return null
  const head = <Sub rc={rc}>{`4.3 ${rc.x('aiTitle')}`}</Sub>
  if (!ai.available) return <>{head}<Note>{rc.x('aiUnavailable')}</Note></>
  const triaged = d.loaded.filter((c) => ai.verdicts[c.id])
  if (triaged.length === 0) return <>{head}<Note>{rc.x('aiNone')}</Note></>
  const critHighTriaged = d.critHigh.filter((c) => ai.verdicts[c.id])
  const counts = new Map<string, number>()
  for (const c of triaged) counts.set(ai.verdicts[c.id]!, (counts.get(ai.verdicts[c.id]!) ?? 0) + 1)
  const noise = (counts.get('False Positive') ?? 0) + (counts.get('Benign') ?? 0) + (counts.get('Benign True Positive') ?? 0)
  const slices = [...counts].sort((a, b) => b[1] - a[1]).map(([v, n]) => ({ label: rc.aiVerdict(v), value: n, color: VERDICT_COLOR[v] }))
  return (
    <>
      {head}
      <P>{rc.x('aiIntro')}</P>
      <p className="body strong">
        {rc.x('aiCoverage', { n: fmt.num(triaged.length), t: fmt.num(d.loaded.length), p: Math.round((triaged.length / d.loaded.length) * 100), ch: fmt.num(critHighTriaged.length), cht: fmt.num(d.critHigh.length) })}
      </p>
      <P>{rc.x('aiSummary', { fp: Math.round((noise / triaged.length) * 100) })}</P>
      {triaged.length < 20 ? <Note>{rc.x('aiSmallSample', { n: triaged.length })}</Note> : null}
      <Grid>
        <Card title={rc.x('aiChart')} note={rc.x('aiNote')}>
          <Donut cutout={0.58} slices={slices} />
        </Card>
        <Card title={rc.x('aiTableTitle')}>
          <Table
            compact
            head={[rc.t('caseName'), rc.t('caseSev'), rc.t('caseScore'), rc.x('aiColVerdict')]}
            rows={critHighTriaged.slice(0, 12).map((c) => [fmt.trunc(c.name, 34), <Sev rc={rc} sev={c.severity} />, c.score ?? '—', <b style={{ color: VERDICT_COLOR[ai.verdicts[c.id]!] }}>{rc.aiVerdict(ai.verdicts[c.id]!)}</b>])}
          />
        </Card>
      </Grid>
    </>
  )
}

export function Section4({ rc }: { rc: ReportContext }) {
  const { t, fmt, d } = rc
  const exec = rc.template === 'executive'
  if (d.loaded.length === 0) {
    return (
      <Section rc={rc} n={4} title={t('sec4')}>
        <Note>{t('noCases')}</Note>
      </Section>
    )
  }
  return (
    <Section rc={rc} n={4} title={t('sec4')}>
      {exec ? <Story rc={rc} /> : null}
      <DetectionMetrics rc={rc} />
      {exec ? (
        <>
          <AiTriage rc={rc} />
          <ExecutiveCharts rc={rc} />
        </>
      ) : (
        <>
          {d.daily.days.length ? (
            <Card wide title={t('chartTimeline')}>
              <Lines
                labels={d.daily.days.map((x) => fmt.dayMonth(x))}
                series={[{ name: `${t('sevCritical')} + ${t('sevHigh')}`, values: d.daily.days.map((_, i) => (d.daily.critical[i] ?? 0) + (d.daily.high[i] ?? 0)), color: C.critical }]}
              />
            </Card>
          ) : null}
          <CaseTable rc={rc} />
          <AiTriage rc={rc} />
        </>
      )}
    </Section>
  )
}

function ExecutiveCharts({ rc }: { rc: ReportContext }) {
  const { t, fmt, d, data } = rc
  const heat = heatmap(d.critHigh)
  const bins = scoreHistogram(d.loaded)
  const statusCounts = data.caseStats ? Object.entries(data.caseStats.byStatus) : [...countMap(d.loaded.map((c) => c.status || '—'))]
  return (
    <>
      {d.daily.days.length ? (
        <Card wide title={t('t2ChartTrend')} note={t('t2TrendNote')}>
          <Lines
            labels={d.daily.days.map((x) => fmt.dayMonth(x))}
            series={[
              { name: t('sevCritical'), values: d.daily.critical, color: C.critical },
              { name: t('sevHigh'), values: d.daily.high, color: C.high },
            ]}
          />
        </Card>
      ) : null}
      <Card wide title={t('t2ChartHeat')} note={t('t2HeatNote')}>
        <HeatGrid grid={heat.grid} max={heat.max} rows={rc.strings.pdf.t2Weekdays as string[]} scaleLabel={t('t2HeatScale')} tip={(day, h, n) => rc.x('tipHeat', { d: day, h: String(h).padStart(2, '0'), n })} />
      </Card>
      <Grid>
        <Card title={t('t2ChartScoreHist')} note={t('t2ScoreHistNote')}>
          <Bars
            labels={bins.map((_, i) => `${i * 10}–${i * 10 + 9}`)}
            series={[{ name: t('t2CasesAxis'), values: bins, color: C.brand }]}
            colorAt={(i) => (i >= 8 ? C.critical : i >= 6 ? C.high : i >= 4 ? C.medium : C.low)}
            showValues
          />
        </Card>
        <Card title={t('t2ChartStatus')} note={t('t2StatusNote')}>
          <Donut
            cutout={0.58}
            slices={statusCounts
              .sort((a, b) => b[1] - a[1])
              .map(([s, v], i) => ({
                label: statusLabel(rc, s),
                value: v,
                color: /^(open|new)$/i.test(s) ? C.orange : /closed|resolved|analyzed/i.test(s) ? C.green : PALETTE[i % PALETTE.length],
              }))}
          />
        </Card>
      </Grid>
    </>
  )
}

function countMap(keys: string[]) {
  const m = new Map<string, number>()
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
  return m
}

// ─── The Detection Story (Executive 4.1) ──────────────────────────────────────

function Question({ rc, n, total, q, a, note, children }: { rc: ReportContext; n: number; total: number; q: string; a: string; note: string; children: React.ReactNode }) {
  return (
    <article className="story-q">
      <span className="chip">{rc.t('t2StoryStep', { n, t: total })}</span>
      <h4>{q}</h4>
      <p className="answer">{a}</p>
      <div className="story-visual">{children}</div>
      <p className="card-note">{note}</p>
    </article>
  )
}

function Story({ rc }: { rc: ReportContext }) {
  const { t, story } = rc
  const blocks: ((n: number, total: number) => React.ReactNode)[] = []
  const cap = story.capped ? ` ${t('t2CapNote', { n: rc.fmt.num(story.capped.n), t: rc.fmt.num(story.capped.t) })}` : ''
  if (story.q1) blocks.push((n, tt) => <Q1 key="q1" rc={rc} n={n} total={tt} cap={cap} />)
  if (story.q2) blocks.push((n, tt) => <Q2 key="q2" rc={rc} n={n} total={tt} />)
  if (story.q3) blocks.push((n, tt) => <Q3 key="q3" rc={rc} n={n} total={tt} />)
  blocks.push((n, tt) => <Q4 key="q4" rc={rc} n={n} total={tt} cap={cap} />)
  if (story.q5) blocks.push((n, tt) => <Q5 key="q5" rc={rc} n={n} total={tt} cap={cap} />)
  return (
    <>
      <Sub rc={rc}>{t('t2Sub4_1')}</Sub>
      <P>{t('t2StoryIntro')}</P>
      {blocks.map((b, i) => b(i + 1, blocks.length))}
    </>
  )
}

function Q1({ rc, n, total, cap }: { rc: ReportContext; n: number; total: number; cap: string }) {
  const { t, fmt } = rc
  const f = rc.story.q1!
  const vars = { a: fmt.num(f.alerts), c: fmt.num(f.cases), r: fmt.dec(f.alertsPerCase), ch: fmt.num(f.critHigh), p: fmt.dec(f.critHighShare * 100), n: fmt.num(f.pending) }
  const stages = [
    ...(f.volumeGB != null ? [{ v: fmt.vol(f.volumeGB), l: t('t2FunVolume'), s: t('t2FunVolumeSub') }] : []),
    { v: fmt.num(f.alerts), l: t('t2FunAlerts'), s: t('t2FunAlertsSub') },
    { v: fmt.num(f.cases), l: t('t2FunCases'), s: t('t2FunCasesSub', { r: vars.r }) },
    { v: fmt.num(f.critHigh), l: t('t2FunCritHigh'), s: t('t2FunCritHighSub', { p: vars.p }) },
    {
      v: fmt.num(f.pending),
      l: t('t2FunPending'),
      s: f.pending ? t('t2FunPendingSub', { c: f.pendingCritical, h: f.pendingHigh }) : t('t2FunPendingNone'),
      tone: f.pending ? 'bad' : 'good',
    },
  ]
  return (
    <Question rc={rc} n={n} total={total} q={t('t2Q1')} a={f.pending ? t('t2A1', vars) : t('t2A1Done', vars)} note={t('t2N1') + cap}>
      <div className="funnel">
        {stages.map((s, i) => (
          <div key={s.l} className={`stage ${'tone' in s ? s.tone : ''}`} style={{ width: `${100 - (i * 70) / Math.max(1, stages.length - 1)}%` }}>
            <b>{s.v}</b> <span>{s.l}</span>
            <small>{s.s}</small>
          </div>
        ))}
      </div>
      <div className="tiles3">
        <div>
          <b>{fmt.dec(f.critHighAlertShare * 100)}%</b>
          <span>{t('t2FunTileShare', { n: fmt.num(f.critHigh) })}</span>
        </div>
        <div>
          <b>{fmt.dec(f.alertsPerCase)} : 1</b>
          <span>{t('t2FunTileRatio')}</span>
        </div>
        <div className={f.pending ? 'bad' : ''}>
          <b>{fmt.num(f.pending)}</b>
          <span>{t('t2FunTilePending')}</span>
        </div>
      </div>
    </Question>
  )
}

function ThreatCard({ rc, th, headline }: { rc: ReportContext; th: Threat; headline?: boolean }) {
  const { t, fmt } = rc
  const tactics = th.tactics.length ? `MITRE: ${th.tactics.join(' · ')}` : th.xdr.length ? `XDR: ${th.xdr.join(' · ')}` : ''
  const pill = !th.pending ? 'good' : /new|open/i.test(th.status) ? 'bad' : 'warn'
  const facts = [
    t('t2CardCreated', { d: fmt.dayTimeUTC(th.detectedAt) }),
    th.similar > 0 ? t('t2CardSimilar', { n: th.similar }) : '',
    th.leadMin != null ? t('t2CardLead', { t: fmt.dur(th.leadMin) }) : '',
  ].filter(Boolean)
  return (
    <div className={`threat ${headline ? 'headline' : ''} sev-${th.severity}`}>
      <div className="threat-head">
        <span>
          #{th.rank} {(th.severity === 'critical' ? t('sevCritical') : t('sevHigh')).toUpperCase()}
          {th.score != null ? ` · SCORE ${th.score}` : ''}
        </span>
        <span className={`pill-status ${pill}`}>{statusLabel(rc, th.status)}</span>
      </div>
      <div className="threat-name">{th.name}</div>
      {tactics ? <div className="threat-tactics">{tactics}</div> : null}
      {headline ? (
        <>
          {th.techniques.length ? (
            <div className="threat-tactics">
              {t('t2Techniques')}: {th.techniques.join(', ')}
            </div>
          ) : null}
          <div className="threat-big">
            <b>{fmt.num(th.alerts)}</b> {t('t2CardAlertsBig')}
          </div>
          <div className="threat-facts">{facts.join(' · ')}</div>
        </>
      ) : (
        <>
          {th.similar > 0 ? <div className="threat-facts">{t('t2CardSimilar', { n: th.similar })}</div> : null}
          <div className="threat-facts">
            {t('t2CardAlerts', { n: fmt.num(th.alerts) })} · {fmt.dayTimeUTC(th.detectedAt)}
          </div>
        </>
      )}
    </div>
  )
}

function Q2({ rc, n, total }: { rc: ReportContext; n: number; total: number }) {
  const { t, fmt, d, story } = rc
  const top = story.q2!
  const first = top[0]!
  return (
    <Question
      rc={rc}
      n={n}
      total={total}
      q={t('t2Q2')}
      a={t('t2A2', { c: d.crit.length, h: d.high.length, name: fmt.trunc(first.name, 70), a: fmt.num(first.alerts), st: statusLabel(rc, first.status) })}
      note={t('t2N2', { rest: Math.max(0, d.critHigh.length - story.shownOnCards), m: fmt.num(d.sev.medium), l: fmt.num(d.sev.low) })}
    >
      <ThreatCard rc={rc} th={first} headline />
      <div className="threat-grid">
        {top.slice(1).map((th) => (
          <ThreatCard key={th.id} rc={rc} th={th} />
        ))}
      </div>
    </Question>
  )
}

const QUAD_KEY: Record<Quadrant, 't2QuadAct' | 't2QuadInvestigate' | 't2QuadMonitor' | 't2QuadNoise'> = {
  act: 't2QuadAct',
  investigate: 't2QuadInvestigate',
  monitor: 't2QuadMonitor',
  noise: 't2QuadNoise',
}

function Q3({ rc, n, total }: { rc: ReportContext; n: number; total: number }) {
  const { t } = rc
  const m = rc.story.q3!
  const scores = m.points.map((p) => p.score)
  const xMin = Math.max(0, Math.min(m.scoreCut - 20, Math.floor(Math.min(...scores) / 10) * 10))
  const xTop = Math.max(100, Math.ceil(Math.max(...scores) / 10) * 10) + 4
  const dec = Math.max(1, Math.ceil(Math.log10(m.maxAlerts * 1.05)))
  const W = 600
  const H = 300
  const pad = { l: 44, r: 10, t: 10, b: 34 }
  const x = (v: number) => pad.l + ((v - xMin) / (xTop - xMin)) * (W - pad.l - pad.r)
  const y = (v: number) => H - pad.b - (Math.log10(Math.max(1, v)) / dec) * (H - pad.t - pad.b)
  const cx = x(m.scoreCut)
  const cy = y(m.alertCut)
  const quads: { q: Quadrant; x: number; y: number; w: number; h: number; fill: string }[] = [
    { q: 'act', x: cx, y: pad.t, w: W - pad.r - cx, h: cy - pad.t, fill: '#fdecec' },
    { q: 'investigate', x: cx, y: cy, w: W - pad.r - cx, h: H - pad.b - cy, fill: '#fff3e6' },
    { q: 'monitor', x: pad.l, y: pad.t, w: cx - pad.l, h: cy - pad.t, fill: '#eaf1fb' },
    { q: 'noise', x: pad.l, y: cy, w: cx - pad.l, h: H - pad.b - cy, fill: '#f1f3f5' },
  ]
  const layers = ['medium', 'high', 'critical'] as const
  const names = new Map(rc.d.loaded.map((c) => [c.id, c.name]))
  const radius = { medium: 3, high: 4, critical: 5, low: 3 }
  return (
    <Question
      rc={rc}
      n={n}
      total={total}
      q={t('t2Q3')}
      a={t('t2A3', { n: m.counts.act, s: m.scoreCut, a: m.alertCut, ch: m.actCritHigh })}
      note={t('t2N3', { n: m.points.length, a: m.alertCut })}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg matrix" role="img">
        {quads.map((qd) => (
          <g key={qd.q}>
            <rect x={qd.x} y={qd.y} width={Math.max(0, qd.w)} height={Math.max(0, qd.h)} fill={qd.fill} />
            {qd.w > 60 && qd.h > 24 ? (
              <text x={qd.x + 6} y={qd.y + 14} className="tick strong">
                {t(QUAD_KEY[qd.q], { n: m.counts[qd.q] })} · {m.counts[qd.q]}
              </text>
            ) : null}
          </g>
        ))}
        {Array.from({ length: dec + 1 }, (_, e) => (
          <g key={e}>
            <line x1={pad.l} x2={W - pad.r} y1={y(10 ** e)} y2={y(10 ** e)} className="grid" />
            <text x={pad.l - 4} y={y(10 ** e)} textAnchor="end" dominantBaseline="central" className="tick">
              {10 ** e}
            </text>
          </g>
        ))}
        {Array.from({ length: Math.floor((xTop - xMin) / 10) + 1 }, (_, i) => xMin + i * 10).map((v) => (
          <text key={v} x={x(v)} y={H - pad.b + 14} textAnchor="middle" className="tick">
            {v}
          </text>
        ))}
        <line x1={cx} x2={cx} y1={pad.t} y2={H - pad.b} stroke="#5b6270" strokeDasharray="5 4" />
        <line x1={pad.l} x2={W - pad.r} y1={cy} y2={cy} stroke="#5b6270" strokeDasharray="5 4" />
        {layers.map((sev) =>
          m.points
            .filter((p) => p.sev === sev)
            .map((p) => (
              <circle
                key={p.id}
                className="pt"
                cx={x(p.score)}
                cy={y(p.alerts)}
                r={radius[sev]}
                fill={sev === 'critical' ? C.critical : sev === 'high' ? C.high : C.medium}
                fillOpacity="0.85"
                data-tip={`${names.get(p.id) ?? ''} — ${rc.x('tipPoint', { s: p.score, a: p.alerts, q: t(QUAD_KEY[p.q]) })}`}
              />
            )),
        )}
        {mergeRankLabels(m.points.filter((p) => p.rank != null).map((p) => ({ x: x(p.score), y: y(p.alerts), rank: p.rank! }))).map((l) => (
          <text key={l.label} x={l.x + 7} y={l.y - 6} className="tick strong">
            {l.label}
          </text>
        ))}
        <text x={(W + pad.l) / 2} y={H - 4} textAnchor="middle" className="tick">
          {t('t2AxisScore')}
        </text>
        <text x={12} y={H / 2} transform={`rotate(-90 12 ${H / 2})`} textAnchor="middle" className="tick">
          {t('t2AxisAlerts')}
        </text>
      </svg>
      <div className="legend">
        <span>
          <i style={{ background: C.critical }} />
          {t('sevCritical')}
        </span>
        <span>
          <i style={{ background: C.high }} />
          {t('sevHigh')}
        </span>
        <span>
          <i style={{ background: C.medium }} />
          {t('t2LegendMedium100')}
        </span>
        <span>{t('t2LegendRank')}</span>
      </div>
    </Question>
  )
}

const RESP = {
  critOpen: { label: 't2RespCritOpen', sub: 't2RespCritOpenT' },
  highOpen: { label: 't2RespHighOpen', sub: 't2RespHighOpenT' },
  handled: { label: 't2RespHandled', sub: 't2RespHandledT' },
  ack: { label: 't2RespAck', sub: 't2RespAckT' },
  close: { label: 't2RespClose', sub: 't2RespCloseT' },
  lead: { label: 't2RespLead', sub: 't2RespLeadT' },
} as const

function Q4({ rc, n, total, cap }: { rc: ReportContext; n: number; total: number; cap: string }) {
  const { t, fmt } = rc
  const s = rc.story.q4
  const answer = s.rated === 0 ? t('t2A4None') : s.critOpen + s.highOpen > 0 ? t('t2A4', { g: s.inTarget, n: s.rated, c: s.critOpen, h: s.highOpen }) : t('t2A4Clear', { g: s.inTarget, n: s.rated })
  const valueOf = (key: string, v: number | null) =>
    v == null ? '—' : key === 'handled' ? `${fmt.dec(v, 0)}%` : key === 'ack' || key === 'lead' ? fmt.dur(v) : key === 'close' ? fmt.dur(v * 60) : fmt.num(v)
  const subOf = (tile: (typeof s.tiles)[number]) => {
    if (tile.lamp === 'none') return t('t2RespNoData')
    const k = RESP[tile.key].sub
    if (tile.key === 'highOpen') return t(k, { y: 2 })
    if (tile.key === 'handled') return t(k, { t: 90, h: fmt.num(tile.handled), c: fmt.num(tile.cases) })
    if (tile.key === 'ack') return t(k, { t: 30, n: fmt.num(tile.n) })
    if (tile.key === 'close') return t(k, { t: 24, n: fmt.num(tile.n) })
    if (tile.key === 'lead') return t(k, { n: fmt.num(tile.n) })
    return t(k)
  }
  const attention = s.attention.map((k) => t(RESP[k].label)).join(', ')
  return (
    <Question rc={rc} n={n} total={total} q={t('t2Q4')} a={answer} note={t('t2N4', { y: 2, hp: 90, hy: 80, am: 30, ch: 24 }) + cap}>
      <div className="resp-grid">
        {s.tiles.map((tile) => (
          <div key={tile.key} className="resp-tile">
            <i className={`lamp lamp-${tile.lamp as Lamp}`} />
            <span className="resp-label">{t(RESP[tile.key].label)}</span>
            <b>{valueOf(tile.key, tile.value)}</b>
            <small>{subOf(tile)}</small>
          </div>
        ))}
      </div>
      <div className="resp-verdict">
        <div>
          {s.tiles
            .filter((x) => x.lamp === 'green' || x.lamp === 'yellow' || x.lamp === 'red')
            .map((x) => (
              <i key={x.key} className={`lamp lamp-${x.lamp}`} />
            ))}
          {t('t2RespVerdict', { g: s.inTarget, n: s.rated })}
        </div>
        <small>{fmt.trunc(attention ? t('t2RespAttention', { l: attention }) : t('t2RespAllGood'), 130)}</small>
      </div>
    </Question>
  )
}

function Q5({ rc, n, total, cap }: { rc: ReportContext; n: number; total: number; cap: string }) {
  const { t, fmt } = rc
  const e = rc.story.q5!
  const h = (v: number) => `${fmt.num(Math.round(v))} h`
  const max = Math.max(e.withoutH, 1)
  const w = (v: number) => `${(v / max) * 100}%`
  const p = e.premises
  const note = [
    t(e.custom ? 't2N5Custom' : 't2N5', { a: fmt.dec(p.alertMin), ch: fmt.dec(p.critHighMin), m: fmt.dec(p.mediumMin), l: fmt.dec(p.lowMin), mh: fmt.dec(p.monthHours) }),
    e.flags.small ? t('t2EffFlagSmall', { n: fmt.num(rc.data.caseStats?.cases ?? 0) }) : '',
    e.flags.concentrated ? t('t2EffFlagConc', { p: fmt.dec(e.flags.top5Pct * 100, 0) }) : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <Question rc={rc} n={n} total={total} q={t('t2Q5')} a={t('t2A5', { h: fmt.num(Math.round(e.savedH)), p: fmt.dec(e.savedPct * 100, 0), f: fmt.dec(e.focusPct * 100, 0) })} note={note + cap}>
      <div className="effort">
        <small>{t('t2EffScale')}</small>
        <div className="eff-row">
          <span className="eff-label">
            {t('t2EffWithoutShort')}
            <small>{t('t2EffAlerts', { n: fmt.num(e.alerts) })}</small>
          </span>
          <span className="eff-bar">
            <span className="seg inv" style={{ width: w(e.invH) }} />
            <span className="seg tri-alerts" style={{ width: w(e.triageWithoutH) }} />
          </span>
          <b>{h(e.withoutH)}</b>
        </div>
        <div className="eff-row">
          <span className="eff-label">
            {t('t2EffWithShort')}
            <small>{t('t2EffCases', { n: fmt.num(e.cases) })}</small>
          </span>
          <span className="eff-bar">
            <span className="seg inv" style={{ width: w(e.invH) }} />
            <span className="seg tri-cases" style={{ width: w(e.triageWithH) }} />
            <span className="seg saved" style={{ width: w(e.savedH) }} />
          </span>
          <b>{h(e.withH)}</b>
        </div>
        <div className="legend">
          <span>
            <i className="inv" />
            {t('t2EffLegInv')}
          </span>
          <span>
            <i className="tri-alerts" />
            {t('t2EffLegTriAlerts')}
          </span>
          <span>
            <i className="tri-cases" />
            {t('t2EffLegTriCases')}
          </span>
          <span>
            <i className="saved dashed" />
            {t('t2EffLegSaved')}
          </span>
        </div>
      </div>
      <div className="tiles4">
        <div className="good">
          <b>-{h(e.savedH)}</b>
          <span>{t('t2EffKpiSaved')}</span>
        </div>
        <div className="good">
          <b>{fmt.dec(e.savedPct * 100, 0)}%</b>
          <span>{t('t2EffKpiPct')}</span>
        </div>
        <div>
          <b>{e.savedFte > 0 && e.savedFte < 0.1 ? '< 0.1' : fmt.dec(e.savedFte)}</b>
          <span>{t('t2EffKpiFte')}</span>
        </div>
        <div className="brand">
          <b>{h(e.withH)}</b>
          <span>{t('t2EffKpiWith')}</span>
        </div>
      </div>
    </Question>
  )
}

/** Rank labels of points closer than ~12 px share one label ("#2 #4"), as in the previous tool. */
function mergeRankLabels(points: { x: number; y: number; rank: number }[]) {
  const groups: { x: number; y: number; ranks: number[] }[] = []
  for (const p of [...points].sort((a, b) => a.rank - b.rank)) {
    const g = groups.find((q) => Math.hypot(q.x - p.x, q.y - p.y) < 12)
    if (g) g.ranks.push(p.rank)
    else groups.push({ x: p.x, y: p.y, ranks: [p.rank] })
  }
  return groups.map((g) => ({ x: g.x, y: g.y, label: g.ranks.map((r) => `#${r}`).join(' ') }))
}

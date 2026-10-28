import { C, Bars, Donut, HBars, HeatGrid, Lines, PALETTE } from '../charts.js'
import type { ReportContext } from '../context.js'
import { byScore, caseTypes, detectionTypes, heatmap, isPending, scoreHistogram } from '../model/derived.js'
import type { Lamp, Quadrant, Threat } from '../model/story.js'
import { Card, Figure, Grid, Note, P, Section, Sev, Status, Sub, Table, statusLabel } from '../ui.js'

// Section 4 — Detection and Response (spec T1.4, E.4, §3).

const TONE = { critical: C.critical, high: C.high, brand: C.brand }

function DetectionMetrics({ rc }: { rc: ReportContext }) {
  const { t, fmt, d } = rc
  const types = detectionTypes(d.loaded)
  return (
    <>
      <Sub rc={rc}>{t('sub4_2')}</Sub>
      <Table
        rc={rc}
        head={[t('metMetric'), t('metValue'), t('metPct')]}
        rows={[
          [t('metCritical'), fmt.num(d.sev.critical), fmt.pct(d.sev.critical, d.totalCases)],
          [t('metHigh'), fmt.num(d.sev.high), fmt.pct(d.sev.high, d.totalCases)],
          [t('metMedium'), fmt.num(d.sev.medium), fmt.pct(d.sev.medium, d.totalCases)],
          [t('metLow'), fmt.num(d.sev.low), fmt.pct(d.sev.low, d.totalCases)],
          [t('metOpen'), fmt.num(d.openCount), fmt.pct(d.openCount, d.statusBase)],
          ...(d.avgScore ? [[t('metAvgScore'), fmt.num(d.avgScore), '']] : []),
        ]}
      />
      {types.length ? (
        <Card rc={rc} wide title={t('chartDetectionTypes')}>
          <HBars items={types.map((g) => ({ label: fmt.trunc(g.name, 60), value: g.total, color: TONE[g.tone] }))} format={fmt.num} />
        </Card>
      ) : null}
    </>
  )
}

/** How many Cases of each Severity the Technical list shows (highest score first); the rest are counted. */
const LIST_TOP = { critical: 25, high: 30, medium: 10 } as const
/** Alert descriptions shown under each listed Critical Case (duplicates removed). */
const ALERTS_PER_CRITICAL = 2
/** Detection types in the summary table. */
const TYPES_TOP = 25

const CASE_COLS = ['50%', '14%', '9%', '11%', '16%']

/**
 * Technical case list: a summary by detection type, then the Critical, High and Medium Cases with the
 * highest scores (the rest counted, Low ones only counted), so 2,000 Cases still fit in a few pages.
 */
function CaseTable({ rc }: { rc: ReportContext }) {
  const { t, x, fmt, d, data } = rc
  const types = caseTypes(d.loaded)
  const day = (ms: number) => fmt.dayMonth(new Date(ms).toISOString().slice(0, 10))
  const span = (a: number | null, b: number | null) => (a == null || b == null ? '—' : day(a) === day(b) ? day(a) : `${day(a)} – ${day(b)}`)
  const row = (c: (typeof d.loaded)[number]) => [
    <span className="clamp2" title={c.name}>{c.name || c.id}</span>,
    <Status rc={rc} status={c.status} />,
    <span className="num">{c.score == null ? '—' : fmt.num(c.score)}</span>,
    <span className="num">{fmt.num(c.alerts)}</span>,
    fmt.date(c.startedAt ?? c.createdAt),
  ]
  const head = [t('caseName'), t('caseStatus'), t('caseScore'), t('caseAlerts'), t('caseDate')]
  const lists = (['critical', 'high', 'medium'] as const).map((sev) => {
    const all = byScore(d.loaded.filter((c) => c.severity === sev))
    const shown = all.slice(0, LIST_TOP[sev])
    // Counted against the period's total of the Severity: the analysed list itself may be capped.
    const notListed = Math.max(0, d.sev[sev] - shown.length)
    return { sev, shown, notListed }
  })
  const alertsOf = (id: string) => {
    const seen = new Set<string>()
    return (data.tactics.topAlerts[id] ?? []).filter((a) => !seen.has(a.description) && seen.add(a.description)).slice(0, ALERTS_PER_CRITICAL)
  }
  const title = { critical: 'caseListCritical', high: 'caseListHigh', medium: 'caseListMedium' } as const
  const more = { critical: 'notListedCritical', high: 'notListedHigh', medium: 'notListedMedium' } as const
  return (
    <>
      <Sub rc={rc}>{t('sub4_1')}</Sub>
      {types.length ? (
        <>
          <Table
            rc={rc}
            compact
            caption={x('subCaseTypes')}
            className="case-types"
            cols={['42%', '9%', '12%', '12%', '10%', '15%']}
            head={[x('colDetType'), x('colCases'), x('colCritHighShort'), x('colPending'), x('colMaxScore'), x('colFirstLast')]}
            rows={types.slice(0, TYPES_TOP).map((g) => [
              <span className="clamp2" title={g.name}>{g.name}</span>,
              <span className="num">{fmt.num(g.cases)}</span>,
              <span className="num">{fmt.num(g.critHigh)}</span>,
              <span className="num">{fmt.num(g.pending)}</span>,
              <span className="num">{g.maxScore == null ? '—' : fmt.num(g.maxScore)}</span>,
              span(g.first, g.last),
            ])}
          />
        </>
      ) : null}
      {lists.map(({ sev, shown, notListed }) =>
        shown.length ? (
          <div key={sev} className="case-list">
            <Table
              rc={rc}
              compact
              caption={x(title[sev])}
              className="cases"
              cols={CASE_COLS}
              head={head}
              rows={shown.flatMap((c) => [row(c), ...(sev === 'critical' ? alertsOf(c.id).map((a) => ({ full: <span className="top-alert clamp2">• {a.description}</span> })) : [])])}
            />
            {notListed ? <p className="muted">{x(more[sev], { n: fmt.num(notListed) })}</p> : null}
          </div>
        ) : null,
      )}
      {d.sev.low > 0 ? <p className="muted">{`${t('lowOmitted', { n: fmt.num(d.sev.low) })}.`}</p> : null}
      <AlertAccessNote rc={rc} />
    </>
  )
}

/** New: says when the credential could not read some Cases' Alerts (HTTP 403), instead of hiding it. */
function AlertAccessNote({ rc }: { rc: ReportContext }) {
  const n = rc.data.tactics.casesWithoutAlertAccess
  return n ? <Note>{rc.x('alertAccess', { n: rc.fmt.num(n) })}</Note> : null
}

/** Technical: the users, hosts and external IPs that appear most in the Critical/High Cases' Alerts. */
function Entities({ rc }: { rc: ReportContext }) {
  const { x, fmt, data } = rc
  const e = data.tactics.entities
  if (!e) return null
  const rows = [
    ...e.users.map((u) => [x('entUsers'), fmt.trunc(u.value, 48), '—', '—', '—', fmt.num(u.alerts), fmt.num(u.cases)]),
    ...e.hosts.map((h) => [x('entHosts'), fmt.trunc(h.value, 48), '—', '—', '—', fmt.num(h.alerts), fmt.num(h.cases)]),
    ...e.externalIps.map((ip) => [x('entIps'), ip.value, ip.country || '—', ip.reputation || '—', fmt.trunc(ip.asnOrg, 28), fmt.num(ip.alerts), fmt.num(ip.cases)]),
  ]
  if (rows.length === 0) return null
  return (
    <>
      <Sub rc={rc}>{x('subEntities')}</Sub>
      <Table rc={rc} compact cols={['12%', '28%', '8%', '13%', '19%', '10%', '10%']} head={[rc.t('sensorType'), x('entColValue'), x('entColCountry'), x('entColReputation'), x('entColAsn'), x('colAlerts'), rc.t('xtaCases')]} rows={rows} />
    </>
  )
}

const VERDICT_COLOR: Record<string, string> = {
  'True Positive': C.critical,
  'False Positive': C.green,
  'Benign True Positive': C.cyan,
  Benign: C.mid,
  Inconclusive: 'var(--slate)',
}

const VERDICT_ORDER: Record<string, number> = { 'True Positive': 0, Inconclusive: 1, 'Benign True Positive': 2, Benign: 3, 'False Positive': 4 }

/** New: Auto Triage verdicts, shown only when the Owner marked Auto Triage as tested and the period had Cases. */
function AiTriage({ rc }: { rc: ReportContext }) {
  const { fmt, d, x } = rc
  const ai = d.ai
  if (!ai || ai.status === 'no_cases') return null
  const head = <Sub rc={rc}>{x('aiTitle')}</Sub>
  if (ai.status === 'not_exposed') return <>{head}<Note>{x('aiUnavailable')}</Note></>
  if (ai.status === 'failed') return <>{head}<Note>{x('aiFailed')}</Note></>
  if (ai.triaged === 0) return <>{head}<Note>{x('aiNone')}</Note></>
  // True Positives first, then by severity, score and alerts.
  const critHighTriaged = d.critHigh
    .filter((c) => ai.verdictOf(c.id))
    .sort(
      (a, b) =>
        (VERDICT_ORDER[ai.verdictOf(a.id)!] ?? 9) - (VERDICT_ORDER[ai.verdictOf(b.id)!] ?? 9) ||
        (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1) ||
        (b.score ?? -1) - (a.score ?? -1) ||
        b.alerts - a.alerts,
    )
  const n = fmt.num(ai.triaged)
  // A percentage reads as a rate only over enough verdicts; below 20 the counts are stated instead.
  const summary = ai.noise === 0 ? x('aiSummaryAllTp', { n }) : ai.triaged >= 20 ? x('aiLead', { fp: Math.round((ai.noise / ai.triaged) * 100), n }) : x('aiSummary', { fp: fmt.num(ai.noise), n })
  const slices = [...ai.counts].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([v, k]) => ({ label: rc.aiVerdict(v), value: k, color: VERDICT_COLOR[v] }))
  const shown = critHighTriaged.slice(0, 12)
  return (
    <>
      {head}
      <p className="body strong">{summary}</p>
      <P>{x('aiIntro')}</P>
      {d.critHigh.length ? <P>{x('aiCoverage', { ch: fmt.num(critHighTriaged.length), cht: fmt.num(d.critHigh.length) })}</P> : null}
      {slices.length > 1 ? (
        <Card rc={rc} title={x('aiChart')}>
          <Donut cutout={0.58} slices={slices} format={fmt.num} />
        </Card>
      ) : null}
      {shown.length ? (
        <>
          <Table
            rc={rc}
            compact
            caption={x('aiTableTitle')}
            className="ai-verdicts"
            cols={['39%', '14%', '8%', '16%', '23%']}
            head={[rc.t('caseName'), rc.t('caseSev'), rc.t('caseScore'), rc.t('caseDate'), x('aiColVerdict')]}
            rows={shown.map((c) => [
              <span className="clamp2" title={c.name}>{c.name}</span>,
              <Sev rc={rc} sev={c.severity} />,
              c.score == null ? '—' : fmt.num(c.score),
              <span className="num">{fmt.date(c.createdAt)}</span>,
              <b style={{ color: VERDICT_COLOR[ai.verdictOf(c.id)!] }}>{rc.aiVerdict(ai.verdictOf(c.id)!)}</b>,
            ])}
          />
          {critHighTriaged.length > shown.length ? <Note>{x('aiMore', { n: fmt.num(critHighTriaged.length - shown.length) })}</Note> : null}
        </>
      ) : null}
    </>
  )
}

export function Section4({ rc }: { rc: ReportContext }) {
  const { t, fmt, d } = rc
  const exec = rc.template === 'executive'
  if (d.noCases) {
    return (
      <Section rc={rc} title={t('sec4')}>
        <Note>{rc.x('noCasesSections')}</Note>
      </Section>
    )
  }
  if (d.loaded.length === 0) {
    // No analysed Case (only Low ones, or none could be read): the period's counts still stand.
    const onlyLow = d.sev.critical + d.sev.high + d.sev.medium === 0
    return (
      <Section rc={rc} title={t('sec4')}>
        {onlyLow ? <Note>{rc.x('onlyLowNote', { n: fmt.num(d.totalCases) })}</Note> : null}
        <DetectionMetrics rc={rc} />
      </Section>
    )
  }
  return (
    <Section rc={rc} title={t('sec4')}>
      {exec ? <Story rc={rc} /> : null}
      <DetectionMetrics rc={rc} />
      {exec ? (
        <>
          <AiTriage rc={rc} />
          <ExecutiveCharts rc={rc} />
        </>
      ) : (
        <>
          {[...d.daily.critical, ...d.daily.high].some((v) => v > 0) ? (
            <Card rc={rc} wide title={t('chartTimeline')}>
              <Lines
                labels={d.daily.days.map((x) => fmt.dayMonth(x))}
                series={[{ name: `${t('sevCritical')} + ${t('sevHigh')}`, values: d.daily.days.map((_, i) => (d.daily.critical[i] ?? 0) + (d.daily.high[i] ?? 0)), color: C.critical }]}
                yFormat={fmt.num}
              />
            </Card>
          ) : null}
          <CaseTable rc={rc} />
          <AiTriage rc={rc} />
          <Entities rc={rc} />
        </>
      )}
    </Section>
  )
}

function ExecutiveCharts({ rc }: { rc: ReportContext }) {
  const { t, fmt, d, data } = rc
  const heat = heatmap(d.critHigh)
  const bins = scoreHistogram(d.loaded)
  const statusCounts = (data.caseStats ? Object.entries(data.caseStats.byStatus) : [...countMap(d.loaded.map((c) => c.status || 'New'))]).filter(([, v]) => v > 0)
  return (
    <>
      <Card rc={rc} wide title={t('t2ChartHeat')} note={t('t2HeatNote')}>
        {heat.grid.flat().some((v) => v > 0) ? (
          <HeatGrid grid={heat.grid} max={heat.max} rows={rc.strings.pdf.t2Weekdays as string[]} scaleLabel={t('t2HeatScale')} tip={(day, h, n) => rc.x('tipHeat', { d: day, h: String(h).padStart(2, '0'), n })} />
        ) : null}
      </Card>
      <Grid>
        <Card rc={rc} title={t('t2ChartScoreHist')}>
          {bins.some((v) => v > 0) ? (
            <Bars
              labels={bins.map((_, i) => `${i * 10}–${i * 10 + 9}`)}
              series={[{ name: t('t2CasesAxis'), values: bins, color: C.brand }]}
              colorAt={(i) => (i >= 8 ? C.critical : i >= 6 ? C.high : i >= 4 ? C.medium : C.low)}
              showValues
              width={320}
              yFormat={fmt.num}
            />
          ) : null}
        </Card>
        <Card rc={rc} title={t('t2ChartStatus')} note={t('t2StatusNote')}>
          {/* One status only (every case still New) says nothing as a pie: the card drops out. */}
          {statusCounts.length > 1 ? (
            <Donut
              cutout={0.58}
              format={fmt.num}
              slices={statusCounts
                .sort((a, b) => b[1] - a[1])
                .map(([s, v], i) => ({
                  label: statusLabel(rc, s),
                  value: v,
                  color: /^(open|new)$/i.test(s) ? C.orange : !isPending(s) ? C.green : PALETTE[i % PALETTE.length],
                }))}
            />
          ) : null}
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

/** A Detection Story step: the question, its answer, then its visual as a numbered figure. */
function Question({ rc, n, total, q, a, note, figure, children }: { rc: ReportContext; n: number; total: number; q: string; a: string; note: string; figure: string; children: React.ReactNode }) {
  return (
    <article className="story-q">
      <span className="chip">{rc.t('t2StoryStep', { n, t: total })}</span>
      <h4>{q}</h4>
      <p className="answer">{a}</p>
      <Figure rc={rc} title={figure}>
        <div className="story-visual">{children}</div>
      </Figure>
      {note ? <p className="card-note">{note}</p> : null}
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
      {blocks.map((b, i) => b(i + 1, blocks.length))}
    </>
  )
}

function Q1({ rc, n, total, cap }: { rc: ReportContext; n: number; total: number; cap: string }) {
  const { t, fmt } = rc
  const f = rc.story.q1!
  const vars = { a: fmt.num(f.alerts), c: fmt.num(f.cases), r: fmt.dec(f.alertsPerCase), ch: fmt.num(f.critHigh), p: fmt.dec(f.critHighShare * 100), n: fmt.num(f.pending) }
  const excluded = f.pendingNoise ? `${t('t2FunPending')}: ${fmt.num(f.pending)} ${rc.x('atExcluded', { m: fmt.num(f.pendingNoise) })}.` : ''
  const stages = [
    ...(f.volumeGB != null ? [{ v: fmt.vol(f.volumeGB), l: t('t2FunVolume'), s: t('t2FunVolumeSub') }] : []),
    { v: fmt.num(f.alerts), l: t('t2FunAlerts'), s: t('t2FunAlertsSub') },
    { v: fmt.num(f.cases), l: t('t2FunCases'), s: t('t2FunCasesSub', { r: vars.r }) },
    { v: fmt.num(f.critHigh), l: t('t2FunCritHigh'), s: t('t2FunCritHighSub', { p: vars.p }) },
    {
      v: fmt.num(f.pending),
      l: t('t2FunPending'),
      s: f.pending ? t('t2FunPendingSub', { c: fmt.num(f.pendingCritical), h: fmt.num(f.pendingHigh) }) : t('t2FunPendingNone'),
      tone: f.pending ? 'bad' : 'good',
    },
  ]
  return (
    <Question rc={rc} n={n} total={total} figure={rc.x('figStory1')} q={t('t2Q1')} a={f.pending || f.pendingNoise ? t('t2A1', vars) : t('t2A1Done', vars)} note={[excluded, cap.trim()].filter(Boolean).join(' ')}>
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
          <b>{fmt.ratio(f.alertsPerCase)}</b>
          <span>{t('t2FunTileRatio')}</span>
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
    th.similar > 0 ? t('t2CardSimilar', { n: fmt.num(th.similar) }) : '',
    th.leadMin != null ? t('t2CardLead', { t: fmt.dur(th.leadMin) }) : '',
  ].filter(Boolean)
  return (
    <div className={`threat ${headline ? 'headline' : ''} sev-${th.severity}`}>
      <div className="threat-head">
        <span>
          #{th.rank} {(th.severity === 'critical' ? t('sevCritical') : t('sevHigh')).toUpperCase()}
          {th.score != null ? ` · SCORE ${fmt.num(th.score)}` : ''}
        </span>
        <span>
          {th.verdict ? <span className={`pill-status ${th.verdict === 'True Positive' ? 'bad' : th.verdict === 'Inconclusive' ? 'warn' : 'good'}`}>{rc.aiVerdict(th.verdict)}</span> : null}
          <span className={`pill-status ${pill}`}>{statusLabel(rc, th.status)}</span>
        </span>
      </div>
      <div className="threat-name">{th.name}</div>
      {tactics ? <div className="threat-tactics">{tactics}</div> : null}
      {th.entities.length ? (
        <div className="chips" aria-label={rc.x('entCard', { list: th.entities.join(', ') })}>
          {th.entities.map((e) => (
            <span key={e} className="chip-ent" title={e}>
              {e}
            </span>
          ))}
        </div>
      ) : null}
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
          {th.similar > 0 ? <div className="threat-facts">{t('t2CardSimilar', { n: fmt.num(th.similar) })}</div> : null}
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
      figure={rc.x('figStory2')}
      q={t('t2Q2')}
      a={t('t2A2', { c: fmt.num(d.sev.critical), h: fmt.num(d.sev.high), name: fmt.trunc(first.name, 70), a: fmt.num(first.alerts), st: statusLabel(rc, first.status) })}
      note={t('t2N2', { rest: fmt.num(Math.max(0, d.critHigh.length - story.shownOnCards)), m: fmt.num(d.sev.medium), l: fmt.num(d.sev.low) })}
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
  const { t, fmt } = rc
  const m = rc.story.q3!
  const scores = m.points.map((p) => p.score)
  const xMin = Math.max(0, Math.min(m.scoreCut - 20, Math.floor(Math.min(...scores) / 10) * 10))
  const xTop = Math.max(100, Math.ceil(Math.max(...scores) / 10) * 10) + 4
  const dec = Math.max(1, Math.ceil(Math.log10(m.maxAlerts * 1.05)))
  const W = 600
  const H = 300
  const pad = { l: 44, r: 10, t: 22, b: 34 }
  const x = (v: number) => pad.l + ((v - xMin) / (xTop - xMin)) * (W - pad.l - pad.r)
  const y = (v: number) => H - pad.b - (Math.log10(Math.max(1, v)) / dec) * (H - pad.t - pad.b)
  const cx = x(m.scoreCut)
  const cy = y(m.alertCut)
  const quads: { q: Quadrant; x: number; y: number; w: number; h: number; fill: string; ink: string }[] = [
    { q: 'act', x: cx, y: pad.t, w: W - pad.r - cx, h: cy - pad.t, fill: '#f9e6e6', ink: '#a00000' },
    { q: 'investigate', x: cx, y: cy, w: W - pad.r - cx, h: H - pad.b - cy, fill: '#fff3e6', ink: '#a35a00' },
    { q: 'monitor', x: pad.l, y: pad.t, w: cx - pad.l, h: cy - pad.t, fill: '#edf5fb', ink: '#1f3864' },
    { q: 'noise', x: pad.l, y: cy, w: cx - pad.l, h: H - pad.b - cy, fill: '#f3f6fa', ink: '#5b6a82' },
  ]
  const layers = ['medium', 'high', 'critical'] as const
  const names = new Map(rc.d.loaded.map((c) => [c.id, c.name]))
  // 600 units span 182 mm in print (1 unit ≈ 0.3 mm): the previous tool's 0.75 / 1.0 / 1.3 mm points.
  const radius = { medium: 2.5, high: 3.3, critical: 4.3, low: 2.5 }
  return (
    <Question
      rc={rc}
      n={n}
      total={total}
      figure={rc.x('figStory3')}
      q={t('t2Q3')}
      a={t('t2A3', { n: fmt.num(m.counts.act), s: m.scoreCut, a: fmt.num(m.alertCut), ch: fmt.num(m.actCritHigh) })}
      note={[m.actNoise ? `${t('t2QuadAct')}: ${fmt.num(m.counts.act)} ${rc.x('atExcluded', { m: fmt.num(m.actNoise) })}.` : '', t('t2N3')].filter(Boolean).join(' ')}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg matrix" role="img">
        {quads.map((qd) => (
          <g key={qd.q}>
            <rect x={qd.x} y={qd.y} width={Math.max(0, qd.w)} height={Math.max(0, qd.h)} fill={qd.fill} />
            {qd.w > 60 && qd.h > 20 ? (
              // Each quadrant names itself in a corner on its left edge: high scores (the right edge) are where the points crowd.
              <text x={qd.x + 6} y={qd.q === 'act' || qd.q === 'monitor' ? qd.y + 14 : qd.y + qd.h - 6} className="quad-label" fill={qd.ink}>
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
        <line x1={cx} x2={cx} y1={pad.t} y2={H - pad.b} stroke="#8fa3bf" strokeDasharray="4 3.3" />
        <line x1={pad.l} x2={W - pad.r} y1={cy} y2={cy} stroke="#8fa3bf" strokeDasharray="4 3.3" />
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
                stroke="#fff"
                strokeWidth="0.66"
                data-tip={`${names.get(p.id) ?? ''} — ${rc.x('tipPoint', { s: p.score, a: p.alerts, q: t(QUAD_KEY[p.q]) })}`}
              />
            )),
        )}
        {mergeRankLabels(m.points.filter((p) => p.rank != null).map((p) => ({ x: x(p.score), y: y(p.alerts), rank: p.rank! }))).map((l) => (
          <text key={l.label} x={Math.min(l.x, W - pad.r - 2)} y={l.y - 8} textAnchor={l.x > W - pad.r - 30 ? 'end' : 'middle'} className="tick strong halo">
            {l.label}
          </text>
        ))}
        <text x={(W + pad.l) / 2} y={H - 4} textAnchor="middle" className="axis-title">
          {t('t2AxisScore')}
        </text>
        <text x={12} y={H / 2} transform={`rotate(-90 12 ${H / 2})`} textAnchor="middle" className="axis-title">
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
  const answer = s.rated === 0 ? t('t2A4None') : s.critOpen + s.highOpen > 0 ? t('t2A4', { c: fmt.num(s.critOpen), h: fmt.num(s.highOpen) }) : t('t2A4Clear', { g: s.inTarget, n: s.rated })
  const excluded = s.pendingNoise ? `${t('t2FunPending')}: ${fmt.num(s.critOpen + s.highOpen)} ${rc.x('atExcluded', { m: fmt.num(s.pendingNoise) })}.` : ''
  const valueOf = (key: string, v: number | null) =>
    v == null ? '—' : key === 'handled' ? `${fmt.dec(v, 0)}%` : key === 'ack' || key === 'lead' ? fmt.dur(v) : key === 'close' ? fmt.dur(v * 60) : fmt.num(v)
  const subOf = (tile: (typeof s.tiles)[number]) => {
    if (tile.lamp === 'none') return '—'
    const k = RESP[tile.key].sub
    if (tile.key === 'highOpen') return t(k, { y: 2 })
    if (tile.key === 'handled') return t(k, { t: 90, h: fmt.num(tile.handled), c: fmt.num(tile.cases) })
    if (tile.key === 'ack') return t(k, { t: 30, n: fmt.num(tile.n) })
    if (tile.key === 'close') return t(k, { t: 24, n: fmt.num(tile.n) })
    if (tile.key === 'lead') return t(k, { n: fmt.num(tile.n) })
    return t(k)
  }
  return (
    <Question rc={rc} n={n} total={total} figure={rc.x('figStory4')} q={t('t2Q4')} a={answer} note={[excluded, cap.trim()].filter(Boolean).join(' ')}>
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
        {s.attention.length === 0 && s.rated > 0 ? <small>{t('t2RespAllGood')}</small> : null}
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
  const note = t(e.custom ? 't2N5Custom' : 't2N5', { a: fmt.dec(p.alertMin), ch: fmt.dec(p.critHighMin), m: fmt.dec(p.mediumMin), l: fmt.dec(p.lowMin), mh: fmt.dec(p.monthHours) })
  return (
    <Question rc={rc} n={n} total={total} figure={rc.x('figStory5')} q={t('t2Q5')} a={t('t2A5', { h: fmt.num(Math.round(e.savedH)), p: fmt.dec(e.savedPct * 100, 0), f: fmt.dec(e.focusPct * 100, 0) })} note={note + cap}>
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
          <b>{e.savedFte > 0 && e.savedFte < 0.1 ? `< ${fmt.dec(0.1)}` : fmt.dec(e.savedFte)}</b>
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

import { fill } from '@poc-intel/shared/i18n/report'
import type { LicenseCompliance } from '@poc-intel/shared'
import { C, Bars, HBars, Lines } from '../charts.js'
import type { ReportContext } from '../context.js'
import { isPending as isPendingStatus, rate } from '../model/derived.js'
import type { Priority, Recommendation } from '../model/recommendations.js'
import { Card, Muted, Note, P, Section, Sub, Table, VolumeNote } from '../ui.js'
import { clientName, integrationText } from './overview.js'

// The sections after MITRE (risks, operations, licensing, next steps, conclusion) and the appendices.

const PRIO_KEY: Record<Priority, 'recPrioCritical' | 'recPrioWarning' | 'recPrioInfo'> = { critical: 'recPrioCritical', warning: 'recPrioWarning', info: 'recPrioInfo' }

/** A recommendation's title and description, numbers in the Report's locale. */
function recText(rc: ReportContext, r: Recommendation) {
  const text = rc.strings.recOps[r.id] as { title: string; description: string }
  const vars = Object.fromEntries(Object.entries(r.vars).map(([k, v]) => [k, typeof v === 'number' ? (Number.isInteger(v) ? rc.fmt.num(v) : rc.fmt.dec(v)) : v]))
  return { title: fill(text.title, vars), description: fill(text.description, vars) }
}

/** Risks, Gaps and Recommendations: right after MITRE in both Templates. */
export function SectionRisks({ rc }: { rc: ReportContext }) {
  const { t, x, fmt, data, recs, d } = rc
  const exec = rc.template === 'executive'
  const ops = recs
  const crit = ops.filter((r) => r.priority === 'critical').length
  // Only techniques with a written mitigation are listed; the rest point to attack.mitre.org once.
  const techniques = d.noCases ? [] : data.tactics.mitre.techniques
  const mitigated = techniques.filter((x2) => rc.mitigation(x2.id))
  return (
    <Section rc={rc} title={t('sec8')} newPage={false}>
      {ops.length ? <p className="body strong">{x('recLead', { n: fmt.num(ops.length), crit: fmt.num(crit), top: recText(rc, ops[0]!).title })}</p> : null}
      <Sub rc={rc}>{t('sub8_1')}</Sub>
      {ops.length === 0 ? (
        <Note>{t('noOpRecs')}</Note>
      ) : (
        <Table
          rc={rc}
          compact
          cols={['30%', '12%', '58%']}
          head={[t('recTitle'), t('recPriority'), t('recDesc')]}
          rows={ops.map((r) => {
            const text = recText(rc, r)
            return [text.title, t(PRIO_KEY[r.priority]), text.description]
          })}
        />
      )}
      {techniques.length ? (
        <>
          <Sub rc={rc}>{t('sub8_2')}</Sub>
          {mitigated.length ? (
            <Table rc={rc} compact cols={['11%', '24%', '65%']} head={[t('mitreId'), t('mitreName'), t('mitreMitigation')]} rows={mitigated.map((x2) => [x2.id, x2.name, rc.mitigation(x2.id)!])} />
          ) : null}
          {mitigated.length < techniques.length ? <Muted>{x('mitreSeeAttack')}</Muted> : null}
        </>
      ) : null}
    </Section>
  )
}

/** Technical only: the generic response flow and SOAR text (the Executive Template leaves out boilerplate without client data). */
export function SectionOperations({ rc }: { rc: ReportContext }) {
  const { t } = rc
  if (rc.template === 'executive') return null
  return (
    <Section rc={rc} title={t('sec6')} newPage={false}>
      <Sub rc={rc}>{t('sub6_1')}</Sub>
      <Table rc={rc} source="static" head={[t('irStep'), t('irDesc')]} rows={[1, 2, 3, 4, 5, 6].map((n) => [t(`irStep${n}` as 'irStep1'), t(`irStep${n}desc` as 'irStep1desc')])} />
      <Sub rc={rc}>{t('sub6_2')}</Sub>
      <P>{t('body6_2')}</P>
    </Section>
  )
}

interface LicTexts {
  recommended: string
  recommendedNote: string
  limitLine: string
  shortPeriod: string
  licenseCol: string
}

/** "(since {date}, first day with data)" when the averages start after the period's first day. */
function firstDayLabel(rc: ReportContext, lic: LicenseCompliance, daily: { date: string }[]): string {
  const first = lic.firstDataDate
  return first && daily[0] && first > daily[0].date ? ` ${rc.x('firstDay', { date: rc.fmt.date(first) })}` : ''
}

/** The license compliance block shared by asset (7.3) and volume (7.4) licensing. */
function LicenseBlock({ rc, lic, daily, fmt, txt }: { rc: ReportContext; lic: LicenseCompliance; daily: { date: string }[]; fmt: (v: number) => string; txt: LicTexts }) {
  const { t } = rc
  const f = rc.fmt
  const stats = lic.stats!
  const rec = lic.recommended!
  const result = lic.scenarios.find((s) => s.key === 'recommended')
  const vars = { l: fmt(rec), t: fmt(result?.limit ?? rec * 1.1) }
  const runText = (run: { days: number; from: string; to: string } | null) =>
    !run ? t('licRunNone') : run.days === 1 ? t('licRunOneDay', { from: f.date(run.from) }) : t('licRunDays', { n: run.days, from: f.date(run.from), to: f.date(run.to) })
  const levels = [
    { key: 'licWarning', rule: 'licRuleWarning', res: 'licResWarning', days: 3 },
    { key: 'licViolation', rule: 'licRuleViolation', res: 'licResViolation', days: 7 },
    { key: 'licOoc', rule: 'licRuleOoc', res: 'licResOoc', days: 21 },
  ] as const
  const scen = { average: 'licScenAverage', recommended: 'licScenRecommended', peak: 'licScenPeak' } as const
  const levelLabel = { none: 'licLevelNone', warning: 'licWarning', violation: 'licViolation', ooc: 'licOoc' } as const
  const fillT = (s: string, extra: Record<string, string | number> = {}) => fill(s, { ...vars, ...extra })
  const since = firstDayLabel(rc, lic, daily)
  return (
    <>
      {rc.template !== 'executive' && stats.days < 30 ? <Note>{fillT(txt.shortPeriod, { n: stats.days })}</Note> : null}
      <p className="body strong navy">{fillT(txt.recommended)}</p>
      <Muted>{fillT(txt.recommendedNote, { from: f.date(lic.recommendedWindow?.from), to: f.date(lic.recommendedWindow?.to) })}</Muted>
      <P>{fillT(txt.limitLine)}</P>
      <Table
        rc={rc}
        compact
        caption={t('licTableTitle')}
        head={[t('licColLevel'), t('licColRule'), fillT(t('licColRun')), t('licColOutcome'), t('licColResult')]}
        rows={levels.map((lv) => {
          const reached = (result?.longestRun?.days ?? 0) >= lv.days
          return [t(lv.key), t(lv.rule), runText(result?.longestRun ?? null), <span className={reached ? 'bad strong' : 'ok strong'}>{t(reached ? 'licReached' : 'licNotReached')}</span>, t(lv.res)]
        })}
      />
      <Table
        rc={rc}
        compact
        caption={t('licScenarioTitle')}
        head={[t('licColScenario'), txt.licenseCol, t('licColLimit'), t('licColDaysAbove'), t('licColLongest'), t('licColLevelReached')]}
        rows={lic.scenarios.map((s) => [
          s.key === 'recommended' ? <b>{t(scen[s.key])}</b> : `${t(scen[s.key])}${s.key === 'average' ? since : ''}`,
          fmt(s.license),
          fmt(s.limit),
          f.num(s.daysAbove),
          runText(s.longestRun),
          <span className={s.level === 'none' ? 'ok strong' : 'bad strong'}>{t(levelLabel[s.level])}</span>,
        ])}
      />
    </>
  )
}

function LicenseCharts({ rc, lic, daily, fmt, kind }: { rc: ReportContext; lic: LicenseCompliance; daily: { date: string; value: number }[]; fmt: (v: number) => string; kind: 'assets' | 'volume' }) {
  const { t } = rc
  const rec = lic.recommended!
  const limit = lic.scenarios.find((s) => s.key === 'recommended')?.limit ?? rec * 1.1
  const labels = daily.map((x) => rc.fmt.dayMonth(x.date))
  const scen = { average: 'licScenAverage', recommended: 'licScenRecommended', peak: 'licScenPeak' } as const
  const refs = [
    { name: `${t('t2SeriesLicense')} (${fmt(rec)})`, value: rec, color: C.green },
    { name: `${t('t2SeriesLimit')} (${fmt(limit)})`, value: limit, color: C.red },
  ]
  return (
    <div className="grid cols-62">
      <Card rc={rc} title={t(kind === 'assets' ? 't2ChartAssets' : 't2ChartVolume')}>
        {kind === 'assets' ? (
          <Lines labels={labels} series={[{ name: t('t2SeriesAssets'), values: daily.map((x) => x.value), color: C.brand }]} refs={refs} width={420} yFormat={rc.fmt.num} />
        ) : (
          <Bars
            labels={labels}
            series={[{ name: t('t2SeriesVolume'), values: daily.map((x) => Math.round(x.value * 100) / 100), color: C.cyan }]}
            refs={refs}
            colorAt={(i) => ((daily[i]?.value ?? 0) > limit ? C.red : undefined)}
            width={420}
            integer={false}
            yFormat={(v) => rc.fmt.dec(v, v < 10 ? 2 : 0)}
          />
        )}
      </Card>
      <Card rc={rc} title={t('t2ChartScenarios')}>
        {lic.scenarios.some((s) => s.daysAbove > 0) ? (
          <HBars
            stacked
            format={rc.fmt.num}
            items={lic.scenarios.map((s) => ({
              label: `${t(scen[s.key])} (${fmt(s.license)})`,
              value: s.daysAbove,
              color: s.level === 'none' ? C.green : s.level === 'warning' ? C.medium : C.red,
            }))}
          />
        ) : null}
      </Card>
    </div>
  )
}

/** "What makes up the licensing volume": the indexes with volume in the period, largest first. */
function VolumeByIndex({ rc }: { rc: ReportContext }) {
  const { x, fmt, data } = rc
  const list = (data.volume.byIndex ?? []).filter((i) => i.gb > 0)
  if (list.length === 0) return null
  const top = list.slice(0, 8)
  const rest = list.slice(8)
  const rows = top.map((i) => [i.index, fmt.gb(i.gb), fmt.pctOf(i.share * 100)])
  if (rest.length) rows.push([x('volIndexOther', { n: fmt.num(rest.length) }), fmt.gb(rest.reduce((s, i) => s + i.gb, 0)), fmt.pctOf(rest.reduce((s, i) => s + i.share, 0) * 100)])
  return (
    <>
      <Table rc={rc} compact caption={x('volIndexTitle')} head={[x('colIndex'), 'GB', x('colShare')]} rows={rows} />
    </>
  )
}

/** The lead of the licensing section: the recommended license(s), or nothing when there is none. */
function licenseLead(rc: ReportContext): string | null {
  const { x, fmt, data, d } = rc
  const a = d.assetsZero ? null : data.assets.compliance.recommended
  const v = d.volumeZero ? null : data.volume.compliance.recommended
  if (a && v) return x('licLead', { l: fmt.num(a), g: fmt.dec(v, 2) })
  if (a) return x('licLeadAssets', { l: fmt.num(a) })
  if (v) return x('licLeadVolume', { g: fmt.dec(v, 2) })
  return null
}

export function SectionRoi({ rc }: { rc: ReportContext }) {
  const { t, x, fmt, d, data } = rc
  const exec = rc.template === 'executive'
  const s = d.assetStats
  const daysNote = s ? t('entitiesDaysNote', { days: s.days, zero: s.zeroDays }) : ''
  const assets = data.assets.compliance
  const volume = data.volume.compliance
  const vol = d.vol
  const lead = licenseLead(rc)
  const window31 = d.outside31 ? <Note>{x('window31')}</Note> : null
  const caseRows = d.noCases
    ? []
    : [
        [t('metTotalCases'), fmt.num(d.totalCases), ''],
        [t('metCritHigh'), fmt.num(d.sev.critical + d.sev.high), fmt.pct(d.sev.critical + d.sev.high, d.totalCases)],
        [t('metMitreCov'), `${d.mitreCovPct}%`, `${d.detectedTactics.size} / 14`],
      ]
  return (
    <Section rc={rc} title={t('sec7')} newPage={false}>
      {lead ? <p className="body strong">{lead}</p> : null}
      {d.noCases && !s && !vol && d.integrationPct == null ? null : (
        <>
          <Sub rc={rc}>{t('sub7_1')}</Sub>
          <Table
            rc={rc}
            head={[t('roiMetric'), t('roiValue'), t('roiContext')]}
            rows={[
              ...caseRows,
              [t('metAvgEntitiesDay'), s ? fmt.num(s.avg) : '—', `${t('entitiesNote')}${daysNote ? ` · ${daysNote}` : ''}`],
              [t('kpiMinEntities'), s ? fmt.num(s.min) : '—', t('minEntitiesNote')],
              [t('kpiMaxEntities'), s ? fmt.num(s.max) : '—', t('maxEntitiesNote')],
              [t('metActiveSources'), integrationText(rc), ''],
              [t('metTotalIngested'), vol ? fmt.vol(d.volTotal) : '—', t('ingestedNote')],
            ]}
          />
          <VolumeNote rc={rc} />
        </>
      )}
      {exec ? null : (
        <>
          <Sub rc={rc}>{t('sub7_2')}</Sub>
          <ul className="bullets">
            {[1, 2, 3, 4, 5].map((n) => (
              <li key={n}>{t(`qb${n}` as 'qb1').replace(/^\s*•\s*/, '')}</li>
            ))}
          </ul>
        </>
      )}

      <Sub rc={rc}>{t('sub7_3')}</Sub>
      <P>{t('licHowCounted')}</P>
      {window31}
      {d.assetsZero ? (
        <Note>{x('assetsZero')}</Note>
      ) : !assets.stats ? (
        <Note>{t('licNoData')}</Note>
      ) : assets.recommended == null ? (
        <Note>{t('licInsufficient', { n: assets.stats.days, d: 3 })}</Note>
      ) : (
        <>
          {exec ? <LicenseCharts rc={rc} lic={assets} daily={data.assets.daily} fmt={fmt.num} kind="assets" /> : null}
          <LicenseBlock
            rc={rc}
            lic={assets}
            daily={data.assets.daily}
            fmt={fmt.num}
            txt={{ recommended: t('licRecommended'), recommendedNote: t('licRecommendedNote'), limitLine: t('licLimitLine'), shortPeriod: t('licShortPeriod'), licenseCol: t('licColLicense') }}
          />
        </>
      )}

      <Sub rc={rc}>{t('sub7_4')}</Sub>
      <P>{t('volIntro')}</P>
      {window31}
      {!vol ? (
        <Note>{x('volumeZero')}</Note>
      ) : (
        <>
          <Table
            rc={rc}
            head={[t('roiMetric'), t('roiValue'), t('roiContext')]}
            rows={[
              [
                `${t('volAvg')}${firstDayLabel(rc, volume, data.volume.dailyGb)}`,
                fmt.vol(vol.avg),
                `${t('volPeriodNote', { days: vol.days, from: fmt.date(vol.from), to: fmt.date(vol.to) })} · ${t('volZeroNote', { zero: vol.zeroDays })}`,
              ],
              [t('volMin'), fmt.vol(vol.min), fmt.date(vol.minDate)],
              [t('volMax'), fmt.vol(vol.max), fmt.date(vol.maxDate)],
            ]}
          />
          <VolumeByIndex rc={rc} />
          {volume.recommended == null ? (
            <Note>{t('licInsufficient', { n: vol.days, d: 3 })}</Note>
          ) : (
            <>
              {exec ? <LicenseCharts rc={rc} lic={volume} daily={data.volume.dailyGb} fmt={fmt.vol} kind="volume" /> : null}
              <LicenseBlock
                rc={rc}
                lic={volume}
                daily={data.volume.dailyGb}
                fmt={fmt.vol}
                txt={{ recommended: t('volRecommended'), recommendedNote: t('volRecommendedNote'), limitLine: t('volLimitLine'), shortPeriod: t('volShortPeriod'), licenseCol: t('volColLicense') }}
              />
            </>
          )}
        </>
      )}

      {/* Auto Triage is an add-on license: stated whenever this Report's Sync collected it. */}
      {d.ai ? (
        <>
          <Sub rc={rc}>{x('licAutoTriageTitle')}</Sub>
          <P>{d.ai.status === 'no_cases' ? x('licAutoTriageNoCases') : x('licAutoTriage')}</P>
        </>
      ) : null}
    </Section>
  )
}

export function SectionNextSteps({ rc }: { rc: ReportContext }) {
  const { t } = rc
  return (
    <Section rc={rc} title={t('sec9')} newPage={false}>
      <Sub rc={rc}>{t('sub9_1')}</Sub>
      <Table
        rc={rc}
        source="static"
        head={[t('nsStep'), t('nsAction'), t('nsOwner'), t('nsDue')]}
        rows={[1, 2, 3, 4, 5].map((n) => [n, t(`ns${n}` as 'ns1'), t(`ns${n}owner` as 'ns1owner'), t(`ns${n}due` as 'ns1due')])}
      />
    </Section>
  )
}

const RATING_KEY = { high: 'ratingHigh', medium: 'ratingMed', low: 'ratingLow' } as const

/** The conclusion paragraph: built from the period's numbers only. */
export function conclusionText(rc: ReportContext): string {
  const { t, x, fmt, d, data, story } = rc
  const vars = {
    pocStartDate: fmt.date(data.period.start),
    pocEndDate: fmt.date(data.period.end),
    clientName: clientName(rc),
    caseCount: fmt.num(d.totalCases),
    mitrePct: d.mitreCovPct,
  }
  if (d.noCases) return d.volumeZero && d.sources.withData === 0 ? x('conclusionNoData', vars) : x('conclusionNoCases', vars)
  const saved = story.q5 ? Math.round(story.q5.savedPct * 100) : (d.noise?.pct ?? 0)
  return saved > 0 ? t('body10', { ...vars, p: saved }) : x('conclusionNoEffort', vars)
}

export function SectionConclusion({ rc }: { rc: ReportContext }) {
  const { t, x, fmt, d, details } = rc
  const exec = rc.template === 'executive'
  const inv = d.investigation
  const det = inv.detail
  const invNote =
    det
      ? [
          t('sc_invAlerts', { a: fmt.num(det.alerts), c: fmt.num(det.cases), r: fmt.dec(det.ratio, 1) }),
          t('sc_invHandled', { n: fmt.num(det.handled), p: det.handledPct }),
          det.medianCloseHours != null ? t('sc_invClose', { t: fmt.dur(det.medianCloseHours * 60) }) : '',
        ]
          .filter(Boolean)
          .join(' · ')
      : null
  const resolvedLoaded = d.loaded.filter((c) => !isPendingStatus(c.status)).length
  const automation = d.hasNdr && d.hasEdr ? 'sc_autoYes' : d.hasNdr ? 'sc_autoNoEDR' : 'sc_autoNoNDR'
  const verdict = details.verdict
  const rows = [
    ...(d.noCases ? [] : [[t('sc10_1'), t(RATING_KEY[rate(d.avgScore)]), `${fmt.num(d.critHigh.length)} ${t('sc_critHigh')} · ${x('scoreAvg', { n: fmt.num(d.avgScore) })}`]]),
    ...(d.noCases ? [] : [[t('sc10_2'), t(RATING_KEY[rate(inv.pct)]), invNote ?? `${fmt.num(resolvedLoaded)} ${t('sc_of')} ${fmt.num(d.loaded.length)} ${t('sc_closed')} (${inv.pct}%)`]]),
    [t('sc10_3'), t(d.hasNdr && d.hasEdr ? 'sc_yes' : 'sc_no'), t(automation)],
    ...(d.integrationPct == null ? [] : [[t('sc10_4'), t(RATING_KEY[rate(d.integrationPct)]), integrationText(rc)]]),
    ...(d.noCases ? [] : [[t('sc10_6'), t(RATING_KEY[rate(d.mitreCovPct)]), `${d.detectedTactics.size} ${t('sc_of')} 14 ${t('sc_tactics')}`]]),
  ]
  // A pending verdict with nothing to assess reads "Inconclusive", not "Pending".
  const verdictText = verdict ? rc.strings.verdict[verdict] : d.noCases ? x('verdictInconclusive') : t('verdictPending')
  return (
    <Section rc={rc} title={t('sec10')}>
      {exec ? null : (
        <>
          <Sub rc={rc}>{t('sub10_1')}</Sub>
          <Table rc={rc} head={[t('scArea'), t('scScore'), t('scNotes')]} rows={rows} />
        </>
      )}
      {/* FIX: no verdict yet is neutral, not red. */}
      <div className={`verdict-banner verdict-${verdict ?? 'pending'}`}>
        <span>{t('verdictLabel')}</span>
        <b>{verdictText}</b>
      </div>
      <P>{conclusionText(rc)}</P>
      {details.comments ? (
        <>
          <Sub rc={rc}>{t('seCommentsTitle')}</Sub>
          <p className="body prose">{details.comments}</p>
        </>
      ) : null}
      <Sub rc={rc}>{t('signaturesTitle')}</Sub>
      <div className="signatures">
        <div>
          <span className="sig-line" />
          <b>{t('sigSE')}</b>
          <span>{details.salesEngineer.name}</span>
        </div>
        <div>
          <span className="sig-line" />
          <b>{t('sigClient')}</b>
          <span>{rc.client}</span>
        </div>
      </div>
    </Section>
  )
}

const GLOSSARY = [
  ['XDR', 'gXDR'],
  ['SIEM', 'gSIEM'],
  ['SOAR', 'gSOAR'],
  ['MITRE', 'gMITRE'],
  ['MTTD', 'gMTTD'],
  ['MTTR', 'gMTTR'],
  ['PoV', 'gPoC'],
  ['SE', 'gSE'],
  ['IOC', 'gIOC'],
  ['TTP', 'gTTP'],
  ['EDR', 'gEDR'],
  ['NDR', 'gNDR'],
] as const

export function Appendices({ rc }: { rc: ReportContext }) {
  const { t, fmt, details } = rc
  return (
    <>
      <Section rc={rc} numbered={false} title={t('appendixA')}>
        <Table rc={rc} source="static" head={[t('glossTerm'), t('glossDef')]} rows={GLOSSARY.map(([term, key]) => [<b>{term}</b>, t(key)])} />
      </Section>
      <Section rc={rc} numbered={false} title={t('appendixB')} newPage={false}>
        <Table
          rc={rc}
          source="static"
          head={[t('verVersion'), t('verDate'), t('verAuthor'), t('verChanges')]}
          rows={(rc.versioning?.history ?? [{ version: rc.version, date: rc.generatedAt.toISOString(), author: null, changes: null, first: true, period: null }]).map((v) => [
            <b>{v.version}</b>,
            fmt.date(v.date),
            v.author || details.salesEngineer.name || '—',
            v.changes ?? (v.first ? t('verInitial') : rc.x('verNewSync', { start: v.period ? fmt.date(v.period.start) : '—', end: v.period ? fmt.date(v.period.end) : '—' })),
          ])}
        />
      </Section>
    </>
  )
}


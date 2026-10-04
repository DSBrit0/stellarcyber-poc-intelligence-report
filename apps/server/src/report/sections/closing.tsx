import type { LicenseCompliance } from '@poc-intel/shared'
import { C, Bars, Donut, Lines } from '../charts.js'
import type { ReportContext } from '../context.js'
import { rate } from '../model/derived.js'
import type { Priority } from '../model/recommendations.js'
import { Card, Grid, Muted, Note, P, Section, Sub, Table } from '../ui.js'

// Sections 6–10 and the appendices (spec T1.6–T1.AB, E.6–E.AB).

const PRIO_KEY: Record<Priority, 'recPrioCritical' | 'recPrioWarning' | 'recPrioInfo'> = { critical: 'recPrioCritical', warning: 'recPrioWarning', info: 'recPrioInfo' }

/** Risks, Gaps and Recommendations — section 8 (drawn as 6 in the Executive Template). */
export function SectionRisks({ rc }: { rc: ReportContext }) {
  const { t, fmt, data, recs, strings } = rc
  const exec = rc.template === 'executive'
  const ops = recs
  const counts = (['critical', 'warning', 'info'] as const).map((p) => ({ p, n: ops.filter((r) => r.priority === p).length })).filter((x) => x.n > 0)
  const techniques = data.tactics.mitre.techniques
  return (
    <Section rc={rc} n={exec ? 6 : 8} title={t('sec8')} newPage={false}>
      <Sub rc={rc}>{t('sub8_1')}</Sub>
      {ops.length === 0 ? (
        <Note>{t('noOpRecs')}</Note>
      ) : (
        <>
          {exec ? (
            <Grid>
              <Card title={t('t2ChartRecPrio')}>
                <Donut
                  cutout={0.55}
                  slices={counts.map(({ p, n }) => ({ label: t(PRIO_KEY[p]), value: n, color: p === 'critical' ? C.red : p === 'warning' ? C.orange : C.brand }))}
                />
              </Card>
              <div />
            </Grid>
          ) : null}
          <Table
            compact
            head={[t('recTitle'), t('recPriority'), t('recDesc')]}
            rows={ops.map((r) => {
              const text = strings.recOps[r.id] as { title: string; description: string }
              return [fmt.trunc(fillAll(text.title, r.vars), 40), t(PRIO_KEY[r.priority]), fmt.trunc(fillAll(text.description, r.vars), 80)]
            })}
          />
        </>
      )}
      <Sub rc={rc}>{t('sub8_2')}</Sub>
      {techniques.length === 0 ? (
        <Note>{t('noMitreRecs')}</Note>
      ) : (
        <Table
          compact
          head={[t('mitreId'), t('mitreName'), t('mitreMitigation')]}
          rows={techniques.map((x) => [x.id, fmt.trunc(x.name, 40), fmt.trunc(rc.mitigation(x.id) ?? `attack.mitre.org/techniques/${x.id.replace('.', '/')}`, 110)])}
        />
      )}
    </Section>
  )
}

const fillAll = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))

export function SectionOperations({ rc }: { rc: ReportContext }) {
  const { t } = rc
  return (
    <Section rc={rc} n={rc.template === 'executive' ? 7 : 6} title={t('sec6')} newPage={false}>
      <Sub rc={rc}>{t('sub6_1')}</Sub>
      <Table head={[t('irStep'), t('irDesc')]} rows={[1, 2, 3, 4, 5, 6].map((n) => [t(`irStep${n}` as 'irStep1'), t(`irStep${n}desc` as 'irStep1desc')])} />
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
  desc: string[]
}

/** The license compliance block shared by asset (7.3) and volume (7.4) licensing. */
function LicenseBlock({ rc, lic, fmt, txt }: { rc: ReportContext; lic: LicenseCompliance; fmt: (v: number) => string; txt: LicTexts }) {
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
  const fillT = (s: string, extra: Record<string, string | number> = {}) => fillAll(s, { ...vars, ...extra })
  return (
    <>
      {rc.template !== 'executive' && stats.days < 30 ? <Note>{fillT(txt.shortPeriod, { n: stats.days })}</Note> : null}
      <p className="body strong navy">{fillT(txt.recommended)}</p>
      <Muted>
        {fillT(txt.recommendedNote, { from: f.date(lic.recommendedWindow?.from), to: f.date(lic.recommendedWindow?.to) })}
      </Muted>
      <P>{fillT(txt.limitLine)}</P>
      <p className="body strong">{t('licTableTitle')}</p>
      <Table
        compact
        head={[t('licColLevel'), t('licColRule'), fillT(t('licColRun')), t('licColOutcome'), t('licColResult')]}
        rows={levels.map((lv) => {
          const reached = (result?.longestRun?.days ?? 0) >= lv.days
          return [t(lv.key), t(lv.rule), runText(result?.longestRun ?? null), <span className={reached ? 'bad strong' : 'ok strong'}>{t(reached ? 'licReached' : 'licNotReached')}</span>, t(lv.res)]
        })}
      />
      <p className="body strong">{t('licScenarioTitle')}</p>
      <Table
        compact
        head={[t('licColScenario'), txt.licenseCol, t('licColLimit'), t('licColDaysAbove'), t('licColLongest'), t('licColLevelReached')]}
        rows={lic.scenarios.map((s) => [
          s.key === 'recommended' ? <b>{t(scen[s.key])}</b> : t(scen[s.key]),
          fmt(s.license),
          fmt(s.limit),
          s.daysAbove,
          runText(s.longestRun),
          <span className={s.level === 'none' ? 'ok strong' : 'bad strong'}>{t(levelLabel[s.level])}</span>,
        ])}
      />
      {txt.desc.map((p) => (
        <P key={p}>{fillT(p)}</P>
      ))}
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
      <Card title={t(kind === 'assets' ? 't2ChartAssets' : 't2ChartVolume')}>
        {kind === 'assets' ? (
          <Lines labels={labels} series={[{ name: t('t2SeriesAssets'), values: daily.map((x) => x.value), color: C.brand }]} refs={refs} />
        ) : (
          <>
            <Bars labels={labels} series={[{ name: t('t2SeriesVolume'), values: daily.map((x) => Math.round(x.value * 100) / 100), color: C.cyan }]} colorAt={(i) => ((daily[i]?.value ?? 0) > limit ? C.red : undefined)} />
            <Muted>
              {refs.map((r) => r.name).join(' · ')}
            </Muted>
          </>
        )}
      </Card>
      <Card title={t('t2ChartScenarios')}>
        <Bars
          labels={lic.scenarios.map((s) => `${t(scen[s.key])} ${fmt(s.license)}`)}
          series={[{ name: t('licColDaysAbove'), values: lic.scenarios.map((s) => s.daysAbove), color: C.green }]}
          colorAt={(i) => {
            const level = lic.scenarios[i]?.level
            return level === 'none' ? C.green : level === 'warning' ? C.medium : C.red
          }}
          showValues
        />
      </Card>
    </div>
  )
}

export function SectionRoi({ rc }: { rc: ReportContext }) {
  const { t, fmt, d, data } = rc
  const exec = rc.template === 'executive'
  const s = d.assetStats
  const daysNote = s ? t('entitiesDaysNote', { days: s.days, zero: s.zeroDays }) : ''
  const assets = data.assets.compliance
  const volume = data.volume.compliance
  const vol = d.vol
  const descKeys = (prefix: 'lic' | 'vol') => (['DescIntro', 'DescWarning', 'DescViolation', 'DescOoc', 'DescBreak'] as const).map((k) => t(`${prefix}${k}` as 'licDescIntro'))
  return (
    <Section rc={rc} n={exec ? 8 : 7} title={t('sec7')} newPage={false}>
      <Sub rc={rc}>{t('sub7_1')}</Sub>
      <Table
        head={[t('roiMetric'), t('roiValue'), t('roiContext')]}
        rows={[
          [t('metTotalCases'), fmt.num(d.totalCases), ''],
          [t('metCritHigh'), fmt.num(d.critHigh.length), fmt.pct(d.critHigh.length, d.totalCases)],
          [t('metMitreCov'), `${d.mitreCovPct}%`, `${d.detectedTactics.size} / 14`],
          [t('metAvgEntitiesDay'), s ? fmt.num(s.avg) : '—', `${t('entitiesNote')}${daysNote ? ` · ${daysNote}` : ''}`],
          [t('kpiMinEntities'), s ? fmt.num(s.min) : '—', t('minEntitiesNote')],
          [t('kpiMaxEntities'), s ? fmt.num(s.max) : '—', t('maxEntitiesNote')],
          [t('metActiveSources'), fmt.num(d.activeConnectors), `${t('of')} ${fmt.num(data.connectors.length)}`],
          [t('metTotalIngested'), vol ? fmt.vol(vol.total) : '—', t('ingestedNote')],
        ]}
      />
      <Sub rc={rc}>{t('sub7_2')}</Sub>
      {[1, 2, 3, 4, 5].map((n) => (
        <P key={n}>{t(`qb${n}` as 'qb1')}</P>
      ))}

      <Sub rc={rc}>{t('sub7_3')}</Sub>
      <P>{t('licHowCounted')}</P>
      {!assets.stats ? (
        <Note>{t('licNoData')}</Note>
      ) : assets.recommended == null ? (
        <Note>{t('licInsufficient', { n: assets.stats.days, d: 3 })}</Note>
      ) : (
        <>
          {exec ? <LicenseCharts rc={rc} lic={assets} daily={data.assets.daily} fmt={fmt.num} kind="assets" /> : null}
          <LicenseBlock
            rc={rc}
            lic={assets}
            fmt={fmt.num}
            txt={{ recommended: t('licRecommended'), recommendedNote: t('licRecommendedNote'), limitLine: t('licLimitLine'), shortPeriod: t('licShortPeriod'), licenseCol: t('licColLicense'), desc: descKeys('lic') }}
          />
        </>
      )}

      <Sub rc={rc}>{t('sub7_4')}</Sub>
      <P>{t('volIntro')}</P>
      {!vol ? (
        <Note>{t('volNoData')}</Note>
      ) : (
        <>
          <Table
            head={[t('roiMetric'), t('roiValue'), t('roiContext')]}
            rows={[
              [t('volAvg'), fmt.vol(vol.avg), `${t('volPeriodNote', { days: vol.days, from: fmt.date(vol.from), to: fmt.date(vol.to) })} · ${t('volZeroNote', { zero: vol.zeroDays })}`],
              [t('volMin'), fmt.vol(vol.min), fmt.date(vol.minDate)],
              [t('volMax'), fmt.vol(vol.max), fmt.date(vol.maxDate)],
            ]}
          />
          <Muted>{t('volNote')}</Muted>
          {volume.recommended == null ? (
            <Note>{t('licInsufficient', { n: vol.days, d: 3 })}</Note>
          ) : (
            <>
              {exec ? <LicenseCharts rc={rc} lic={volume} daily={data.volume.dailyGb} fmt={fmt.vol} kind="volume" /> : null}
              <LicenseBlock
                rc={rc}
                lic={volume}
                fmt={fmt.vol}
                txt={{ recommended: t('volRecommended'), recommendedNote: t('volRecommendedNote'), limitLine: t('volLimitLine'), shortPeriod: t('volShortPeriod'), licenseCol: t('volColLicense'), desc: descKeys('vol') }}
              />
            </>
          )}
        </>
      )}

      {/* Auto Triage is an add-on license: stated whenever this Report's Sync collected it. */}
      {data.aiTriage ? (
        <>
          <Sub rc={rc}>{rc.x('licAutoTriageTitle')}</Sub>
          <P>{rc.x('licAutoTriage')}</P>
        </>
      ) : null}
    </Section>
  )
}

export function SectionNextSteps({ rc }: { rc: ReportContext }) {
  const { t } = rc
  return (
    <Section rc={rc} n={9} title={t('sec9')} newPage={false}>
      <Sub rc={rc}>{t('sub9_1')}</Sub>
      <Table
        head={[t('nsStep'), t('nsAction'), t('nsOwner'), t('nsDue')]}
        rows={[1, 2, 3, 4, 5].map((n) => [n, t(`ns${n}` as 'ns1'), t(`ns${n}owner` as 'ns1owner'), t(`ns${n}due` as 'ns1due')])}
      />
    </Section>
  )
}

const RATING_KEY = { high: 'ratingHigh', medium: 'ratingMed', low: 'ratingLow' } as const

export function SectionConclusion({ rc }: { rc: ReportContext }) {
  const { t, fmt, d, data, details } = rc
  const exec = rc.template === 'executive'
  const inv = d.investigation
  const det = inv.detail
  const invNote =
    det
      ? [
          t('sc_invAlerts', { a: fmt.num(det.alerts), c: fmt.num(det.cases), r: fmt.dec(det.ratio, 1) }),
          t('sc_invHandled', { n: fmt.num(det.handled), p: det.handledPct }),
          det.medianCloseHours != null ? t('sc_invClose', { t: det.medianCloseHours < 1 ? `${Math.round(det.medianCloseHours * 60)} min` : `${fmt.dec(det.medianCloseHours, 1)} h` }) : '',
        ]
          .filter(Boolean)
          .join(' · ')
      : null
  const resolvedLoaded = d.loaded.filter((c) => !['new', 'open'].includes(c.status.toLowerCase())).length
  const automation = d.hasNdr && d.hasEdr ? 'sc_autoYes' : d.hasNdr ? 'sc_autoNoEDR' : 'sc_autoNoNDR'
  const verdict = details.verdict
  return (
    <Section rc={rc} n={10} title={t('sec10')}>
      {exec ? null : (
        <>
          <Sub rc={rc}>{t('sub10_1')}</Sub>
          <Table
            head={[t('scArea'), t('scScore'), t('scNotes')]}
            rows={[
              [t('sc10_1'), t(RATING_KEY[rate(d.avgScore)]), `${fmt.num(d.critHigh.length)} ${t('sc_critHigh')} | Score: ${d.avgScore}`],
              [t('sc10_2'), t(RATING_KEY[rate(inv.pct)]), invNote ?? `${resolvedLoaded} ${t('sc_of')} ${d.loaded.length} ${t('sc_closed')} (${inv.pct}%)`],
              [t('sc10_3'), t(d.hasNdr && d.hasEdr ? 'sc_yes' : 'sc_no'), t(automation)],
              [t('sc10_4'), t(RATING_KEY[rate(d.integrationPct)]), data.connectors.length ? `${d.activeConnectors}/${data.connectors.length} (${d.integrationPct}%)` : '—'],
              [t('sc10_6'), t(RATING_KEY[rate(d.mitreCovPct)]), `${d.detectedTactics.size} ${t('sc_of')} 14 ${t('sc_tactics')}`],
            ]}
          />
        </>
      )}
      {/* FIX: no verdict yet is neutral, not red. */}
      <div className={`verdict-banner verdict-${verdict ?? 'pending'}`}>
        <span>{t('verdictLabel')}</span>
        <b>{verdict ? rc.strings.verdict[verdict] : t('verdictPending')}</b>
      </div>
      <P>
        {t('body10', {
          pocStartDate: fmt.date(data.period.start),
          pocEndDate: fmt.date(data.period.end),
          clientName: details.customerName || t('clientNamePlaceholder'),
          caseCount: fmt.num(d.totalCases),
          mitrePct: d.mitreCovPct,
        })}
      </P>
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
          <span>{details.customerName}</span>
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
  ['PoC', 'gPoC'],
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
      <Section rc={rc} title={t('appendixA')}>
        <Table head={[t('glossTerm'), t('glossDef')]} rows={GLOSSARY.map(([term, key]) => [<b>{term}</b>, t(key)])} />
      </Section>
      <Section rc={rc} title={t('appendixB')} newPage={false}>
        <Table
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


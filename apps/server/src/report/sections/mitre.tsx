import { C, Donut, HBars, PALETTE, Radar, StageFlow } from '../charts.js'
import type { ReportContext } from '../context.js'
import { ALL_TACTICS } from '../model/constants.js'
import { Card, Figure, Grid, Kpis, Note, P, Section, Sub, Table } from '../ui.js'

// Section 5 — MITRE ATT&CK coverage (spec T1.5, E.5).

/** Radar labels short enough to sit beside the ring without clipping. */
const SHORT: Record<string, string> = {
  Reconnaissance: 'Recon',
  'Resource Development': 'Resource Dev.',
  'Initial Access': 'Initial Access',
  'Privilege Escalation': 'Priv. Escalation',
  'Defense Evasion': 'Def. Evasion',
  'Credential Access': 'Cred. Access',
  'Lateral Movement': 'Lateral Mov.',
  'Command and Control': 'C2',
}

/** Kill Chain stages from first contact (blue) to impact (red). */
const STAGE_COLORS = [C.mid, C.brand, C.cyan, C.orange, C.red]

/** XDR Kill Chain stages in order: alerts per stage, cases under it; left out when nothing was staged. */
function KillChain({ rc }: { rc: ReportContext }) {
  const { x, t, fmt, data } = rc
  const stages = data.tactics.killChain ?? []
  if (!stages.some((s) => s.alerts > 0)) return null
  return (
    <Card rc={rc} wide className="killchain" title={x('chartKillChain')}>
      <StageFlow
        format={fmt.num}
        stages={stages.map((s, i) => ({ label: rc.killChainStage(s.stage), value: s.alerts, sub: `${fmt.num(s.cases)} ${t('xtaCases').toLowerCase()}`, color: STAGE_COLORS[i % STAGE_COLORS.length]! }))}
      />
    </Card>
  )
}

export function Section5({ rc }: { rc: ReportContext }) {
  const { t, x, fmt, d, data } = rc
  const exec = rc.template === 'executive'
  // Without Cases section 4 says there is nothing to show, for both sections.
  if (d.noCases) return null
  const missing = ALL_TACTICS.filter((tac) => !d.detectedTactics.has(tac.id)).map((tac) => tac.name)
  const xdrOnly = Object.values(data.tactics.byCase).filter((c) => c.xdr.length > 0 && c.tactics.length === 0).length
  const byId = new Map(data.tactics.mitre.tactics.map((x) => [x.id, x]))
  const maxAlerts = Math.max(1, ...data.tactics.mitre.tactics.map((x) => x.alertCount))
  const techniques = data.tactics.mitre.techniques
  const xdr = data.tactics.xdr
  return (
    <Section rc={rc} title={t('sec5')}>
      <p className="body strong">
        {missing.length ? x('mitreLead', { detected: d.detectedTactics.size, total: ALL_TACTICS.length, missing: missing.join(', ') }) : x('mitreLeadAll', { total: ALL_TACTICS.length })}
      </p>
      {d.mitreGap != null ? <Note>{x('mitreUnderestimated', { p: Math.round(d.mitreGap * 100) })}</Note> : null}
      <Sub rc={rc}>{t('sub5_2')}</Sub>
      <Kpis
        rc={rc}
        items={[
          { label: t('covDetected'), value: String(d.detectedTactics.size), tone: 'brand' as const },
          { label: t('covNotDetected'), value: String(14 - d.detectedTactics.size), tone: 'muted' },
          { label: t('covTotal'), value: '14', tone: 'navy' },
        ]}
      />
      {exec ? (
        <>
          <Figure rc={rc} title={x('figMitreMatrix')} note={t('t2MatrixNote')}>
            <div className="tactic-grid">
              {ALL_TACTICS.map((tac) => {
                const e = byId.get(tac.id)
                const r = e ? Math.log(1 + e.alertCount) / Math.log(1 + maxAlerts) : -1
                const level = r < 0 ? 'none' : r > 0.75 ? 'high' : r > 0.4 ? 'mid' : 'low'
                return (
                  <div key={tac.id} className={`tactic heat-${level}`} data-tip={`${tac.id} ${tac.name}: ${e ? rc.x('tipTacticDetected', { c: fmt.num(e.caseCount), a: fmt.num(e.alertCount) }) : rc.x('tipTacticNone')}`}>
                    <b>{tac.id}</b>
                    <span>{tac.name}</span>
                    <small>{e ? fmt.num(e.alertCount) : '—'}</small>
                  </div>
                )
              })}
            </div>
            <div className="legend">
              <span>
                <i className="heat-none" />
                {t('t2LegendNone')}
              </span>
              <span>
                <i className="heat-low" />
                {t('t2LegendLow')}
              </span>
              <span>
                <i className="heat-mid" />
                {t('t2LegendMid')}
              </span>
              <span>
                <i className="heat-high" />
                {t('t2LegendHigh')}
              </span>
            </div>
          </Figure>
          <Grid>
            <Card rc={rc} title={t('t2ChartRadar')} note={t('t2RadarNote')}>
              {data.tactics.mitre.tactics.some((x2) => x2.caseCount > 0) ? (
                <Radar format={fmt.num} axes={ALL_TACTICS.map((tac) => ({ label: SHORT[tac.name] ?? tac.name, value: byId.get(tac.id)?.caseCount ?? 0 }))} />
              ) : null}
            </Card>
            <Card rc={rc} title={t('t2ChartXdr')} note={t('t2XdrNote')}>
              {xdr.tactics.some((x2) => x2.alertCount > 0) ? <Donut cutout={0.55} format={fmt.num} slices={xdr.tactics.map((x2, i) => ({ label: x2.name || x2.id, value: x2.alertCount, color: PALETTE[i % PALETTE.length] }))} /> : null}
            </Card>
          </Grid>
          <KillChain rc={rc} />
        </>
      ) : (
        <Figure rc={rc} title={x('figMitreMatrix')}>
          <div className="tactic-grid">
            {ALL_TACTICS.map((tac) => (
              <div
                key={tac.id}
                className={`tactic ${d.detectedTactics.has(tac.id) ? 'on' : 'off'}`}
                data-tip={`${tac.id} ${tac.name}: ${byId.get(tac.id) ? rc.x('tipTacticDetected', { c: fmt.num(byId.get(tac.id)!.caseCount), a: fmt.num(byId.get(tac.id)!.alertCount) }) : rc.x('tipTacticNone')}`}
              >
                <b>{tac.id}</b>
                <span>{tac.name}</span>
              </div>
            ))}
          </div>
        </Figure>
      )}
      {exec ? null : <KillChain rc={rc} />}

      <Sub rc={rc}>{t('sub5_1')}</Sub>
      <Table
        rc={rc}
        head={[t('tacticId'), t('tacticName'), t('tacticStatus')]}
        rows={ALL_TACTICS.map((tac) => [
          tac.id,
          tac.name,
          d.detectedTactics.has(tac.id) ? <span className="ok strong">{t('detected')}</span> : <span className="muted">{t('notDetected')}</span>,
        ])}
      />

      {techniques.length ? (
        <Card rc={rc} wide title={t('chartTechniques')}>
          <HBars format={fmt.num} items={techniques.slice(0, 10).map((x2) => ({ label: fmt.trunc(`${x2.id} — ${x2.name}`, 64), value: x2.caseCount, color: C.brand }))} />
        </Card>
      ) : null}

      {xdr.tactics.length ? (
        <>
          <Sub rc={rc}>{t('sub5_3')}</Sub>
          {xdrOnly ? <P>{t('body5_3', { n: fmt.num(xdrOnly) })}</P> : null}
          <Table
            rc={rc}
            head={[t('xtaTacticId'), t('xtaTacticName'), t('xtaCases'), t('xtaAlerts')]}
            rows={xdr.tactics.map((x) => [<b className="brand">{x.id}</b>, x.name, fmt.num(x.caseCount), fmt.num(x.alertCount)])}
          />
          {xdr.techniques.length ? (
            <>
              <Table
                rc={rc}
                compact
                caption={t('sub5_3_tech')}
                head={[t('xtaTechId'), t('xtaTechName'), t('xtaTactic'), t('xtaCases')]}
                rows={xdr.techniques.slice(0, 20).map((x) => [x.id, x.name, x.tacticName ?? '', fmt.num(x.caseCount)])}
              />
            </>
          ) : null}
        </>
      ) : null}
    </Section>
  )
}

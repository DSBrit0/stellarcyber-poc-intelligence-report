import { C, Donut, HBars, PALETTE, Radar } from '../charts.js'
import type { ReportContext } from '../context.js'
import { ALL_TACTICS } from '../model/constants.js'
import { Card, Grid, Kpis, P, Section, Sub, Table } from '../ui.js'

// Section 5 — MITRE ATT&CK coverage (spec T1.5, E.5).

const SHORT: Record<string, string> = { 'Command and Control': 'C2', 'Resource Development': 'Resource Dev.', 'Privilege Escalation': 'Priv. Escalation' }

export function Section5({ rc }: { rc: ReportContext }) {
  const { t, fmt, d, data } = rc
  const exec = rc.template === 'executive'
  const byId = new Map(data.tactics.mitre.tactics.map((x) => [x.id, x]))
  const maxAlerts = Math.max(1, ...data.tactics.mitre.tactics.map((x) => x.alertCount))
  const techniques = data.tactics.mitre.techniques
  const xdr = data.tactics.xdr
  return (
    <Section rc={rc} n={5} title={t('sec5')}>
      <Sub rc={rc}>{t('sub5_2')}</Sub>
      <Kpis
        rc={rc}
        items={[
          { label: t('covDetected'), value: String(d.detectedTactics.size), tone: 'brand' },
          { label: t('covNotDetected'), value: String(14 - d.detectedTactics.size), tone: 'muted' },
          { label: t('covTotal'), value: '14', tone: 'navy' },
        ]}
      />
      {exec ? (
        <>
          <p className="muted italic">{t('t2MatrixNote')}</p>
          <div className="tactic-grid">
            {ALL_TACTICS.map((tac) => {
              const e = byId.get(tac.id)
              const r = e ? Math.log(1 + e.alertCount) / Math.log(1 + maxAlerts) : -1
              const level = r < 0 ? 'none' : r > 0.75 ? 'high' : r > 0.4 ? 'mid' : 'low'
              return (
                <div key={tac.id} className={`tactic heat-${level}`}>
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
          <Grid>
            <Card title={t('t2ChartRadar')} note={t('t2RadarNote')}>
              <Radar axes={ALL_TACTICS.map((tac) => ({ label: `${SHORT[tac.name] ?? tac.name} (${byId.get(tac.id)?.caseCount ?? 0})`, value: byId.get(tac.id)?.caseCount ?? 0 }))} />
            </Card>
            <Card title={t('t2ChartXdr')} note={t('t2XdrNote')}>
              {xdr.tactics.length ? <Donut cutout={0.55} slices={xdr.tactics.map((x, i) => ({ label: x.name || x.id, value: x.alertCount, color: PALETTE[i % PALETTE.length] }))} /> : null}
            </Card>
          </Grid>
        </>
      ) : (
        <div className="tactic-grid">
          {ALL_TACTICS.map((tac) => (
            <div key={tac.id} className={`tactic ${d.detectedTactics.has(tac.id) ? 'on' : 'off'}`}>
              <b>{tac.id}</b>
              <span>{tac.name}</span>
            </div>
          ))}
        </div>
      )}

      <Sub rc={rc}>{t('sub5_1')}</Sub>
      <Table
        head={[t('tacticId'), t('tacticName'), t('tacticStatus')]}
        rows={ALL_TACTICS.map((tac) => [
          tac.id,
          tac.name,
          d.detectedTactics.has(tac.id) ? <span className="ok strong">{t('detected')}</span> : <span className="muted">{t('notDetected')}</span>,
        ])}
      />

      {techniques.length ? (
        <Card wide title={t('chartTechniques')}>
          <HBars items={techniques.slice(0, 10).map((x) => ({ label: fmt.trunc(`${x.id} — ${x.name}`, 45), value: x.caseCount, color: C.brand }))} />
        </Card>
      ) : null}

      {xdr.tactics.length ? (
        <>
          <Sub rc={rc}>{t('sub5_3')}</Sub>
          <P>{t('body5_3')}</P>
          <Table
            head={[t('xtaTacticId'), t('xtaTacticName'), t('xtaCases'), t('xtaAlerts')]}
            rows={xdr.tactics.map((x) => [<b className="brand">{x.id}</b>, x.name, fmt.num(x.caseCount), fmt.num(x.alertCount)])}
          />
          {xdr.techniques.length ? (
            <>
              <p className="body strong">{t('sub5_3_tech')}</p>
              <Table
                compact
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

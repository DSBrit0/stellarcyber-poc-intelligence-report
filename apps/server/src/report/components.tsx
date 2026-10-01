import type { LicenseCompliance, ReportData } from '@poc-intel/shared'
import type { ReactNode } from 'react'
import type { ReportContext } from './context.js'

export function Section({ id, number, title, children }: { id: string; number?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="section">
      <h2>
        {number ? <span className="num">{number}</span> : null}
        {title}
      </h2>
      {children}
    </section>
  )
}

export function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'critical' | 'high' | 'ok' }) {
  return (
    <div className={`kpi ${tone ?? ''}`}>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  )
}

export function Unavailable({ ctx }: { ctx: ReportContext }) {
  return <p className="muted">{ctx.t('section.unavailable')}</p>
}

export const hasGap = (data: ReportData, collector: string) => data.gaps.some((g) => g.collector === collector)

const SEVERITY_KEYS = ['critical', 'high', 'medium', 'low'] as const

export function SeverityBars({ ctx }: { ctx: ReportContext }) {
  const counts = ctx.data.cases.bySeverity
  const max = Math.max(1, ...SEVERITY_KEYS.map((k) => counts[k]))
  return (
    <div className="bars" role="list">
      {SEVERITY_KEYS.map((k) => (
        <div key={k} className="bar-row" role="listitem">
          <span className="bar-label">{ctx.t(`severity.${k}`)}</span>
          <span className="bar-track">
            <span className={`bar-fill sev-${k}`} style={{ width: `${(counts[k] / max) * 100}%` }} />
          </span>
          <span className="bar-value">{ctx.fmt.int(counts[k])}</span>
        </div>
      ))}
    </div>
  )
}

/** Inline SVG line of a daily series: no scripts, renders identically on screen and in the PDF. */
export function Sparkline({ points, height = 64 }: { points: { date: string; value: number }[]; height?: number }) {
  if (points.length < 2) return null
  const width = 600
  const max = Math.max(...points.map((p) => p.value), 1)
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${((i / (points.length - 1)) * width).toFixed(1)},${(height - (p.value / max) * (height - 4) - 2).toFixed(1)}`)
    .join(' ')
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function ComplianceTable({ ctx, compliance, unit }: { ctx: ReportContext; compliance: LicenseCompliance; unit: 'assets' | 'gb' }) {
  const n = (v: number) => (unit === 'gb' ? ctx.fmt.dec(v) : ctx.fmt.int(v))
  if (!compliance.stats) return <Unavailable ctx={ctx} />
  return (
    <>
      <div className="kpis">
        <Kpi label="min" value={n(compliance.stats.min)} />
        <Kpi label="avg" value={n(compliance.stats.avg)} />
        <Kpi label="max" value={n(compliance.stats.max)} />
        {compliance.recommended != null ? <Kpi label={ctx.t('metric.recommendedLicense')} value={n(compliance.recommended)} tone="ok" /> : null}
      </div>
      <table>
        <thead>
          <tr>
            <th>Scenario</th>
            <th>License</th>
            <th>110% limit</th>
            <th>Days above</th>
            <th>Level</th>
          </tr>
        </thead>
        <tbody>
          {compliance.scenarios.map((s) => (
            <tr key={s.key}>
              <td>{s.key}</td>
              <td>{n(s.license)}</td>
              <td>{n(s.limit)}</td>
              <td>{s.daysAbove}</td>
              <td className={`level-${s.level}`}>{s.level}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

export function Cover({ ctx, variant }: { ctx: ReportContext; variant: 'light' | 'dark' }) {
  const { details, data } = ctx
  return (
    <header className={`cover cover-${variant}`}>
      <div className="cover-kicker">Stellar Cyber · Proof of Concept</div>
      <h1>{details.customerName}</h1>
      <p className="cover-sub">
        {ctx.t(`template.${ctx.template}`)} · {ctx.fmt.date(data.period.start)} – {ctx.fmt.date(data.period.end)}
      </p>
      <dl className="cover-meta">
        <div>
          <dt>{ctx.t('poc.tenant')}</dt>
          <dd>{data.tenant.name || data.tenant.id}</dd>
        </div>
        {details.salesEngineer.name ? (
          <div>
            <dt>{ctx.t('role.sales_engineer')}</dt>
            <dd>{details.salesEngineer.name}</dd>
          </div>
        ) : null}
        {details.partner.name ? (
          <div>
            <dt>{ctx.t('role.partner')}</dt>
            <dd>
              {details.partner.name}
              {details.partner.company ? ` · ${details.partner.company}` : ''}
            </dd>
          </div>
        ) : null}
      </dl>
    </header>
  )
}

import type { ReactNode } from 'react'

// Inline-SVG charts for the Reports: no scripts and no external assets, so the on-screen page and the
// printed PDF are pixel-identical. Colors come from CSS variables declared in styles.ts.

export const C = {
  critical: 'var(--crit)',
  high: 'var(--high)',
  medium: 'var(--med)',
  low: 'var(--low)',
  brand: 'var(--brand)',
  navy: 'var(--navy)',
  mid: 'var(--mid)',
  cyan: 'var(--cyan)',
  green: 'var(--ok)',
  orange: 'var(--high)',
  red: 'var(--crit)',
  muted: 'var(--line)',
} as const
export const PALETTE = [C.navy, C.brand, C.cyan, 'var(--light)', 'var(--slate)', C.mid, C.green, C.orange]

export interface Slice {
  label: string
  value: number
  color?: string
  /** Extra insight shown on hover in the interactive presentation. */
  tip?: string
}

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const
}

function arc(cx: number, cy: number, r: number, inner: number, from: number, to: number) {
  const large = to - from > 180 ? 1 : 0
  const [x1, y1] = polar(cx, cy, r, from)
  const [x2, y2] = polar(cx, cy, r, to)
  if (inner <= 0) return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`
  const [x3, y3] = polar(cx, cy, inner, to)
  const [x4, y4] = polar(cx, cy, inner, from)
  return `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${inner},${inner} 0 ${large} 0 ${x4},${y4} Z`
}

const fmtPct = (v: number, total: number) => (total ? Math.round((v / total) * 100) : 0)

/** Doughnut or pie (cutout 0) with an optional centre text and a legend "label: value (pct%)". */
export function Donut({
  slices,
  cutout = 0.62,
  center,
  sub,
  legend = true,
  format = String,
}: {
  slices: Slice[]
  cutout?: number
  center?: string
  sub?: string
  legend?: boolean
  format?: (v: number) => string
}) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  if (total <= 0) return null
  let at = 0
  const r = 50
  return (
    <figure className="chart donut">
      <svg viewBox="0 0 120 120" role="img" aria-label={slices.map((s) => `${s.label} ${s.value}`).join(', ')}>
        {slices.map((s, i) => {
          if (s.value <= 0) return null
          const from = (at / total) * 360
          at += s.value
          const to = Math.min(359.999, (at / total) * 360)
          const color = s.color ?? PALETTE[i % PALETTE.length]
          const mid = (from + to) / 2
          const [lx, ly] = polar(60, 60, r * (cutout ? (1 + cutout) / 2 : 0.62), mid)
          const pct = fmtPct(s.value, total)
          return (
            <g key={s.label} data-series={s.label}>
              <path
                d={slices.filter((x) => x.value > 0).length === 1 ? arc(60, 60, r, r * cutout, 0, 359.999) : arc(60, 60, r, r * cutout, from, to)}
                fill={color}
                data-tip={`${s.label}: ${format(s.value)} (${pct}%)${s.tip ? ` — ${s.tip}` : ''}`}
              />
              {pct >= 6 && !center ? (
                <text x={lx} y={ly} className="slice-label" textAnchor="middle" dominantBaseline="central">
                  {pct}%
                </text>
              ) : null}
            </g>
          )
        })}
        {center ? (
          <>
            <text x="60" y={sub ? 57 : 60} textAnchor="middle" dominantBaseline="central" className="donut-center">
              {center}
            </text>
            {sub ? (
              <text x="60" y="72" textAnchor="middle" className="donut-sub">
                {sub}
              </text>
            ) : null}
          </>
        ) : null}
      </svg>
      {legend ? (
        <figcaption className="legend">
          {slices.map((s, i) => (
            <span key={s.label} data-toggle={s.label}>
              <i style={{ background: s.color ?? PALETTE[i % PALETTE.length] }} />
              {s.label}: {format(s.value)} ({fmtPct(s.value, total)}%)
            </span>
          ))}
        </figcaption>
      ) : null}
    </figure>
  )
}

/** 270° gauge of a percentage. */
export function Gauge({ pct, label, color = C.brand }: { pct: number; label: string; color?: string }) {
  const v = Math.max(0, Math.min(100, pct))
  return (
    <figure className="chart gauge">
      <svg viewBox="0 0 120 105" role="img" aria-label={`${v}% ${label}`} data-tip={`${v}% · ${label}`}>
        <path d={arc(60, 60, 50, 32, -135, 135)} fill={C.muted} />
        {v > 0 ? <path d={arc(60, 60, 50, 32, -135, -135 + (270 * v) / 100)} fill={color} /> : null}
        <text x="60" y="58" textAnchor="middle" dominantBaseline="central" className="donut-center">
          {v}%
        </text>
        <text x="60" y="76" textAnchor="middle" className="donut-sub">
          {label}
        </text>
      </svg>
    </figure>
  )
}

/** Horizontal bars, one row per item, value printed after the bar. */
export function HBars({ items, format = String }: { items: { label: string; value: number; color?: string; tip?: string }[]; format?: (v: number) => string }) {
  if (items.length === 0) return null
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <div className="hbars" role="list">
      {items.map((it) => (
        <div className="hbar" role="listitem" key={it.label} data-tip={`${it.label}: ${format(it.value)}${it.tip ? ` — ${it.tip}` : ''}`}>
          <span className="hbar-label" title={it.label}>
            {it.label}
          </span>
          <span className="hbar-track">
            <span className="hbar-fill" style={{ width: `${(it.value / max) * 100}%`, background: it.color ?? C.brand }} />
          </span>
          <span className="hbar-value">{format(it.value)}</span>
        </div>
      ))}
    </div>
  )
}

const W = 600

interface Axis {
  labels: string[]
  maxTicks?: number
}

function xTicks(labels: string[], maxTicks = 12) {
  const step = Math.max(1, Math.ceil(labels.length / maxTicks))
  return labels.map((l, i) => (i % step === 0 ? l : ''))
}

function niceMax(v: number) {
  if (v <= 5) return Math.max(1, Math.ceil(v))
  const mag = 10 ** Math.floor(Math.log10(v))
  return Math.ceil(v / mag) * mag
}

function Frame({ height, max, x, children, yFormat = (v: number) => String(Math.round(v)) }: { height: number; max: number; x: Axis; children: ReactNode; yFormat?: (v: number) => string }) {
  const pad = { l: 34, r: 8, t: 8, b: 22 }
  const ticks = xTicks(x.labels, x.maxTicks)
  const n = x.labels.length
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="chart-svg" preserveAspectRatio="none" role="img">
      {[0, 0.5, 1].map((f) => {
        const y = pad.t + (1 - f) * (height - pad.t - pad.b)
        return (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} className="grid" />
            <text x={pad.l - 4} y={y} textAnchor="end" dominantBaseline="central" className="tick">
              {yFormat(max * f)}
            </text>
          </g>
        )
      })}
      {ticks.map((t, i) =>
        t ? (
          <text key={i} x={pad.l + ((i + 0.5) / n) * (W - pad.l - pad.r)} y={height - 6} textAnchor="middle" className="tick">
            {t}
          </text>
        ) : null,
      )}
      <g transform={`translate(${pad.l},${pad.t})`}>{children}</g>
    </svg>
  )
}

/** Vertical bars; with several series they are stacked. */
export function Bars({
  labels,
  series,
  height = 160,
  showValues = false,
  colorAt,
  yFormat,
}: {
  labels: string[]
  series: { name: string; values: number[]; color: string }[]
  height?: number
  showValues?: boolean
  colorAt?: (i: number) => string | undefined
  yFormat?: (v: number) => string
}) {
  const totals = labels.map((_, i) => series.reduce((s, x) => s + (x.values[i] ?? 0), 0))
  const max = niceMax(Math.max(...totals, 0))
  const iw = W - 34 - 8
  const ih = height - 8 - 22
  const bw = iw / labels.length
  return (
    <figure className="chart">
      {series.length > 1 ? <Legend items={series.map((s) => ({ label: s.name, color: s.color }))} /> : null}
      <Frame height={height} max={max} x={{ labels, maxTicks: 16 }} yFormat={yFormat}>
        {labels.map((_, i) => {
          let y = ih
          return (
            <g key={i}>
              {series.map((s) => {
                const v = s.values[i] ?? 0
                const h = (v / max) * ih
                y -= h
                return v > 0 ? (
                  <rect
                    key={s.name}
                    data-series={s.name}
                    data-tip={`${labels[i]} · ${s.name}: ${yFormat ? yFormat(v) : v}`}
                    x={i * bw + bw * 0.15}
                    y={y}
                    width={bw * 0.7}
                    height={h}
                    fill={colorAt?.(i) ?? s.color}
                  />
                ) : null
              })}
              {showValues && totals[i] ? (
                <text x={i * bw + bw / 2} y={ih - (totals[i]! / max) * ih - 3} textAnchor="middle" className="tick strong">
                  {yFormat ? yFormat(totals[i]!) : totals[i]}
                </text>
              ) : null}
            </g>
          )
        })}
      </Frame>
    </figure>
  )
}

/** Filled line chart; reference lines are drawn dashed. */
export function Lines({
  labels,
  series,
  refs = [],
  height = 150,
  yFormat,
}: {
  labels: string[]
  series: { name: string; values: number[]; color: string }[]
  refs?: { name: string; value: number; color: string }[]
  height?: number
  yFormat?: (v: number) => string
}) {
  if (labels.length === 0) return null
  const max = niceMax(Math.max(...series.flatMap((s) => s.values), ...refs.map((r) => r.value), 0))
  const iw = W - 34 - 8
  const ih = height - 8 - 22
  const x = (i: number) => ((i + 0.5) / labels.length) * iw
  const y = (v: number) => ih - (v / max) * ih
  return (
    <figure className="chart">
      <Legend items={[...series.map((s) => ({ label: s.name, color: s.color })), ...refs.map((r) => ({ label: r.name, color: r.color, dashed: true }))]} />
      <Frame height={height} max={max} x={{ labels }} yFormat={yFormat}>
        {series.map((s) => {
          const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
          return (
            <g key={s.name} data-series={s.name}>
              <polygon points={`${x(0)},${ih} ${pts} ${x(s.values.length - 1)},${ih}`} fill={s.color} opacity="0.15" />
              <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
              {s.values.map((v, i) => (
                <circle key={i} className="pt" cx={x(i)} cy={y(v)} r="4" fill={s.color} data-tip={`${labels[i]} · ${s.name}: ${yFormat ? yFormat(v) : v}`} />
              ))}
            </g>
          )
        })}
        {refs.map((r) => (
          <line key={r.name} x1={0} x2={iw} y1={y(r.value)} y2={y(r.value)} stroke={r.color} strokeWidth="1.5" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
        ))}
      </Frame>
    </figure>
  )
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="legend">
      {items.map((i) => (
        <span key={i.label} data-toggle={i.label}>
          <i className={i.dashed ? 'dashed' : ''} style={i.dashed ? { borderColor: i.color } : { background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

/** Radar with one axis per label. */
export function Radar({ axes }: { axes: { label: string; value: number }[] }) {
  const max = Math.max(1, ...axes.map((a) => a.value))
  const cx = 150
  const cy = 120
  const r = 85
  const pt = (i: number, f: number) => polar(cx, cy, r * f, (360 / axes.length) * i)
  return (
    <figure className="chart radar">
      <svg viewBox="0 0 300 240" role="img">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={axes.map((_, i) => pt(i, f).join(',')).join(' ')} className="grid-area" />
        ))}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 1.12)
          return (
            <text key={a.label} x={x} y={y} textAnchor={Math.abs(x - cx) < 10 ? 'middle' : x > cx ? 'start' : 'end'} dominantBaseline="central" className="tick">
              {a.label}
            </text>
          )
        })}
        <polygon points={axes.map((a, i) => pt(i, a.value / max).join(',')).join(' ')} fill={C.brand} fillOpacity="0.25" stroke={C.brand} strokeWidth="1.5" />
        {axes.map((a, i) => {
          const [x, y] = pt(i, a.value / max)
          return <circle key={a.label} className="pt" cx={x} cy={y} r="3.5" fill={C.brand} data-tip={a.label} />
        })}
      </svg>
    </figure>
  )
}

/** Weekday × hour heat grid. */
export function HeatGrid({ grid, max, rows, scaleLabel, tip }: { grid: number[][]; max: number; rows: string[]; scaleLabel: string; tip?: (day: string, hour: number, n: number) => string }) {
  return (
    <figure className="chart heat">
      <div className="heat-grid" style={{ gridTemplateColumns: `3em repeat(24, 1fr)` }}>
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="heat-h">
            {h % 3 === 0 ? h : ''}
          </span>
        ))}
        {grid.map((row, d) => (
          <Row key={d} label={rows[d] ?? ''} row={row} max={max} tip={tip} />
        ))}
      </div>
      <div className="legend">
        {scaleLabel}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <span key={t}>
            <i style={heatStyle(t * max, max)} />
            {t === 0 ? 0 : Math.max(1, Math.round(t * max))}
          </span>
        ))}
      </div>
    </figure>
  )
}

function Row({ label, row, max, tip }: { label: string; row: number[]; max: number; tip?: (day: string, hour: number, n: number) => string }) {
  return (
    <>
      <span className="heat-d">{label}</span>
      {row.map((v, h) => (
        <span key={h} className="heat-cell" style={heatStyle(v, max)} data-tip={tip?.(label, h, v)}>
          {v || ''}
        </span>
      ))}
    </>
  )
}

const heatStyle = (v: number, max: number) =>
  v === 0 ? { background: '#f1f3f6' } : { background: `rgba(201,42,42,${0.15 + 0.85 * (v / max)})`, color: v / max > 0.5 ? '#fff' : 'inherit' }

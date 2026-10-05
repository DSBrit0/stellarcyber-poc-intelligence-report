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
/** A share for a legend: a non-zero share under 0.5% reads "<1%", never "0%". */
const pctLabel = (v: number, total: number) => (v > 0 && total > 0 && (v / total) * 100 < 0.5 ? '<1%' : `${fmtPct(v, total)}%`)

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
                data-tip={`${s.label}: ${format(s.value)} (${pctLabel(s.value, total)})${s.tip ? ` — ${s.tip}` : ''}`}
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
              {s.label}: {format(s.value)} ({pctLabel(s.value, total)})
            </span>
          ))}
        </figcaption>
      ) : null}
    </figure>
  )
}

/** 270° gauge of a percentage; the label sits under the arc, in its opening. */
export function Gauge({ pct, label, color = C.brand }: { pct: number; label: string; color?: string }) {
  const v = Math.max(0, Math.min(100, pct))
  return (
    <figure className="chart gauge">
      <svg viewBox="0 0 120 116" role="img" aria-label={`${v}% ${label}`} data-tip={`${v}% · ${label}`}>
        <path d={arc(60, 56, 50, 32, -135, 135)} fill={C.muted} />
        {v > 0 ? <path d={arc(60, 56, 50, 32, -135, -135 + (270 * v) / 100)} fill={color} /> : null}
        <text x="60" y="56" textAnchor="middle" dominantBaseline="central" className="donut-center">
          {v}%
        </text>
        <text x="60" y="110" textAnchor="middle" className="gauge-label">
          {label}
        </text>
      </svg>
    </figure>
  )
}

/** Horizontal bars, one row per item, value printed after the bar; `stacked` puts the label above its bar (narrow cards). */
export function HBars({ items, format = String, stacked }: { items: { label: string; value: number; color?: string; tip?: string }[]; format?: (v: number) => string; stacked?: boolean }) {
  if (items.length === 0) return null
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <div className={`hbars ${stacked ? 'stacked' : ''}`} role="list">
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

/**
 * Default drawing width of the axis charts, in SVG units. The SVG scales to its card, so a chart in a
 * narrow card takes a smaller `width` (about the card's width in CSS px) to keep its text at ≥ 9 px.
 */
const W = 600
const PAD = { l: 34, r: 8, t: 8, b: 22 }

function xTicks(labels: string[], maxTicks: number) {
  const step = Math.max(1, Math.ceil(labels.length / maxTicks))
  return labels.map((l, i) => (i % step === 0 ? l : ''))
}

/**
 * The y axis: a top value and evenly spaced ticks at round steps (1, 2, 5 × 10ⁿ). Counts get whole steps,
 * so there is never a "0 / 1 / 1" axis or a "2" tick that is worth 1.5.
 */
export function yAxis(v: number, integer = true, maxTicks = 4): { max: number; ticks: number[] } {
  if (!(v > 0)) return { max: 1, ticks: [0, 1] }
  const raw = v / maxTicks
  const mag = 10 ** Math.floor(Math.log10(raw))
  let step = [1, 2, 5, 10].map((m) => m * mag).find((x) => x >= raw)!
  if (integer) step = Math.max(1, Math.round(step))
  const max = Math.ceil(v / step - 1e-9) * step
  const ticks: number[] = []
  for (let x = 0; x <= max + step / 1e6; x += step) ticks.push(Number(x.toPrecision(12)))
  return { max, ticks }
}

function Frame({ width, height, axis, x, children, yFormat = (v: number) => String(Math.round(v)) }: { width: number; height: number; axis: { max: number; ticks: number[] }; x: string[]; children: ReactNode; yFormat?: (v: number) => string }) {
  const pad = PAD
  // About one x label per 44 units: "05/09" or "Sep 5" never collide.
  const ticks = xTicks(x, Math.max(2, Math.floor((width - pad.l - pad.r) / 44)))
  const n = x.length
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img">
      {axis.ticks.map((v) => {
        const y = pad.t + (1 - v / axis.max) * (height - pad.t - pad.b)
        return (
          <g key={v}>
            <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} className="grid" />
            <text x={pad.l - 4} y={y} textAnchor="end" dominantBaseline="central" className="tick">
              {yFormat(v)}
            </text>
          </g>
        )
      })}
      {ticks.map((t, i) =>
        t ? (
          <text key={i} x={pad.l + ((i + 0.5) / n) * (width - pad.l - pad.r)} y={height - 6} textAnchor="middle" className="tick">
            {t}
          </text>
        ) : null,
      )}
      <g transform={`translate(${pad.l},${pad.t})`}>{children}</g>
    </svg>
  )
}

type Ref = { name: string; value: number; color: string }

/** Dashed horizontal reference lines (license, tolerance limit) across the plot area. */
function RefLines({ refs, iw, y }: { refs: Ref[]; iw: number; y: (v: number) => number }) {
  return (
    <>
      {refs.map((r) => (
        <line key={r.name} x1={0} x2={iw} y1={y(r.value)} y2={y(r.value)} stroke={r.color} strokeWidth="1.5" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
      ))}
    </>
  )
}

/** Vertical bars; with several series they are stacked. Reference lines are drawn dashed and named in the legend. */
export function Bars({
  labels,
  series,
  refs = [],
  height = 160,
  width = W,
  showValues = false,
  colorAt,
  yFormat,
  integer = true,
}: {
  labels: string[]
  series: { name: string; values: number[]; color: string }[]
  refs?: Ref[]
  height?: number
  width?: number
  showValues?: boolean
  colorAt?: (i: number) => string | undefined
  yFormat?: (v: number) => string
  /** Whole-number y ticks (counts); false for volumes in GB. */
  integer?: boolean
}) {
  const totals = labels.map((_, i) => series.reduce((s, x) => s + (x.values[i] ?? 0), 0))
  const axis = yAxis(Math.max(...totals, ...refs.map((r) => r.value), 0), integer)
  const max = axis.max
  const iw = width - PAD.l - PAD.r
  const ih = height - PAD.t - PAD.b
  const bw = iw / labels.length
  const legend = [...(series.length > 1 || refs.length ? series.map((s) => ({ label: s.name, color: s.color })) : []), ...refs.map((r) => ({ label: r.name, color: r.color, dashed: true }))]
  return (
    <figure className="chart">
      {legend.length ? <Legend items={legend} /> : null}
      <Frame width={width} height={height} axis={axis} x={labels} yFormat={yFormat}>
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
        <RefLines refs={refs} iw={iw} y={(v) => ih - (v / max) * ih} />
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
  width = W,
  yFormat,
  integer = true,
}: {
  labels: string[]
  series: { name: string; values: number[]; color: string }[]
  refs?: Ref[]
  height?: number
  width?: number
  yFormat?: (v: number) => string
  integer?: boolean
}) {
  if (labels.length === 0) return null
  const axis = yAxis(Math.max(...series.flatMap((s) => s.values), ...refs.map((r) => r.value), 0), integer)
  const max = axis.max
  const iw = width - PAD.l - PAD.r
  const ih = height - PAD.t - PAD.b
  const x = (i: number) => ((i + 0.5) / labels.length) * iw
  const y = (v: number) => ih - (v / max) * ih
  return (
    <figure className="chart">
      <Legend items={[...series.map((s) => ({ label: s.name, color: s.color })), ...refs.map((r) => ({ label: r.name, color: r.color, dashed: true }))]} />
      <Frame width={width} height={height} axis={axis} x={labels} yFormat={yFormat}>
        {series.map((s) => {
          const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
          return (
            <g key={s.name} data-series={s.name}>
              <polygon points={`${x(0)},${ih} ${pts} ${x(s.values.length - 1)},${ih}`} fill={s.color} opacity="0.15" />
              <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
              {s.values.map((v, i) => (
                <circle key={i} className="pt" cx={x(i)} cy={y(v)} r={width < 450 ? 3 : 4} fill={s.color} data-tip={`${labels[i]} · ${s.name}: ${yFormat ? yFormat(v) : v}`} />
              ))}
            </g>
          )
        })}
        <RefLines refs={refs} iw={iw} y={y} />
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

/**
 * Radar with one axis per label. Labels sit outside the outer ring with the value on a second line; the
 * viewBox leaves room for the longest short name on the left and right, so nothing is clipped. Radii are
 * on a square-root scale so one dominant axis does not flatten the others (the values are printed).
 */
export function Radar({ axes, format = String }: { axes: { label: string; value: number }[]; format?: (v: number) => string }) {
  const max = Math.sqrt(Math.max(1, ...axes.map((a) => a.value)))
  const r = 92
  const side = 92
  const cx = r + side
  const cy = r + 34
  const pt = (i: number, f: number) => polar(cx, cy, r * f, (360 / axes.length) * i)
  const scale = (v: number) => Math.sqrt(Math.max(0, v)) / max
  return (
    <figure className="chart radar">
      <svg viewBox={`0 0 ${2 * cx} ${2 * cy}`} role="img">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={axes.map((_, i) => pt(i, f).join(',')).join(' ')} className="grid-area" />
        ))}
        {axes.map((_, i) => (
          <line key={i} x1={cx} y1={cy} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} className="grid" />
        ))}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 1.1)
          const anchor = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end'
          // Two lines (name, value): above the ring at the top, below it at the bottom, centred on the sides.
          const top = y < cy - r * 0.85
          const bottom = y > cy + r * 0.85
          const y0 = top ? y - 13 : bottom ? y + 4 : y - 6
          return (
            <text key={a.label} x={x} y={y0} textAnchor={anchor} dominantBaseline="central" className={`radar-label ${a.value > 0 ? 'on' : ''}`}>
              <tspan x={x}>{a.label}</tspan>
              <tspan x={x} dy="12" className="radar-value">
                {format(a.value)}
              </tspan>
            </text>
          )
        })}
        <polygon points={axes.map((a, i) => pt(i, scale(a.value)).join(',')).join(' ')} fill={C.brand} fillOpacity="0.25" stroke={C.brand} strokeWidth="1.5" />
        {axes.map((a, i) => {
          const [x, y] = pt(i, scale(a.value))
          return a.value > 0 ? <circle key={a.label} className="pt" cx={x} cy={y} r="3" fill={C.brand} data-tip={`${a.label}: ${format(a.value)}`} /> : null
        })}
      </svg>
    </figure>
  )
}

/**
 * Stages in order, left to right, as chevrons: the value of each stage large, a secondary count under it,
 * and a bar of the stage's share of the largest one. Used for the XDR Kill Chain.
 */
export function StageFlow({ stages, format = String }: { stages: { label: string; value: number; sub: string; color: string }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...stages.map((s) => s.value))
  return (
    <ol className="stage-flow">
      {stages.map((s, i) => (
        <li key={s.label} className={s.value > 0 ? '' : 'empty'} data-tip={`${s.label}: ${format(s.value)} · ${s.sub}`}>
          <div className="stage-head" style={{ background: s.color }}>
            <b>{i + 1}</b>
            <span>{s.label}</span>
          </div>
          <div className="stage-value">{format(s.value)}</div>
          <div className="stage-sub">{s.sub}</div>
          <span className="stage-track">
            <span style={{ width: `${(s.value / max) * 100}%`, background: s.color }} />
          </span>
        </li>
      ))}
    </ol>
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

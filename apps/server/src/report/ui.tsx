import type { ReactNode } from 'react'
import type { ReportContext } from './context.js'

// Building blocks shared by every Template section.

/** Executive subtitle renumbering (spec §2.0): sections 6/7/8 move to 7/8/6. */
const T2_RENUMBER: Record<string, string> = { '6': '7', '7': '8', '8': '6' }
export function subNumber(rc: ReportContext, text: string): string {
  if (rc.template !== 'executive') return text
  return text.replace(/^(\d+)\./, (m, n: string) => `${T2_RENUMBER[n] ?? n}.`)
}

/** A new-page section with its numbered title. */
export function Section({ rc, n, title, children, newPage = true, id }: { rc: ReportContext; n?: number | string; title: string; children: ReactNode; newPage?: boolean; id?: string }) {
  return (
    <section className={`sec ${newPage ? 'page-break' : ''} ${rc.template}`} id={id}>
      <h2 className="sec-title">
        {n != null ? <span className="sec-num">{n}</span> : null}
        <span>{title}</span>
      </h2>
      {children}
    </section>
  )
}

export function Sub({ rc, children }: { rc: ReportContext; children: string }) {
  return <h3 className="sub">{subNumber(rc, children)}</h3>
}

export const Note = ({ children }: { children: ReactNode }) => <p className="note">{children}</p>
export const Muted = ({ children }: { children: ReactNode }) => <p className="muted">{children}</p>
export const P = ({ children }: { children: ReactNode }) => <p className="body">{children}</p>

export function Table({ head, rows, compact, className }: { head: ReactNode[]; rows: (ReactNode[] | { full: ReactNode })[]; compact?: boolean; className?: string }) {
  return (
    <div className="table-wrap">
      <table className={`${compact ? 'compact' : ''} ${className ?? ''}`}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) =>
            Array.isArray(r) ? (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ) : (
              <tr key={i} className="sub-row">
                <td colSpan={head.length}>{r.full}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}

export type Tone = 'navy' | 'brand' | 'mid' | 'cyan' | 'crit' | 'high' | 'med' | 'ok' | 'muted'

/** Solid KPI cards (Technical) or light tiles with a colored edge (Executive). */
export function Kpis({ rc, items }: { rc: ReportContext; items: { label: string; value: string; tone: Tone }[] }) {
  return (
    <div className={`kpis ${rc.template === 'executive' ? 'tiles' : 'solid'}`}>
      {items.map((k) => (
        <div key={k.label} className={`kpi tone-${k.tone}`}>
          <div className="kpi-value">{k.value}</div>
          <div className="kpi-label">{k.label}</div>
        </div>
      ))}
    </div>
  )
}

/** Bordered chart card with a title and an optional note (Executive style; also used for Technical charts). */
export function Card({ title, note, children, wide, className }: { title: string; note?: string; children: ReactNode; wide?: boolean; className?: string }) {
  return (
    <figure className={`card ${wide ? 'wide' : ''} ${className ?? ''}`}>
      <figcaption className="card-title">{title}</figcaption>
      <div className="card-body">{children ?? <span className="muted">—</span>}</div>
      {note ? <p className="card-note">{note}</p> : null}
    </figure>
  )
}

export const Grid = ({ cols = 2, children }: { cols?: 2 | 3; children: ReactNode }) => <div className={`grid cols-${cols}`}>{children}</div>

export function Sev({ rc, sev }: { rc: ReportContext; sev: 'critical' | 'high' | 'medium' | 'low' }) {
  const key = ({ critical: 'sevCritical', high: 'sevHigh', medium: 'sevMedium', low: 'sevLow' } as const)[sev]
  return <span className={`sev sev-${sev}`}>{rc.t(key)}</span>
}

/** Case status: colored; translated only in the Executive Template, as before. */
export function Status({ rc, status }: { rc: ReportContext; status: string }) {
  const s = status || 'New'
  const tone = /^(open|new)$/i.test(s) ? 'open' : /closed|resolved|analyzed/i.test(s) ? 'done' : 'other'
  return <span className={`status status-${tone}`}>{statusLabel(rc, s)}</span>
}

export function statusLabel(rc: ReportContext, status: string): string {
  if (rc.template !== 'executive') return status
  const names = rc.strings.pdf.t2StatusNames as Record<string, string>
  return names[status.toLowerCase().replace(/[\s_-]/g, '')] ?? status
}

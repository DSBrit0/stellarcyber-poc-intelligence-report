import type { ReactNode } from 'react'
import type { ReportContext } from './context.js'
import { isPending } from './model/derived.js'

// Building blocks shared by every Template section.

/** A title without the number the texts used to carry ("7.5 Licença Auto Triage" → "Licença Auto Triage"). */
export const unnumbered = (text: string) => text.replace(/^\s*\d+(\.\d+)*\.?\s+/, '')

/**
 * A section title, numbered by render order (sections left out leave no gap); `numbered={false}` for the
 * appendices and the architecture page. `newPage` starts it on a new page in print.
 */
export function Section({ rc, numbered = true, title, children, newPage = true, id }: { rc: ReportContext; numbered?: boolean; title: string; children: ReactNode; newPage?: boolean; id?: string }) {
  const nb = rc.numbering
  nb.numbered = numbered
  nb.sub = 0
  if (numbered) nb.section += 1
  return (
    <section className={`sec ${newPage ? 'page-break' : ''} ${rc.template}`} id={id}>
      <h2 className="sec-title">
        {numbered ? <span className="sec-num">{nb.section}</span> : null}
        <span>{title}</span>
      </h2>
      {children}
    </section>
  )
}

/** A subsection title numbered "{section}.{n}" by render order. */
export function Sub({ rc, children }: { rc: ReportContext; children: string }) {
  const nb = rc.numbering
  const text = unnumbered(children)
  if (!nb.numbered) return <h3 className="sub">{text}</h3>
  nb.sub += 1
  return <h3 className="sub">{`${nb.section}.${nb.sub} ${text}`}</h3>
}

/** Keeps its blocks on one page in print (a title with the block it introduces, a short table with its lead). */
export const Keep = ({ children, className }: { children: ReactNode; className?: string }) => <div className={`keep ${className ?? ''}`}>{children}</div>

export const Note = ({ children }: { children: ReactNode }) => <p className="note">{children}</p>
export const Muted = ({ children }: { children: ReactNode }) => <p className="muted">{children}</p>
export const P = ({ children }: { children: ReactNode }) => <p className="body">{children}</p>

/** Tables of up to this many rows are kept on one page in print. */
const KEEP_ROWS = 15

/**
 * A data table. `cols` fixes the column widths (CSS widths, e.g. "40%" or "18mm") with a fixed table
 * layout, so a long cell wraps instead of pushing a narrow column (dates, numbers) out of the page.
 */
export function Table({ head, rows, compact, className, cols }: { head: ReactNode[]; rows: (ReactNode[] | { full: ReactNode })[]; compact?: boolean; className?: string; cols?: string[] }) {
  const keep = rows.length <= KEEP_ROWS
  return (
    <div className={`table-wrap ${keep ? 'keep' : ''}`}>
      <table className={`${compact ? 'compact' : ''} ${cols ? 'fixed' : ''} ${className ?? ''}`}>
        {cols ? (
          <colgroup>
            {cols.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
        ) : null}
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
export function Kpis({ rc, items }: { rc: ReportContext; items: { label: string; value: string; tone: Tone; tip?: string }[] }) {
  return (
    <div className={`kpis ${rc.template === 'executive' ? 'tiles' : 'solid'} n-${items.length}`}>
      {items.map((k) => (
        <div key={k.label} className={`kpi tone-${k.tone}`} data-tip={k.tip ? `${k.label}: ${k.value} — ${k.tip}` : undefined}>
          <div className="kpi-value">{k.value}</div>
          <div className="kpi-label">{k.label}</div>
        </div>
      ))}
    </div>
  )
}

/**
 * Bordered chart card with a title and an optional note (Executive style; also used for Technical charts).
 * A card without content is not drawn: callers pass null when the chart's values are all 0 or missing.
 */
export function Card({ title, note, children, wide, className }: { title: string; note?: string; children: ReactNode; wide?: boolean; className?: string }) {
  if (children == null || children === false) return null
  return (
    <figure className={`card ${wide ? 'wide' : ''} ${className ?? ''}`}>
      <figcaption className="card-title">{title}</figcaption>
      <div className="card-body">{children}</div>
      {note ? <p className="card-note">{note}</p> : null}
    </figure>
  )
}

export const Grid = ({ cols = 2, children }: { cols?: 2 | 3; children: ReactNode }) => <div className={`grid cols-${cols}`}>{children}</div>

export function Sev({ rc, sev }: { rc: ReportContext; sev: 'critical' | 'high' | 'medium' | 'low' }) {
  const key = ({ critical: 'sevCritical', high: 'sevHigh', medium: 'sevMedium', low: 'sevLow' } as const)[sev]
  return <span className={`sev sev-${sev}`}>{rc.t(key)}</span>
}

/** Case status, colored and translated in every Template. */
export function Status({ rc, status }: { rc: ReportContext; status: string }) {
  const s = status || 'New'
  const tone = /^(open|new)$/i.test(s) ? 'open' : isPending(s) ? 'other' : 'done'
  return <span className={`status status-${tone}`}>{statusLabel(rc, s)}</span>
}

export function statusLabel(rc: ReportContext, status: string): string {
  const names = rc.strings.pdf.t2StatusNames as Record<string, string>
  return names[(status || 'New').toLowerCase().replace(/[\s_-]/g, '')] ?? status
}

/** A Report-wide note that must not be cut from its figure (the licensing volume asterisk). */
export const VolumeNote = ({ rc }: { rc: ReportContext }) => <p className="muted volume-note">{rc.x('volumeNote')}</p>

/** Executive/Insight-style empty banner. */
export const Banner = ({ children }: { children: ReactNode }) => <div className="note banner">{children}</div>

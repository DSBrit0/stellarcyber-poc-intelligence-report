import type { ReactNode } from 'react'
import type { Caption, ReportContext } from './context.js'
import { isPending } from './model/derived.js'

// Building blocks shared by every Template section.

/** A title without the number the texts used to carry ("7.5 Licença Auto Triage" → "Licença Auto Triage"). */
export const unnumbered = (text: string) => text.replace(/^\s*\d+(\.\d+)*\.?\s+/, '')

/**
 * A section title, numbered by render order (sections left out leave no gap); `numbered={false}` for the
 * appendices and the architecture page. `newPage` starts it on a new page in print. NBR 6024: the number,
 * one space and the title (upper case and bold by the stylesheet), left aligned.
 */
export function Section({ rc, numbered = true, title, children, newPage = true, id }: { rc: ReportContext; numbered?: boolean; title: string; children: ReactNode; newPage?: boolean; id?: string }) {
  const nb = rc.numbering
  nb.numbered = numbered
  nb.sub = 0
  nb.sectionTitle = unnumbered(title)
  nb.subTitle = null
  if (numbered) nb.section += 1
  return (
    <section className={`sec ${newPage ? 'page-break' : ''} ${rc.template}`} id={id}>
      <h2 className="sec-title">
        {numbered ? (
          <>
            <span className="sec-num">{nb.section}</span>{' '}
          </>
        ) : null}
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
  nb.subTitle = text
  if (!nb.numbered) return <h3 className="sub">{text}</h3>
  nb.sub += 1
  return <h3 className="sub">{`${nb.section}.${nb.sub} ${text}`}</h3>
}

/** Where a caption sits, for the lists of figures and tables: "3.1", "3", or an unnumbered section's name ("Apêndice A"). */
function where(nb: ReportContext['numbering']): string {
  if (!nb.numbered) return nb.sectionTitle.split(/\s+[—–-]\s+/)[0]!
  return nb.sub ? `${nb.section}.${nb.sub}` : String(nb.section)
}

/** Takes the next figure or table number and records it for the lists. */
function register(rc: ReportContext, kind: 'figure' | 'table', title: string): number {
  const nb = rc.numbering
  const n = kind === 'figure' ? ++nb.figure : ++nb.table
  nb.captions.push({ kind, n, title, where: where(nb) })
  return n
}

/** NBR 14724/IBGE caption above a figure or table: "Figura 3 – Title", the word and number in bold. */
function CaptionLine({ rc, kind, n, title }: { rc: ReportContext; kind: 'figure' | 'table'; n: number; title: string }) {
  return (
    <div className="caption">
      <b>
        {rc.x(kind === 'figure' ? 'figLabel' : 'tabLabel')} {n}
      </b>{' '}
      – {title}
    </div>
  )
}

/** The source line under a figure or table: the PoC's data and period, or Stellar Cyber for fixed content. */
export function Source({ rc, kind = 'poc' }: { rc: ReportContext; kind?: SourceKind }) {
  const { x, fmt, data } = rc
  const text = kind === 'static' ? x('sourceStatic') : x('sourcePoc', { period: `${fmt.date(data.period.start)}–${fmt.date(data.period.end)}` })
  return (
    <p className="source">
      {x('sourceLabel')} {text}
    </p>
  )
}

/** "poc": figures and tables built from the PoC's data; "static": the methodology, glossary and other fixed text. */
export type SourceKind = 'poc' | 'static'

/**
 * A numbered figure for a graphic that is not a Card (the MITRE matrix, the phase flow, the Detection Story
 * visuals): caption above, source below. Outside the ABNT Templates it draws its content only.
 */
export function Figure({ rc, title, note, children, className }: { rc: ReportContext; title: string; note?: string; children: ReactNode; className?: string }) {
  if (!rc.abnt) return <>{children}</>
  const n = register(rc, 'figure', unnumbered(title))
  return (
    <figure className={`fig ${className ?? ''}`}>
      <CaptionLine rc={rc} kind="figure" n={n} title={unnumbered(title)} />
      {children}
      <Source rc={rc} />
      {note ? <p className="card-note">{note}</p> : null}
    </figure>
  )
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
 * IBGE presentation: "Tabela N – {caption}" above (the closest subsection's title when none is given),
 * the source below, rules only around the header and at the bottom.
 */
export function Table({
  rc,
  head,
  rows,
  compact,
  className,
  cols,
  caption,
  source = 'poc',
}: {
  rc: ReportContext
  head: ReactNode[]
  rows: (ReactNode[] | { full: ReactNode })[]
  compact?: boolean
  className?: string
  cols?: string[]
  caption?: string
  source?: SourceKind
}) {
  const keep = rows.length <= KEEP_ROWS
  const title = unnumbered(caption ?? rc.numbering.subTitle ?? rc.numbering.sectionTitle)
  const n = rc.abnt ? register(rc, 'table', title) : 0
  return (
    <div className={`table-wrap ${keep ? 'keep' : ''}`}>
      {rc.abnt ? <CaptionLine rc={rc} kind="table" n={n} title={title} /> : null}
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
      {rc.abnt ? <Source rc={rc} kind={source} /> : null}
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
 * In the ABNT Templates the title becomes the figure caption ("Figura N – title") and the source goes under
 * the chart; `figure={false}` for a box that is not a graphic (a list of findings).
 */
export function Card({
  rc,
  title,
  note,
  children,
  wide,
  className,
  figure = true,
}: {
  rc: ReportContext
  title: string
  note?: string
  children: ReactNode
  wide?: boolean
  className?: string
  figure?: boolean
}) {
  if (children == null || children === false) return null
  const numbered = rc.abnt && figure
  const n = numbered ? register(rc, 'figure', unnumbered(title)) : 0
  return (
    <figure className={`card ${wide ? 'wide' : ''} ${className ?? ''}`}>
      {numbered ? (
        <figcaption>
          <CaptionLine rc={rc} kind="figure" n={n} title={unnumbered(title)} />
        </figcaption>
      ) : (
        <figcaption className="card-title">{title}</figcaption>
      )}
      <div className="card-body">{children}</div>
      {numbered ? <Source rc={rc} /> : null}
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

/** One list of the Technical Template's pre-textual pages: number – title, and the section it appears in. */
function CaptionList({ rc, kind, items }: { rc: ReportContext; kind: 'figure' | 'table'; items: Caption[] }) {
  const label = rc.x(kind === 'figure' ? 'figLabel' : 'tabLabel')
  return (
    <section className="abnt-list">
      <h2 className="list-title">{rc.x(kind === 'figure' ? 'listFigures' : 'listTables')}</h2>
      <div className="list-head">
        <span />
        <span>{rc.x('listSection')}</span>
      </div>
      <ol className="list-items">
        {items.map((c) => (
          <li key={c.n}>
            <span className="list-entry">
              <b>
                {label} {c.n}
              </b>{' '}
              – {c.title}
            </span>
            <span className="list-dots" />
            <span className="list-where">{c.where}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * Technical: the lists of figures and of tables right after the cover (NBR 14724). Page numbers cannot be
 * known while the HTML is built (Chromium paginates it later), so each entry gives its section number.
 */
export function CaptionLists({ rc }: { rc: ReportContext }) {
  const lists = rc.lists
  if (!lists || lists.figures.length + lists.tables.length === 0) return null
  return (
    <div className="abnt-lists">
      {lists.figures.length ? <CaptionList rc={rc} kind="figure" items={lists.figures} /> : null}
      {lists.tables.length ? <CaptionList rc={rc} kind="table" items={lists.tables} /> : null}
      <p className="source list-note">{rc.x('listNote')}</p>
    </div>
  )
}

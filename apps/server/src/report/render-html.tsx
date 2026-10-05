import type { Locale, PocDetails, ReportData, Template } from '@poc-intel/shared'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildReportContext } from './context.js'
import type { Versioning } from './versioning.js'
import { INTERACTIVE_CSS, INTERACTIVE_JS, toolbarHtml } from './interactive.js'
import { REPORT_CSS } from './styles.js'
import { ExecutiveTemplate } from './templates/executive.js'
import { InsightTemplate } from './templates/insight.js'
import { TechnicalTemplate } from './templates/technical.js'

export interface RenderOptions {
  /** Architecture image as a data: URL (Technical Template only). */
  archImage?: string | null
  generatedAt?: Date
  /** Presentation mode: adds the tooltip/navigation script, which runs only with this CSP nonce. */
  interactiveNonce?: string
  /** Version and history from the stored Reports; without it the Report is version 1.0. */
  versioning?: Versioning | null
}

/** Report as a complete, self-contained HTML document (inline CSS and SVG; a script only in presentation mode). */
export function renderReportHtml(data: ReportData, details: PocDetails, template: Template, locale: Locale, opts: RenderOptions = {}): string {
  const interactive = Boolean(opts.interactiveNonce)
  const rc = buildReportContext(data, details, template, locale, opts.generatedAt, interactive, opts.versioning ?? null)
  const body = renderToStaticMarkup(
    template === 'technical' ? <TechnicalTemplate rc={rc} archImage={opts.archImage ?? null} /> : template === 'executive' ? <ExecutiveTemplate rc={rc} /> : <InsightTemplate rc={rc} />,
  )
  const title = `${details.customerName} · ${rc.t('coverReportType')}`.replace(/[<>&"]/g, '')
  // The PDF footer's text (see pdfFooter in pdf.ts), in the Report's language.
  const footer = `${rc.client} · ${rc.x('footerConfidential')} · ${rc.x('footerPage')}`.replace(/[<>&"]/g, '')
  const extras = interactive
    ? `${toolbarHtml({ prev: rc.x('presentPrev'), next: rc.x('presentNext'), full: rc.x('presentFullscreen'), print: rc.x('presentPrint') })}<script nonce="${opts.interactiveNonce}">${INTERACTIVE_JS}</script>`
    : ''
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="report-footer" content="${footer}"><style>${REPORT_CSS}${interactive ? INTERACTIVE_CSS : ''}</style></head><body${interactive ? ' class="interactive"' : ''}>${body}${extras}</body></html>`
}

/** CSP for serving a Report page: static, so nothing beyond its own inline styles (and, when presenting, its one script). */
export function reportCsp(nonce?: string): string {
  return `default-src 'none'; style-src 'unsafe-inline'; img-src data:; ${nonce ? `script-src 'nonce-${nonce}'; ` : ''}base-uri 'none'; form-action 'none'; frame-ancestors 'self'`
}
export const REPORT_CSP = reportCsp()

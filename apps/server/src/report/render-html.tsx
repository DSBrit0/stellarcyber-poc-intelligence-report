import type { Locale, PocDetails, ReportData, Template } from '@poc-intel/shared'
import { renderToStaticMarkup } from 'react-dom/server'
import { reportContext } from './context.js'
import { REPORT_CSS } from './styles.js'
import { ExecutiveTemplate } from './templates/executive.js'
import { InsightTemplate } from './templates/insight.js'
import { TechnicalTemplate } from './templates/technical.js'

const TEMPLATES = { technical: TechnicalTemplate, executive: ExecutiveTemplate, insight: InsightTemplate } as const

/** Report as a complete, self-contained HTML document (inline CSS and SVG, no scripts). */
export function renderReportHtml(data: ReportData, details: PocDetails, template: Template, locale: Locale): string {
  const ctx = reportContext(data, details, template, locale)
  const Component = TEMPLATES[template]
  const body = renderToStaticMarkup(<Component ctx={ctx} />)
  const title = `${details.customerName} · PoC Report`.replace(/[<>&"]/g, '')
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${REPORT_CSS}</style></head><body>${body}</body></html>`
}

/** CSP for serving a Report page: it is static, so it needs nothing beyond its own inline styles. */
export const REPORT_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"

import type { Locale } from '../domain.js'
import en from './report/en.json' with { type: 'json' }
import es from './report/es.json' with { type: 'json' }
import ptBR from './report/pt-BR.json' with { type: 'json' }

// Report texts carried over verbatim from the previous tool (its `pdf`, `recOps` and verdict strings),
// so the Technical and Executive Reports read exactly as before in all three languages.
export type ReportStrings = typeof en
export type ReportKey = keyof ReportStrings['pdf']

const catalogues: Record<Locale, ReportStrings> = { en, es, 'pt-BR': ptBR as ReportStrings }

export function reportStrings(locale: Locale): ReportStrings {
  return catalogues[locale]
}

/** Replaces every {name} placeholder. Unknown placeholders are left as they are. */
export function fill(text: string, vars: Record<string, string | number> = {}): string {
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m))
}

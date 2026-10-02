import type { Locale, PocDetails, ReportData, Template } from '@poc-intel/shared'
import { fill, reportStrings, type ReportKey, type ReportStrings } from '@poc-intel/shared/i18n/report'
import mitigations from './mitre-mitigations.json' with { type: 'json' }
import { deriveReport, type Derived } from './model/derived.js'
import { recommendations, type Recommendation } from './model/recommendations.js'
import { buildStory, type Story } from './model/story.js'

/** Everything a Template needs: frozen Report Data, the PoC's current details, derived values and texts. */
export interface ReportContext {
  data: ReportData
  details: PocDetails
  template: Template
  locale: Locale
  d: Derived
  story: Story
  recs: Recommendation[]
  strings: ReportStrings
  /** A report text with every {placeholder} filled. */
  t: (key: ReportKey, vars?: Record<string, string | number>) => string
  fmt: ReturnType<typeof formatters>
  mitigation: (techniqueId: string) => string | null
  generatedAt: Date
}

// Number/date formatting of the previous tool (spec §0.2); the en locale formats as en-US, es as es-MX.
const INTL_LOCALE: Record<Locale, string> = { 'pt-BR': 'pt-BR', en: 'en-US', es: 'es-MX' }

export function formatters(locale: Locale) {
  const loc = INTL_LOCALE[locale]
  const short = new Intl.DateTimeFormat(loc, { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' })
  const dayMonth = new Intl.DateTimeFormat(loc, { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
  const dayTime = new Intl.DateTimeFormat(loc, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
  const toDate = (d: string | number | Date) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00Z`) : new Date(d))
  const num = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? '—' : n.toLocaleString(loc))
  const dec = (n: number, digits = 1) => n.toLocaleString(loc, { maximumFractionDigits: digits })
  return {
    date: (d: string | number | Date | null | undefined) => {
      if (d == null || d === '') return '—'
      const v = toDate(d)
      return Number.isNaN(v.getTime()) ? String(d) : short.format(v)
    },
    dayMonth: (d: string) => dayMonth.format(toDate(d)),
    dayTimeUTC: (ms: number | null) => (ms == null ? '—' : `${dayTime.format(new Date(ms))} UTC`),
    num,
    dec,
    vol: (gb: number) => `${gb.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GB`,
    /** Bytes in binary units, as the previous tool printed them. */
    bytes: (b: number) => {
      if (!b) return '0 GB'
      const gb = b / 1024 ** 3
      if (gb >= 1) return `${gb.toFixed(2)} GB`
      const mb = b / 1024 ** 2
      return mb >= 1 ? `${mb.toFixed(2)} MB` : `${(b / 1024).toFixed(2)} KB`
    },
    gb: (v: number) => (v > 0 && v < 0.01 ? `${(v * 1024).toFixed(2)} MB` : `${v.toFixed(2)} GB`),
    pct: (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '0%'),
    dur: (min: number | null) => (min == null ? '—' : min < 60 ? `${Math.round(min)} min` : `${dec(min / 60, 1)} h`),
    trunc: (s: string | null | undefined, max = 45) => (!s ? '—' : s.length > max ? `${s.slice(0, max - 1)}…` : s),
  }
}

export function buildReportContext(data: ReportData, details: PocDetails, template: Template, locale: Locale, generatedAt = new Date()): ReportContext {
  const strings = reportStrings(locale)
  const d = deriveReport(data, details)
  const byId = new Map(mitigations.map((m) => [m.technique.id, m.mitigation]))
  return {
    data,
    details,
    template,
    locale,
    d,
    story: buildStory(data, d),
    recs: recommendations(data),
    strings,
    t: (key, vars) => fill(String(strings.pdf[key] ?? key), vars),
    fmt: formatters(locale),
    mitigation: (id) => byId.get(id)?.[locale] ?? null,
    generatedAt,
  }
}

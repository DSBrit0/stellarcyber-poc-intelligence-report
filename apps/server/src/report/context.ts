import type { Locale, PocDetails, ReportData, Template } from '@poc-intel/shared'
import { fill, reportStrings, type ReportKey, type ReportStrings } from '@poc-intel/shared/i18n/report'
import { AI_VERDICT_LABELS, KILL_CHAIN_LABELS, reportExtra, type ExtraKey } from '@poc-intel/shared/i18n/report-extra'
import mitigations from './mitre-mitigations.json' with { type: 'json' }
import { deriveReport, type Derived } from './model/derived.js'
import { recommendations, type Recommendation } from './model/recommendations.js'
import { buildStory, type Story } from './model/story.js'
import type { Versioning } from './versioning.js'

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
  /** Texts that did not exist in the previous tool. */
  x: (key: ExtraKey, vars?: Record<string, string | number>) => string
  aiVerdict: (v: string) => string
  killChainStage: (stage: string) => string
  /** On-screen presentation: tooltips and chart interactions are enabled. */
  interactive: boolean
  fmt: ReturnType<typeof formatters>
  mitigation: (techniqueId: string) => string | null
  generatedAt: Date
  versioning: Versioning | null
  /** The Report's version: from the stored Reports, else 1.0. */
  version: string
  /** The customer's name for running text and the page footer: short enough for a sentence (≤ 40 characters). */
  client: string
  /**
   * Section numbering by render order: Section takes the next number and Sub the next subnumber, so a
   * section left out (no Cases, no architecture image) never leaves a gap. Mutated while rendering.
   */
  numbering: { section: number; sub: number; numbered: boolean }
}

const SHORT_NAME = 40

/** Full name when short; else the text before " — " (or " - ", " | "), else the Tenant name, else the name cut at 40. */
export function shortClientName(customerName: string, tenantName: string): string {
  const full = customerName.trim()
  if (full.length <= SHORT_NAME) return full
  const head = full.split(/\s+[—–|-]\s+/)[0]!.trim()
  if (head && head.length <= SHORT_NAME) return head
  const tenant = tenantName.trim()
  if (tenant && tenant.length <= SHORT_NAME) return tenant
  return `${full.slice(0, SHORT_NAME - 1).trimEnd()}…`
}

// Number/date formatting of the locale (en as en-US, es as es-MX). Bytes and GB are decimal (1 GB = 10⁹ bytes),
// the unit the platform licenses by.
const INTL_LOCALE: Record<Locale, string> = { 'pt-BR': 'pt-BR', en: 'en-US', es: 'es-MX' }

export function formatters(locale: Locale) {
  const loc = INTL_LOCALE[locale]
  const en = locale === 'en'
  // en spells the month ("Sep 5, 2026"): "09/05/26" reads as May 9 to most readers outside the US.
  const short = new Intl.DateTimeFormat(loc, en ? { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' } : { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' })
  const dayMonth = new Intl.DateTimeFormat(loc, en ? { day: 'numeric', month: 'short', timeZone: 'UTC' } : { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
  const dayTime = new Intl.DateTimeFormat(loc, { day: en ? 'numeric' : '2-digit', month: en ? 'short' : '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
  const toDate = (d: string | number | Date) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00Z`) : new Date(d))
  const num = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? '—' : Math.round(n).toLocaleString(loc))
  const dec = (n: number, digits = 1) => n.toLocaleString(loc, { maximumFractionDigits: digits })
  const fixed2 = (n: number) => n.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const gb = (v: number) => (v > 0 && v < 0.01 ? `${fixed2(v * 1000)} MB` : `${fixed2(v)} GB`)
  const pctOf = (p: number) => (p > 0 && p < 0.5 ? '<1%' : `${Math.round(p)}%`)
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
    vol: (v: number) => gb(v),
    /** Decimal bytes: GB from 1 GB, else MB/KB; 0 prints as "0,00 GB" like every other empty volume. */
    bytes: (b: number) => {
      if (!b) return gb(0)
      if (b >= 1e9) return `${fixed2(b / 1e9)} GB`
      return b >= 1e6 ? `${fixed2(b / 1e6)} MB` : `${fixed2(b / 1e3)} KB`
    },
    gb,
    /** Share of a total as a whole percent; a non-zero share under 0.5% prints "<1%". */
    pct: (a: number, b: number) => (b ? pctOf((a / b) * 100) : '0%'),
    /** An already computed percentage (0–100). */
    pctOf,
    /** Alerts per case, "3,7:1". */
    ratio: (r: number) => `${dec(r, 1)}:1`,
    dur: (min: number | null) => (min == null ? '—' : min < 60 ? `${dec(min, min < 10 ? 1 : 0)} min` : `${dec(min / 60, 1)} h`),
    trunc: (s: string | null | undefined, max = 45) => (!s ? '—' : s.length > max ? `${s.slice(0, max - 1)}…` : s),
  }
}

export function buildReportContext(
  data: ReportData,
  details: PocDetails,
  template: Template,
  locale: Locale,
  generatedAt = new Date(),
  interactive = false,
  versioning: Versioning | null = null,
): ReportContext {
  const extra = reportExtra(locale)
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
    recs: recommendations(data, d),
    strings,
    t: (key, vars) => fill(String(strings.pdf[key] ?? key), vars),
    x: (key, vars) => fill(extra[key], vars),
    aiVerdict: (v) => AI_VERDICT_LABELS[locale][v] ?? v,
    killChainStage: (s) => KILL_CHAIN_LABELS[locale][s] ?? s,
    interactive,
    fmt: formatters(locale),
    mitigation: (id) => byId.get(id)?.[locale] ?? null,
    generatedAt,
    versioning,
    version: versioning?.version ?? '1.0',
    client: shortClientName(details.customerName, data.tenant.name) || strings.pdf.clientNamePlaceholder,
    numbering: { section: 0, sub: 0, numbered: false },
  }
}

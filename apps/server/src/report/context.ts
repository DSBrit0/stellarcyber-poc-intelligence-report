import type { Locale, PocDetails, ReportData, Template } from '@poc-intel/shared'
import { translate, type MessageKey } from '@poc-intel/shared/i18n'

/** Everything a Template needs: the frozen Report Data plus the PoC's current details. */
export interface ReportContext {
  data: ReportData
  details: PocDetails
  template: Template
  locale: Locale
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
  fmt: { int: (n: number) => string; dec: (n: number, digits?: number) => string; date: (iso: string) => string }
}

export function reportContext(data: ReportData, details: PocDetails, template: Template, locale: Locale): ReportContext {
  const int = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' })
  return {
    data,
    details,
    template,
    locale,
    t: (key, vars) => translate(locale, key, vars),
    fmt: {
      int: (n) => int.format(n),
      dec: (n, digits = 2) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n),
      date: (iso) => date.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)),
    },
  }
}

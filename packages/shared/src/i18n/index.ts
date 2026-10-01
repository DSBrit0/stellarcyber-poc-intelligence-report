import { DEFAULT_LOCALE, type Locale } from '../domain.js'
import en from './en.json' with { type: 'json' }
import es from './es.json' with { type: 'json' }
import ptBR from './pt-BR.json' with { type: 'json' }

/** en is the reference catalogue: every key must exist there. Other locales fall back to it. */
export type MessageKey = keyof typeof en

const catalogues: Record<Locale, Partial<Record<MessageKey, string>>> = { 'pt-BR': ptBR, en, es }

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const text = catalogues[locale][key] ?? en[key] ?? key
  return vars ? text.replace(/\{(\w+)\}/g, (m, name: string) => String(vars[name] ?? m)) : text
}

export function resolveLocale(input: string | undefined | null): Locale {
  if (!input) return DEFAULT_LOCALE
  const lower = input.toLowerCase()
  if (lower.startsWith('pt')) return 'pt-BR'
  if (lower.startsWith('es')) return 'es'
  if (lower.startsWith('en')) return 'en'
  return DEFAULT_LOCALE
}

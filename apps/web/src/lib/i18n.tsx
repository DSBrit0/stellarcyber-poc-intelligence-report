import { DEFAULT_LOCALE, LOCALES, type Locale } from '@poc-intel/shared'
import { resolveLocale, translate, type MessageKey } from '@poc-intel/shared/i18n'
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'locale'

interface I18n {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
}

const Ctx = createContext<I18n>({ locale: DEFAULT_LOCALE, setLocale: () => {}, t: (k) => k })

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && (LOCALES as readonly string[]).includes(saved)) return saved as Locale
  } catch {
    // storage unavailable: fall through to the browser language
  }
  return resolveLocale(navigator.language)
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  const value = useMemo<I18n>(
    () => ({
      locale,
      setLocale: (l) => {
        setLocaleState(l)
        document.documentElement.lang = l
        try {
          localStorage.setItem(STORAGE_KEY, l)
        } catch {
          // ignore
        }
      },
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useI18n = () => useContext(Ctx)

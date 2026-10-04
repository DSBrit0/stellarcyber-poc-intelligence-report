import { useEffect, useRef, useState } from 'react'
import { useI18n } from './i18n'

// A date field in the app's language, not the browser's: DD/MM/YYYY (pt-BR, es) or MM/DD/YYYY (en).
// The native <input type="date"> follows the browser locale, so it only backs the calendar button.

const dayFirst = (locale: string) => locale !== 'en'

export function formatIso(iso: string, locale: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return ''
  return dayFirst(locale) ? `${d}/${m}/${y}` : `${m}/${d}/${y}`
}

export function parseLocal(text: string, locale: string): string | null {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [a, b, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const [day, month] = dayFirst(locale) ? [a, b] : [b, a]
  const iso = `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const t = Date.parse(`${iso}T00:00:00Z`)
  return Number.isNaN(t) || new Date(t).getUTCDate() !== day ? null : iso
}

/** Inserts the slashes while typing: 2509 → 25/09. */
function mask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/')
}

export function DateInput({ value, onChange, min, max, label, required }: { value: string; onChange: (iso: string) => void; min?: string; max?: string; label: string; required?: boolean }) {
  const { locale } = useI18n()
  const [text, setText] = useState(formatIso(value, locale))
  const native = useRef<HTMLInputElement>(null)
  useEffect(() => setText(formatIso(value, locale)), [value, locale])
  const placeholder = dayFirst(locale) ? (locale === 'es' ? 'DD/MM/AAAA' : 'DD/MM/AAAA') : 'MM/DD/YYYY'
  const parsed = parseLocal(text, locale)
  const outOfRange = parsed != null && ((min && parsed < min) || (max && parsed > max))
  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className="relative block">
        <input
          className={`input pr-10 ${text && (!parsed || outOfRange) ? 'border-red-400' : ''}`}
          inputMode="numeric"
          placeholder={placeholder}
          required={required}
          value={text}
          onChange={(e) => {
            const next = mask(e.target.value)
            setText(next)
            const iso = parseLocal(next, locale)
            if (iso && (!min || iso >= min) && (!max || iso <= max)) onChange(iso)
          }}
        />
        <button
          type="button"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label={label}
          onClick={() => native.current?.showPicker?.()}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
        </button>
        <input ref={native} type="date" tabIndex={-1} aria-hidden="true" className="pointer-events-none absolute right-2 bottom-0 h-0 w-0 opacity-0" min={min} max={max} value={value} onChange={(e) => e.target.value && onChange(e.target.value)} />
      </span>
    </label>
  )
}

import { LOCALES, type Locale } from '@poc-intel/shared'
import { Select } from './Select'

/** Each language by its own name, so a reader finds theirs whatever the current UI language is. */
export const LOCALE_NAMES: Record<Locale, string> = {
  'pt-BR': 'Português (Brasil)',
  en: 'English',
  es: 'Español',
}

/** Inline SVG flags: emoji flags render as two letters on Windows. */
export function Flag({ locale }: { locale: Locale }) {
  const art = {
    'pt-BR': (
      <>
        <rect width="20" height="14" fill="#009c3b" />
        <path d="M10 1.6 18.2 7 10 12.4 1.8 7Z" fill="#ffdf00" />
        <circle cx="10" cy="7" r="3.2" fill="#002776" />
        <path d="M6.9 6.3c2-.6 4.3-.4 6.1.7" fill="none" stroke="#fff" strokeWidth=".7" />
      </>
    ),
    en: (
      <>
        <rect width="20" height="14" fill="#fff" />
        {[0, 2, 4, 6, 8, 10, 12].map((y) => (
          <rect key={y} y={y} width="20" height="1.08" fill="#b22234" />
        ))}
        <rect width="9" height="7.5" fill="#3c3b6e" />
        {[1.5, 3.75, 6].flatMap((y, row) => [1.5, 3.5, 5.5, 7.5].slice(0, row % 2 ? 3 : 4).map((x) => <circle key={`${x}-${y}`} cx={row % 2 ? x + 1 : x} cy={y} r=".45" fill="#fff" />))}
      </>
    ),
    es: (
      <>
        <rect width="20" height="14" fill="#aa151b" />
        <rect y="3.5" width="20" height="7" fill="#f1bf00" />
      </>
    ),
  }[locale]
  return (
    <svg viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" className="shrink-0 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgb(0_0_0/0.12)]">
      {art}
    </svg>
  )
}

/** Language picker: flag and full name in the list; `compact` keeps the closed trigger to flag + code (PT, EN, ES). */
export function LanguageSelect({ value, onChange, className = 'input w-auto py-1.5', label = 'Language', compact }: { value: Locale; onChange: (l: Locale) => void; className?: string; label?: string; compact?: boolean }) {
  return (
    <Select className={className} aria-label={label} title={label} value={value} onChange={(e) => onChange(e.target.value as Locale)}>
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          <span className="flex items-center gap-2">
            <Flag locale={l} />
            <span className={compact ? 'in-[.select-trigger]:hidden' : undefined}>{LOCALE_NAMES[l]}</span>
            {compact ? <span className="hidden font-medium uppercase in-[.select-trigger]:inline">{l.slice(0, 2)}</span> : null}
          </span>
        </option>
      ))}
    </Select>
  )
}

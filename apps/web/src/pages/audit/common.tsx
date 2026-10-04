import type { MessageKey } from '@poc-intel/shared/i18n'
import { useState, type ReactNode } from 'react'
import { useI18n } from '../../lib/i18n'

export interface Page<T> {
  total: number
  rows: T[]
}

export type Preset = '1h' | '24h' | '7d' | '30d' | 'all'
export const PRESETS: Preset[] = ['1h', '24h', '7d', '30d', 'all']
const PRESET_MS: Record<Preset, number | null> = { '1h': 3_600_000, '24h': 86_400_000, '7d': 7 * 86_400_000, '30d': 30 * 86_400_000, all: null }

/** Builds a query string, dropping empty values; the time preset becomes `from`. */
export function qs(params: Record<string, string | number | null | undefined>, preset?: Preset): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== '' && v != null) p.set(k, String(v))
  const ms = preset ? PRESET_MS[preset] : null
  // Rounded to the minute: the query string is part of the query key, and a key that changes on
  // every render makes react-query refetch without end.
  if (ms) p.set('from', new Date(Math.floor((Date.now() - ms) / 60_000) * 60_000).toISOString())
  return p.toString()
}

export function useFormat() {
  const { locale } = useI18n()
  return {
    dateTime: (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'medium' }) : '—'),
    time: (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    num: (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString(locale)),
    // One unit rule for every duration in milliseconds: under a second in ms, otherwise seconds with one decimal.
    ms: (n: number | null | undefined) =>
      n == null ? '—' : n < 1000 ? `${Math.round(n).toLocaleString(locale)} ms` : `${(n / 1000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`,
    duration: (seconds: number | null | undefined) => {
      if (seconds == null) return '—'
      const m = Math.floor(seconds / 60)
      return m ? `${m} min ${Math.round(seconds % 60)} s` : `${Math.round(seconds)} s`
    },
    bytes: (n: number | null | undefined) => {
      if (n == null) return '—'
      const units = ['B', 'KB', 'MB', 'GB']
      let v = n
      let i = 0
      while (v >= 1024 && i < units.length - 1) {
        v /= 1024
        i++
      }
      return `${v.toLocaleString(locale, { minimumFractionDigits: i ? 1 : 0, maximumFractionDigits: i ? 1 : 0 })} ${units[i]}`
    },
  }
}

/** `className`/`optionClassName` replace the default look, e.g. on the dark Logs toolbar. */
export function PresetSelect({ value, onChange, className = 'input w-auto', optionClassName }: { value: Preset; onChange: (p: Preset) => void; className?: string; optionClassName?: string }) {
  const { t } = useI18n()
  return (
    <select className={className} aria-label={t('audit.period')} value={value} onChange={(e) => onChange(e.target.value as Preset)}>
      {PRESETS.map((p) => (
        <option key={p} value={p} className={optionClassName}>
          {t(`audit.preset.${p}` as MessageKey)}
        </option>
      ))}
    </select>
  )
}

export function Pager({ total, limit, offset, onChange }: { total: number; limit: number; offset: number; onChange: (offset: number) => void }) {
  const { t } = useI18n()
  const { num } = useFormat()
  if (!total) return null
  return (
    <div className="flex items-center justify-between gap-3 pt-3 text-xs text-slate-500">
      <span>{t('audit.showing', { from: num(offset + 1), to: num(Math.min(total, offset + limit)), total: num(total) })}</span>
      <span className="flex gap-2">
        <button className="btn-ghost" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
          ‹ {t('audit.prev')}
        </button>
        <button className="btn-ghost" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)}>
          {t('audit.next')} ›
        </button>
      </span>
    </div>
  )
}

/** Download links go through the browser so the session cookie applies; the server sets the file name. */
export function ExportButtons({ kind, query, formats = ['csv', 'json'] }: { kind: string; query: string; formats?: string[] }) {
  const { t } = useI18n()
  return (
    <span className="flex gap-1">
      {formats.map((f) => (
        <a key={f} className="btn-ghost text-xs" href={`/api/admin/audit/export?kind=${kind}&format=${f}&${query}`} title={t('audit.export')}>
          ⭳ {f.toUpperCase()}
        </a>
      ))}
    </span>
  )
}

export function Kpi({ label, value, hint, tone = 'default' }: { label: string; value: ReactNode; hint?: string; tone?: 'default' | 'good' | 'warn' | 'bad' }) {
  const color = { default: '', good: 'text-green-700 dark:text-green-400', warn: 'text-amber-600 dark:text-amber-400', bad: 'text-red-600 dark:text-red-400' }[tone]
  return (
    <div className="card p-4" title={hint}>
      <div className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-400">{hint}</div> : null}
    </div>
  )
}

export const LEVEL_STYLE: Record<string, string> = {
  debug: 'text-violet-300 bg-violet-500/15 border-violet-400/30',
  info: 'text-cyan-300 bg-cyan-500/10 border-cyan-400/25',
  warn: 'text-amber-300 bg-amber-500/10 border-amber-400/30',
  error: 'text-red-300 bg-red-500/15 border-red-400/30',
}

export function StatusBadge({ status, outcome }: { status: number | null; outcome?: string }) {
  const s = status ?? 0
  const cls =
    outcome === 'network' || !status
      ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
      : s >= 500
        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
        : s >= 400
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
          : 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
  return <span className={`rounded px-1.5 py-0.5 font-mono text-xs whitespace-nowrap ${cls}`}>{status ?? 'NET'}</span>
}

export function JsonBlock({ value }: { value: unknown }) {
  return <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-300 select-text">{JSON.stringify(value, null, 2)}</pre>
}

export function CopyButton({ text }: { text: string }) {
  const { t } = useI18n()
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      title={t('audit.copy')}
      className={`shrink-0 rounded px-1 text-xs opacity-0 group-hover:opacity-100 focus:opacity-100 ${done ? 'text-green-400' : 'text-slate-500 hover:text-slate-300'}`}
      onClick={(e) => {
        e.stopPropagation()
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        })
      }}
    >
      {done ? '✓' : '⧉'}
    </button>
  )
}

/** Bars of an hourly series; each bar shows its figures on hover. */
export function HourlyBars({ data, series }: { data: Record<string, number | string>[]; series: { key: string; color: string; label: string }[] }) {
  const { time, num } = useFormat()
  const max = Math.max(1, ...data.map((d) => series.reduce((a, s) => a + Number(d[s.key] ?? 0), 0)))
  return (
    <div>
      <div className="flex h-28 items-end gap-0.5">
        {data.map((d) => (
          <div key={String(d.hour)} className="group relative flex h-full flex-1 flex-col-reverse" title={`${time(String(d.hour))} · ${series.map((s) => `${s.label}: ${num(Number(d[s.key]))}`).join(' · ')}`}>
            {series.map((s) => (
              <div key={s.key} className={`${s.color} w-full first:rounded-b-sm last:rounded-t-sm group-hover:opacity-80`} style={{ height: `${(Number(d[s.key] ?? 0) / max) * 100}%` }} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{data[0] ? time(String(data[0].hour)) : ''}</span>
        <span>{data.at(-1) ? time(String(data.at(-1)!.hour)) : ''}</span>
      </div>
      <div className="mt-2 flex gap-3 text-xs text-slate-500">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1">
            <span className={`inline-block h-2 w-2 rounded-sm ${s.color}`} /> {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function Th({ children, right }: { children?: ReactNode; right?: boolean }) {
  return <th className={`px-2 py-2 text-xs font-medium tracking-wide whitespace-nowrap text-slate-500 uppercase ${right ? 'text-right' : 'text-left'}`}>{children}</th>
}

export function Empty({ loading }: { loading?: boolean }) {
  const { t } = useI18n()
  return <div className="py-10 text-center text-sm text-slate-400">{loading ? t('audit.loading') : t('audit.empty')}</div>
}

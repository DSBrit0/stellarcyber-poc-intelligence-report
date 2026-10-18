import type { CatalogKind, CatalogSources } from '@poc-intel/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, api } from '../../lib/api'
import { errorKey } from '../../lib/errors'
import { useI18n } from '../../lib/i18n'

interface CatalogState {
  version: { segment: string; label: string } | null
  buildTime: string | null
  lastRunAt: string | null
  lastResult: { ok: true; parsers: number; connectors: number; added: number; removed: number } | { ok: false; error: string } | null
}
interface CatalogAdmin {
  sources: CatalogSources
  state: CatalogState
  counts: { parsers: number; connectors: number; removed: number }
}
/** A parser or Connector an update brought in or removed. */
interface Change {
  kind: CatalogKind
  name: string
}
interface Preview {
  version: { segment: string; label: string; latest: { segment: string; label: string } | null }
  buildTime: string | null
  parsers: number
  connectors: number
  added: Change[]
  removed: Change[]
}
interface HistoryRow {
  id: string
  runAt: string
  trigger: 'manual' | 'scheduled' | 'backfill'
  userName: string | null
  versionSegment: string | null
  versionLabel: string | null
  parsers: number | null
  connectors: number | null
  added: Change[]
  removed: Change[]
}

/** Admin: the Data Source Catalog, refreshed every week from the official documentation, or now. */
export function CatalogCard() {
  const { t, locale } = useI18n()
  const { data } = useQuery({ queryKey: ['admin', 'catalog'], queryFn: () => api<CatalogAdmin>('/admin/catalog') })
  const [open, setOpen] = useState(false)
  if (!data) return null
  const { state, counts } = data
  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t('catalog.title')}</h2>
          <p className="max-w-3xl text-sm text-slate-500">{t('catalog.help')}</p>
        </div>
        <button className="btn" onClick={() => setOpen(true)}>
          {t('catalog.updateNow')}
        </button>
      </div>
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-slate-500">{t('catalog.version')}</dt>
        <dd>{state.version ? `${state.version.label} (${state.version.segment})` : '—'}</dd>
        <dt className="text-slate-500">{t('catalog.entries')}</dt>
        <dd>{t('catalog.counts', { parsers: counts.parsers, connectors: counts.connectors, removed: counts.removed })}</dd>
        <dt className="text-slate-500">{t('catalog.lastRun')}</dt>
        <dd>
          {state.lastRunAt ? new Date(state.lastRunAt).toLocaleString(locale) : t('catalog.never')}
          {state.lastResult && !state.lastResult.ok ? <span className="ml-2 text-red-600">{t(errorKey(new ApiError(0, state.lastResult.error)))}</span> : null}
        </dd>
        <dt className="text-slate-500">{t('catalog.schedule')}</dt>
        <dd>{t('catalog.scheduleValue')}</dd>
      </dl>
      <CatalogHistory />
      {open ? <UpdateDialog sources={data.sources} onClose={() => setOpen(false)} /> : null}
    </section>
  )
}

function UpdateDialog({ sources, onClose }: { sources: CatalogSources; onClose: () => void }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const ref = useRef<HTMLDialogElement>(null)
  const [parsersUrl, setParsersUrl] = useState(sources.parsersUrl)
  const [connectorsUrl, setConnectorsUrl] = useState(sources.connectorsUrl)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [checked, setChecked] = useState<string | null>(null)
  const [busy, setBusy] = useState<'validate' | 'apply' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  const body = { parsersUrl: parsersUrl.trim(), connectorsUrl: connectorsUrl.trim() }
  const key = JSON.stringify(body)
  // Confirming is allowed only for the exact URLs that were validated.
  const validated = preview != null && checked === key

  const validate = async () => {
    setBusy('validate')
    setError(null)
    setDone(false)
    try {
      setPreview(await api<Preview>('/admin/catalog/validate', { method: 'POST', body }))
      setChecked(key)
    } catch (err) {
      setPreview(null)
      setError(t(errorKey(err)))
    } finally {
      setBusy(null)
    }
  }
  const apply = async () => {
    setBusy('apply')
    setError(null)
    try {
      await api('/admin/catalog/apply', { method: 'POST', body })
      setDone(true)
      // Also refreshes the history (its key starts with the same two parts).
      void qc.invalidateQueries({ queryKey: ['admin', 'catalog'] })
      void qc.invalidateQueries({ queryKey: ['catalog'] })
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setBusy(null)
    }
  }
  const outdated = preview?.version.latest && preview.version.latest.segment !== preview.version.segment

  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-xl bg-white p-0 shadow-xl backdrop:bg-slate-900/60 dark:bg-slate-900 dark:text-slate-100">
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('catalog.updateNow')}</h2>
          <button type="button" className="btn-ghost" onClick={() => ref.current?.close()} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="text-sm text-slate-500">{t('catalog.dialogHelp')}</p>
        <label className="block">
          <span className="label">{t('catalog.parsersUrl')}</span>
          <input className="input font-mono text-xs" type="url" value={parsersUrl} onChange={(e) => setParsersUrl(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">{t('catalog.connectorsUrl')}</span>
          <input className="input font-mono text-xs" type="url" value={connectorsUrl} onChange={(e) => setConnectorsUrl(e.target.value)} />
        </label>
        <button type="button" className="btn-ghost" disabled={busy != null} onClick={() => void validate()}>
          {busy === 'validate' ? t('catalog.validating') : t('catalog.validate')}
        </button>

        {error ? (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">
            {error}
          </p>
        ) : null}
        {preview && validated ? (
          <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
            <p>
              <span className="rounded bg-green-100 px-2 py-0.5 font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
                ✓ {t('catalog.versionOk', { label: preview.version.label, segment: preview.version.segment })}
              </span>
            </p>
            {outdated ? <p className="text-amber-700 dark:text-amber-300">{t('catalog.newerVersion', { label: preview.version.latest!.label })}</p> : null}
            <p>{t('catalog.previewCounts', { parsers: preview.parsers, connectors: preview.connectors })}</p>
            <p>{t('catalog.previewDiff', { added: preview.added.length, removed: preview.removed.length })}</p>
            {preview.removed.length > 0 ? <p className="text-xs text-slate-500">{t('catalog.removedList')}: {preview.removed.slice(0, 20).map((c) => c.name).join(', ')}{preview.removed.length > 20 ? '…' : ''}</p> : null}
            {preview.buildTime ? <p className="text-xs text-slate-500">{t('catalog.build', { build: preview.buildTime })}</p> : null}
          </div>
        ) : null}
        {done ? <p className="text-sm text-green-700 dark:text-green-400">✓ {t('catalog.applied')}</p> : null}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => ref.current?.close()}>
            {done ? t('common.continue') : t('catalog.cancel')}
          </button>
          {!done ? (
            <button type="button" className="btn" disabled={!validated || busy != null} title={!validated ? t('catalog.validateFirst') : undefined} onClick={() => void apply()}>
              {busy === 'apply' ? t('catalog.applying') : t('catalog.confirm')}
            </button>
          ) : null}
        </div>
      </div>
    </dialog>
  )
}

/** How many names a collapsed update shows of each list before "+N more". */
const PREVIEW = 6

/**
 * The catalog's history: every update written, newest first, naming the parsers and Connectors that
 * came in and the ones that left. A long list shows its first names and opens in full; the search
 * finds a parser or Connector across all of it.
 */
function CatalogHistory() {
  const { t, locale } = useI18n()
  const { data } = useQuery({ queryKey: ['admin', 'catalog', 'history'], queryFn: () => api<HistoryRow[]>('/admin/catalog/history') })
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [shown, setShown] = useState(8)
  const q = query.trim().toLowerCase()
  const rows = useMemo(() => {
    const all = data ?? []
    if (!q) return all
    const hit = (c: Change) => c.name.toLowerCase().includes(q)
    return all.map((r) => ({ ...r, added: r.added.filter(hit), removed: r.removed.filter(hit) })).filter((r) => r.added.length + r.removed.length > 0)
  }, [data, q])
  if (!data) return null
  const trigger = (r: HistoryRow) => (r.trigger === 'manual' ? t('catalog.trigger.manual', { name: r.userName ?? '—' }) : t(`catalog.trigger.${r.trigger}`))
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  return (
    <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-semibold">{t('catalog.history')}</h3>
          <p className="text-sm text-slate-500">{t('catalog.historyHelp')}</p>
        </div>
        <input className="input max-w-xs" type="search" value={query} placeholder={t('catalog.historySearch')} aria-label={t('catalog.historySearch')} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {data.length === 0 ? <p className="text-sm text-slate-500">{t('catalog.historyEmpty')}</p> : null}
      {data.length > 0 && rows.length === 0 ? <p className="text-sm text-slate-500">{t('catalog.historyNoMatch')}</p> : null}
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {rows.slice(0, shown).map((r) => {
          // A search shows every matching name; otherwise a long list opens on demand.
          const full = Boolean(q) || open.has(r.id)
          const hidden = Math.max(0, r.added.length - PREVIEW) + Math.max(0, r.removed.length - PREVIEW)
          const changed = r.added.length + r.removed.length > 0
          return (
            <li key={r.id} className="space-y-1.5 px-3 py-2 text-sm">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="tabular-nums">{new Date(r.runAt).toLocaleString(locale)}</span>
                <span className="text-slate-500">{trigger(r)}</span>
                {r.versionLabel ? <span className="text-slate-500">{r.versionLabel}</span> : null}
                <span className="ml-auto flex items-center gap-2">
                  {r.added.length > 0 ? <span className="rounded bg-green-100 px-1.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">{t('catalog.addedCount', { n: r.added.length })}</span> : null}
                  {r.removed.length > 0 ? <span className="rounded bg-red-100 px-1.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">{t('catalog.removedCount', { n: r.removed.length })}</span> : null}
                  {!changed ? <span className="text-xs text-slate-400">{t('catalog.noChanges')}</span> : null}
                </span>
              </p>
              {changed ? (
                <ul className={`flex flex-wrap gap-1.5 ${full ? 'max-h-72 overflow-y-auto' : ''}`}>
                  {(full ? r.added : r.added.slice(0, PREVIEW)).map((c) => (
                    <ChangeChip key={`+${c.kind}:${c.name}`} change={c} added />
                  ))}
                  {(full ? r.removed : r.removed.slice(0, PREVIEW)).map((c) => (
                    <ChangeChip key={`-${c.kind}:${c.name}`} change={c} added={false} />
                  ))}
                  {hidden > 0 && !q ? (
                    <li>
                      <button type="button" className="rounded px-1.5 py-0.5 text-xs text-brand hover:underline" aria-expanded={full} onClick={() => toggle(r.id)}>
                        {full ? t('catalog.showLess') : t('catalog.showMoreN', { n: hidden })}
                      </button>
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
      {rows.length > shown ? (
        <button type="button" className="btn-ghost" onClick={() => setShown((n) => n + 8)}>
          {t('catalog.showMore')}
        </button>
      ) : null}
    </div>
  )
}

/** One parser or Connector an update brought in (green, +) or removed (red, −), with its kind. */
function ChangeChip({ change, added }: { change: Change; added: boolean }) {
  const { t } = useI18n()
  return (
    <li
      className={`flex items-baseline gap-1.5 rounded-md border px-2 py-0.5 text-xs ${
        added ? 'border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200' : 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
      }`}
      title={added ? t('catalog.addedTitle') : t('catalog.removedTitle')}
    >
      <span className="font-bold" aria-hidden>
        {added ? '+' : '−'}
      </span>
      <span className="font-medium">{change.name}</span>
      <span className="opacity-60">{t(`catalog.kind.${change.kind}`)}</span>
    </li>
  )
}

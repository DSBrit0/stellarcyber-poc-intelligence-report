import type { CatalogSources } from '@poc-intel/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
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
interface Preview {
  version: { segment: string; label: string; latest: { segment: string; label: string } | null }
  buildTime: string | null
  parsers: number
  connectors: number
  added: string[]
  removed: string[]
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
            {preview.removed.length > 0 ? <p className="text-xs text-slate-500">{t('catalog.removedList')}: {preview.removed.slice(0, 20).join(', ')}{preview.removed.length > 20 ? '…' : ''}</p> : null}
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

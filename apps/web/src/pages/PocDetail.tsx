import { LOCALES, TEMPLATES, type Locale, type PocDetails, type StellarCredential, type Template } from '@poc-intel/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ApiError, api } from '../lib/api'
import { CredentialFields } from '../lib/CredentialFields'
import { CustomerSelect } from '../lib/CustomerSelect'
import { errorKey } from '../lib/errors'
import { useMe } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { toReportImage } from '../lib/image'
import { PocForm } from '../lib/PocForm'
import { SyncBar, type SyncRow } from '../lib/SyncProgress'

interface PocView {
  id: string
  instanceUrl: string
  tenantName: string
  periodStart: string
  periodEnd: string
  details: PocDetails
  customerId: string | null
  customerName: string | null
  hasArchImage: boolean
  canEdit: boolean
  draft: boolean
  reports: ReportRow[]
  syncs: (Pick<SyncRow, 'id' | 'status' | 'progress' | 'error' | 'createdAt'>)[]
}

interface ReportRow {
  id: string
  createdAt: string
  expiresAt: string
  seq: number
  /** seq.minor: one minor version per Report comment. */
  version: string
  assetsAvg: number | null
  assetsPeak: number | null
  volumeGb: number | null
  cases: number | null
  alerts: number | null
  periodStart: string
  periodEnd: string
}

type Tab = 'reports' | 'details' | 'sync'

export function PocDetailPage() {
  const { id = '' } = useParams()
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('reports')
  const { data: poc } = useQuery({
    queryKey: ['poc', id],
    queryFn: () => api<PocView>(`/pocs/${id}`),
    refetchInterval: (q) => (q.state.data?.syncs.some((s) => s.status === 'queued' || s.status === 'running') ? 2000 : false),
  })
  if (!poc) return null
  const running = poc.syncs.find((x) => x.status === 'queued' || x.status === 'running')
  const latest = poc.syncs[0]
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            {poc.details.customerName}
            {poc.draft ? <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{t('poc.draft')}</span> : null}
          </h1>
          <p className="text-sm text-slate-500">
            {poc.tenantName} · {poc.periodStart} → {poc.periodEnd}
            {poc.customerName ? ` · ${t('nav.customers')}: ${poc.customerName}` : ''}
          </p>
        </div>
        {poc.canEdit ? (
          <div className="flex flex-wrap gap-2">
            <button className={tab === 'sync' ? 'btn' : 'btn-ghost'} onClick={() => setTab(tab === 'sync' ? 'reports' : 'sync')}>
              {t('sync.new')}
            </button>
            <button className={tab === 'details' ? 'btn' : 'btn-ghost'} onClick={() => setTab(tab === 'details' ? 'reports' : 'details')}>
              {t('poc.editDetails')}
            </button>
            <DeletePocButton id={poc.id} />
          </div>
        ) : null}
      </div>
      {running || latest?.status === 'failed' ? <SyncBar sync={running ?? latest} /> : null}
      {tab === 'reports' ? <ReportsTab poc={poc} /> : tab === 'details' ? <DetailsTab poc={poc} onSaved={() => setTab('reports')} /> : <SyncTab poc={poc} onStarted={() => setTab('reports')} />}
    </div>
  )
}

function Widget({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
      {sub ? <div className="text-[11px] text-slate-400">{sub}</div> : null}
    </div>
  )
}

function ReportsTab({ poc }: { poc: PocView }) {
  const { t } = useI18n()
  if (poc.reports.length === 0) return <p className="card text-sm text-slate-500">{t('report.empty')}</p>
  return (
    <ul className="space-y-3">
      {poc.reports.map((r) => (
        <ReportItem key={r.id} poc={poc} r={r} />
      ))}
    </ul>
  )
}

/** One Report per Sync: its own widgets, Template/language, open/present/PDF, comments and trash. */
function ReportItem({ poc, r }: { poc: PocView; r: ReportRow }) {
  const { t, locale } = useI18n()
  const [template, setTemplate] = useState<Template>('executive')
  const [lang, setLang] = useState<Locale>(locale)
  const [comments, setComments] = useState(false)
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale)
  const num = (n: number | null, digits = 0) => (n == null ? '—' : n.toLocaleString(locale, { maximumFractionDigits: digits }))
  const url = (kind: 'html' | 'pdf') => `/api/report-data/${r.id}/${kind}?template=${template}&locale=${lang}`
  return (
    <li className="card space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand" title={t('report.versionHelp')}>
          v{r.version}
        </span>
        <span className="font-medium">{date(r.createdAt)}</span>
        <span className="text-slate-500">
          · {r.periodStart} → {r.periodEnd}
        </span>
        <span className="text-xs text-slate-400">{t('report.expiresOn', { date: date(r.expiresAt) })}</span>
        {poc.canEdit ? (
          <span className="ml-auto">
            <DeleteReportButton pocId={poc.id} reportId={r.id} />
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Widget label={t('widget.assets')} value={num(r.assetsAvg)} sub={r.assetsPeak != null ? t('widget.assetsPeak', { n: num(r.assetsPeak) }) : undefined} />
        <Widget label={t('widget.ingestion')} value={r.volumeGb == null ? '—' : `${num(r.volumeGb, 2)} GB`} />
        <Widget label={t('widget.cases')} value={num(r.cases)} />
        <Widget label={t('widget.alerts')} value={num(r.alerts)} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto py-1.5" value={template} onChange={(e) => setTemplate(e.target.value as Template)} aria-label="Template">
          {TEMPLATES.map((tpl) => (
            <option key={tpl} value={tpl}>
              {t(`template.${tpl}`)}
            </option>
          ))}
        </select>
        <select className="input w-auto py-1.5" value={lang} onChange={(e) => setLang(e.target.value as Locale)} aria-label="Language">
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <a className="btn" href={url('html')} target="_blank" rel="noopener">
          {t('report.open')}
        </a>
        <a className="btn-ghost" href={url('pdf')}>
          {t('report.pdf')}
        </a>
        <button className="btn-ghost" onClick={() => setComments(!comments)}>
          {t('report.comments')}
        </button>
      </div>
      {comments ? <Comments pocId={poc.id} reportId={r.id} version={r.version} /> : null}
    </li>
  )
}

interface CommentRow {
  id: string
  body: string
  kind: 'internal' | 'report'
  private: boolean
  createdAt: string
  author: string | null
}

/**
 * Comments on one Report. An internal comment stays in the app; a Report comment is a change note:
 * it makes a new minor version and is printed in the Report's version history (Appendix B).
 */
function Comments({ pocId, reportId, version }: { pocId: string; reportId: string; version: string }) {
  const { t, locale } = useI18n()
  const qc = useQueryClient()
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<CommentRow['kind']>('internal')
  const [isPrivate, setPrivate] = useState(false)
  const { data: me } = useMe()
  const staff = me != null && me.role !== 'customer'
  const [major, minor] = version.split('.').map(Number)
  const { data = [] } = useQuery({ queryKey: ['comments', reportId], queryFn: () => api<CommentRow[]>(`/report-data/${reportId}/comments`) })
  const add = useMutation({
    mutationFn: () => api(`/report-data/${reportId}/comments`, { method: 'POST', body: { body, kind, private: staff && kind === 'internal' && isPrivate } }),
    onSuccess: () => {
      setBody('')
      setPrivate(false)
      void qc.invalidateQueries({ queryKey: ['comments', reportId] })
      if (kind === 'report') void qc.invalidateQueries({ queryKey: ['poc', pocId] })
    },
  })
  return (
    <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
      {data.map((c) => (
        <div key={c.id} className="text-sm">
          <span className="font-medium">{c.author ?? '—'}</span>{' '}
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${c.kind === 'report' ? 'bg-brand/10 text-brand' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
            {t(c.kind === 'report' ? 'report.commentReport' : 'report.commentInternal')}
          </span>{' '}
          {c.private ? (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800" title={t('report.commentPrivateHelp')}>
              {t('report.commentPrivateBadge')}
            </span>
          ) : null}{' '}
          <span className="text-xs text-slate-500">{new Date(c.createdAt).toLocaleString(locale)}</span>
          <p className="whitespace-pre-wrap">{c.body}</p>
        </div>
      ))}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (body.trim()) add.mutate()
        }}
      >
        <div className="flex flex-wrap gap-4 text-sm" role="radiogroup" aria-label={t('report.commentType')}>
          {(['internal', 'report'] as const).map((k) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" checked={kind === k} onChange={() => setKind(k)} />
              {t(k === 'report' ? 'report.commentReport' : 'report.commentInternal')}
            </label>
          ))}
        </div>
        {staff && kind === 'internal' ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} />
            {t('report.commentPrivate')}
          </label>
        ) : null}
        <p className="text-xs text-slate-500">{kind === 'internal' && staff && isPrivate ? t('report.commentPrivateHelp') : kind === 'report' ? t('report.commentReportHelp', { v: `${major}.${(minor ?? 0) + 1}` }) : t('report.commentInternalHelp')}</p>
        <div className="flex gap-2">
          <textarea className="input" rows={2} maxLength={4000} placeholder={t('report.addComment')} value={body} onChange={(e) => setBody(e.target.value)} />
          <button className="btn self-end" disabled={add.isPending || !body.trim()}>
            {t('report.send')}
          </button>
        </div>
      </form>
    </div>
  )
}

function DetailsTab({ poc, onSaved }: { poc: PocView; onSaved: () => void }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [details, setDetails] = useState<PocDetails>(poc.details)
  const [customerId, setCustomerId] = useState<string | null>(poc.customerId)
  const [saved, setSaved] = useState(false)
  useEffect(() => setDetails(poc.details), [poc.details])
  const save = useMutation({
    mutationFn: () => api(`/pocs/${poc.id}`, { method: 'PATCH', body: { customerId, finalize: true, details: { ...details, analysts: details.analysts.map((a) => a.trim()).filter(Boolean) } } }),
    onSuccess: () => {
      setSaved(true)
      void qc.invalidateQueries({ queryKey: ['poc', poc.id] })
      onSaved()
    },
  })
  const image = useMutation({
    mutationFn: async (file: File | null) => api(`/pocs/${poc.id}/arch-image`, { method: 'PUT', body: { dataUrl: file ? await toReportImage(file) : null } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['poc', poc.id] }),
  })
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        setSaved(false)
        save.mutate()
      }}
    >
      <div className="card">
        <CustomerSelect value={customerId} onChange={setCustomerId} />
      </div>
      <PocForm value={details} onChange={setDetails} />
      <fieldset className="card space-y-3">
        <legend className="px-1 text-sm font-semibold text-slate-600">{t('form.sectionArch')}</legend>
        {poc.hasArchImage ? <img src={`/api/pocs/${poc.id}/arch-image?v=${Date.now()}`} alt="" className="max-h-64 rounded border border-slate-200" /> : null}
        <div className="flex flex-wrap gap-3">
          <label className="btn-ghost cursor-pointer">
            {t('form.archUpload')}
            <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => e.target.files?.[0] && image.mutate(e.target.files[0])} />
          </label>
          {poc.hasArchImage ? (
            <button type="button" className="btn-ghost" onClick={() => image.mutate(null)}>
              {t('form.archRemove')}
            </button>
          ) : null}
        </div>
        {image.error ? <p className="text-sm text-red-600">{t(errorKey(image.error))}</p> : null}
      </fieldset>
      <div className="flex items-center gap-3">
        <button className="btn" disabled={save.isPending}>
          {t('common.save')}
        </button>
        {saved ? <span className="text-sm text-green-600">{t('form.saved')}</span> : null}
        {save.error ? <span className="text-sm text-red-600">{t(errorKey(save.error))}</span> : null}
      </div>
    </form>
  )
}

function SyncTab({ poc, onStarted }: { poc: PocView; onStarted: () => void }) {
  const { t, locale } = useI18n()
  const qc = useQueryClient()
  const remembered = useQuery({ queryKey: ['remembered'], queryFn: () => api<{ instanceUrl: string }[]>('/stellar/credentials') })
  const stored = (remembered.data ?? []).some((r) => r.instanceUrl === poc.instanceUrl)
  const [useStored, setUseStored] = useState(true)
  const [remember, setRemember] = useState(true)
  const [credential, setCredential] = useState<StellarCredential>({ method: 'apiKey', apiKey: '' })
  const running = poc.syncs.some((s) => s.status === 'queued' || s.status === 'running')
  const sync = useMutation({
    mutationFn: () => api(`/pocs/${poc.id}/syncs`, { method: 'POST', body: stored && useStored ? {} : { credential, remember } }),
    onSuccess: () => {
      setCredential(credential.method === 'apiKey' ? { method: 'apiKey', apiKey: '' } : { method: 'basic', username: '', token: '' })
      void qc.invalidateQueries({ queryKey: ['poc', poc.id] })
      void remembered.refetch()
      onStarted()
    },
  })
  return (
    <section className="card space-y-4">
      <p className="text-sm text-slate-500">{poc.instanceUrl}</p>
      {stored && useStored ? (
        <p className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded bg-green-100 px-2 py-1 text-green-800">✓ {t('wiz.remembered')}</span>
          <button type="button" className="text-brand underline" onClick={() => setUseStored(false)}>
            {t('wiz.useOther')}
          </button>
        </p>
      ) : (
        <>
          <CredentialFields value={credential} onChange={setCredential} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            {t('wiz.remember')}
          </label>
        </>
      )}
      <button className="btn" disabled={sync.isPending || running} onClick={() => sync.mutate()}>
        {t('wiz.runSync')}
      </button>
      {sync.error ? <p className="text-sm text-red-600">{t(errorKey(sync.error))}</p> : null}
      <ul className="space-y-1 border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
        {poc.syncs.map((s) => (
          <li key={s.id} className="flex gap-3">
            <span>{new Date(s.createdAt).toLocaleString(locale)}</span>
            <span className="font-medium">{t(`sync.status.${s.status}`)}</span>
            {s.error ? <span className="text-red-600">{s.error}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
    </svg>
  )
}

/** Permanent deletion of one Report (Report Data, PDFs, comments, its Sync). */
function DeleteReportButton({ pocId, reportId }: { pocId: string; reportId: string }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const del = useMutation({
    mutationFn: () => api(`/report-data/${reportId}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['poc', pocId] }),
  })
  return (
    <button
      className="btn-ghost text-red-600 hover:bg-red-50"
      title={t('report.delete')}
      aria-label={t('report.delete')}
      disabled={del.isPending}
      onClick={() => window.confirm(t('report.deleteConfirm')) && del.mutate()}
    >
      <TrashIcon />
    </button>
  )
}

/** Permanent deletion of the whole PoC and everything it holds. */
function DeletePocButton({ id }: { id: string }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const del = useMutation({
    mutationFn: () => api(`/pocs/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pocs'] })
      navigate('/')
    },
  })
  return (
    <button
      className="btn-ghost text-red-600 hover:bg-red-50"
      title={t('poc.delete')}
      aria-label={t('poc.delete')}
      disabled={del.isPending}
      onClick={() => window.confirm(t('poc.deleteConfirm')) && del.mutate()}
    >
      <TrashIcon />
      <span className="hidden sm:inline">{t('poc.delete')}</span>
    </button>
  )
}

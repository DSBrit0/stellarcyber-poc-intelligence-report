import { TEMPLATES, type PocDetails, type StellarCredential, type SyncStatus, type Template } from '@poc-intel/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { ApiError, api } from '../lib/api'
import { CredentialFields } from '../lib/CredentialFields'
import { CustomerSelect } from '../lib/CustomerSelect'
import { errorKey } from '../lib/errors'
import { useI18n } from '../lib/i18n'
import { toReportImage } from '../lib/image'
import { PocForm } from '../lib/PocForm'

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
  reports: { id: string; createdAt: string; expiresAt: string; version: number }[]
  syncs: { id: string; status: SyncStatus; progress: { done: number; total: number } | null; error: string | null; createdAt: string }[]
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
  const tabs: Tab[] = poc.canEdit ? ['reports', 'details', 'sync'] : ['reports']
  const tabLabel: Record<Tab, string> = { reports: 'Reports', details: t('poc.details'), sync: 'Sync' }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{poc.details.customerName}</h1>
        <p className="text-sm text-slate-500">
          {poc.tenantName} · {poc.periodStart} → {poc.periodEnd}
          {poc.customerName ? ` · ${t('nav.customers')}: ${poc.customerName}` : ''}
        </p>
      </div>
      {tabs.length > 1 ? (
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800" role="tablist">
          {tabs.map((x) => (
            <button
              key={x}
              role="tab"
              aria-selected={tab === x}
              className={`-mb-px border-b-2 px-4 py-2 text-sm ${tab === x ? 'border-brand font-semibold text-brand' : 'border-transparent text-slate-500'}`}
              onClick={() => setTab(x)}
            >
              {tabLabel[x]}
            </button>
          ))}
        </div>
      ) : null}
      {tab === 'reports' ? <ReportsTab poc={poc} /> : tab === 'details' ? <DetailsTab poc={poc} /> : <SyncTab poc={poc} />}
    </div>
  )
}

function ReportsTab({ poc }: { poc: PocView }) {
  const { t, locale } = useI18n()
  const [template, setTemplate] = useState<Template>('executive')
  const [open, setOpen] = useState<string | null>(poc.reports[0]?.id ?? null)
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale)
  const url = (rid: string, kind: 'html' | 'pdf' | 'present') => `/api/report-data/${rid}/${kind}?template=${template}&locale=${locale}`
  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-semibold">Reports</h2>
        <select className="input ml-auto w-auto" value={template} onChange={(e) => setTemplate(e.target.value as Template)}>
          {TEMPLATES.map((tpl) => (
            <option key={tpl} value={tpl}>
              {t(`template.${tpl}`)}
            </option>
          ))}
        </select>
      </div>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {poc.reports.map((r) => (
          <li key={r.id} className="py-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span>{date(r.createdAt)}</span>
              <span className="text-xs text-slate-500">{t('report.expiresOn', { date: date(r.expiresAt) })}</span>
              <span className="ml-auto flex flex-wrap gap-2">
                <a className="btn" href={url(r.id, 'present')} target="_blank" rel="noopener">
                  {t('report.present')}
                </a>
                <a className="btn-ghost" href={url(r.id, 'html')} target="_blank" rel="noopener">
                  {t('report.view')}
                </a>
                <a className="btn-ghost" href={url(r.id, 'pdf')}>
                  {t('report.pdf')}
                </a>
                <button className="btn-ghost" onClick={() => setOpen(open === r.id ? null : r.id)}>
                  {t('report.comments')}
                </button>
              </span>
            </div>
            {open === r.id ? <Comments reportId={r.id} /> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

interface CommentRow {
  id: string
  body: string
  createdAt: string
  author: string | null
}

function Comments({ reportId }: { reportId: string }) {
  const { t, locale } = useI18n()
  const qc = useQueryClient()
  const [body, setBody] = useState('')
  const { data = [] } = useQuery({ queryKey: ['comments', reportId], queryFn: () => api<CommentRow[]>(`/report-data/${reportId}/comments`) })
  const add = useMutation({
    mutationFn: () => api(`/report-data/${reportId}/comments`, { method: 'POST', body: { body } }),
    onSuccess: () => {
      setBody('')
      void qc.invalidateQueries({ queryKey: ['comments', reportId] })
    },
  })
  return (
    <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
      {data.map((c) => (
        <div key={c.id} className="text-sm">
          <span className="font-medium">{c.author ?? '—'}</span> <span className="text-xs text-slate-500">{new Date(c.createdAt).toLocaleString(locale)}</span>
          <p className="whitespace-pre-wrap">{c.body}</p>
        </div>
      ))}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (body.trim()) add.mutate()
        }}
      >
        <textarea className="input" rows={2} maxLength={4000} placeholder={t('report.addComment')} value={body} onChange={(e) => setBody(e.target.value)} />
        <button className="btn self-end" disabled={add.isPending || !body.trim()}>
          {t('report.send')}
        </button>
      </form>
    </div>
  )
}

function DetailsTab({ poc }: { poc: PocView }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [details, setDetails] = useState<PocDetails>(poc.details)
  const [customerId, setCustomerId] = useState<string | null>(poc.customerId)
  const [saved, setSaved] = useState(false)
  useEffect(() => setDetails(poc.details), [poc.details])
  const save = useMutation({
    mutationFn: () => api(`/pocs/${poc.id}`, { method: 'PATCH', body: { customerId, details: { ...details, analysts: details.analysts.map((a) => a.trim()).filter(Boolean) } } }),
    onSuccess: () => {
      setSaved(true)
      void qc.invalidateQueries({ queryKey: ['poc', poc.id] })
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

function SyncTab({ poc }: { poc: PocView }) {
  const { t, locale } = useI18n()
  const qc = useQueryClient()
  const [credential, setCredential] = useState<StellarCredential>({ method: 'apiKey', apiKey: '' })
  const sync = useMutation({
    mutationFn: () => api(`/pocs/${poc.id}/syncs`, { method: 'POST', body: { credential } }),
    onSuccess: () => {
      setCredential(credential.method === 'apiKey' ? { method: 'apiKey', apiKey: '' } : { method: 'basic', username: '', token: '' })
      void qc.invalidateQueries({ queryKey: ['poc', poc.id] })
    },
  })
  return (
    <section className="card space-y-4">
      <ul className="space-y-1 text-sm">
        {poc.syncs.map((s) => (
          <li key={s.id} className="flex gap-3">
            <span>{new Date(s.createdAt).toLocaleString(locale)}</span>
            <span className="font-medium">{t(`sync.status.${s.status}`)}</span>
            {s.status === 'running' && s.progress ? (
              <span className="text-slate-500">
                {Math.round((s.progress.done / Math.max(1, s.progress.total)) * 100)}%
              </span>
            ) : null}
            {s.error ? <span className="text-red-600">{s.error}</span> : null}
          </li>
        ))}
      </ul>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          sync.mutate()
        }}
      >
        <CredentialFields value={credential} onChange={setCredential} />
        <button className="btn" disabled={sync.isPending}>
          {t('sync.start')}
        </button>
        {sync.error instanceof ApiError ? <p className="text-sm text-red-600">{t(errorKey(sync.error))}</p> : null}
      </form>
    </section>
  )
}

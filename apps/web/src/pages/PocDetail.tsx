import { TEMPLATES, type StellarCredential, type SyncStatus, type Template } from '@poc-intel/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'
import { api } from '../lib/api'
import { CredentialFields } from '../lib/CredentialFields'
import { errorKey } from '../lib/errors'
import { useI18n } from '../lib/i18n'

interface PocView {
  id: string
  instanceUrl: string
  tenantName: string
  periodStart: string
  periodEnd: string
  details: { customerName: string }
  reports: { id: string; createdAt: string; expiresAt: string }[]
  syncs: { id: string; status: SyncStatus; progress: { done: number; total: number } | null; error: string | null; createdAt: string }[]
}

export function PocDetailPage() {
  const { id = '' } = useParams()
  const { t, locale } = useI18n()
  const qc = useQueryClient()
  const [template, setTemplate] = useState<Template>('technical')
  const [credential, setCredential] = useState<StellarCredential>({ method: 'apiKey', apiKey: '' })

  const { data: poc } = useQuery({
    queryKey: ['poc', id],
    queryFn: () => api<PocView>(`/pocs/${id}`),
    // Poll while a Sync is in flight.
    refetchInterval: (q) => (q.state.data?.syncs.some((s) => s.status === 'queued' || s.status === 'running') ? 2000 : false),
  })

  const sync = useMutation({
    mutationFn: () => api(`/pocs/${id}/syncs`, { method: 'POST', body: { credential } }),
    onSuccess: () => {
      setCredential(credential.method === 'apiKey' ? { method: 'apiKey', apiKey: '' } : { method: 'basic', username: '', token: '' })
      void qc.invalidateQueries({ queryKey: ['poc', id] })
    },
  })

  if (!poc) return null
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale)
  const reportUrl = (reportId: string, kind: 'html' | 'pdf') => `/api/report-data/${reportId}/${kind}?template=${template}&locale=${locale}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{poc.details.customerName}</h1>
        <p className="text-sm text-slate-500">
          {poc.tenantName} · {poc.periodStart} → {poc.periodEnd} · {poc.instanceUrl}
        </p>
      </div>

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
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <span>{date(r.createdAt)}</span>
              <span className="text-xs text-slate-500">{t('report.expiresOn', { date: date(r.expiresAt) })}</span>
              <span className="ml-auto flex gap-2">
                <a className="btn-ghost" href={reportUrl(r.id, 'html')} target="_blank" rel="noopener">
                  {t('report.view')}
                </a>
                <a className="btn-ghost" href={reportUrl(r.id, 'pdf')}>
                  {t('report.pdf')}
                </a>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">Sync</h2>
        <ul className="space-y-1 text-sm">
          {poc.syncs.map((s) => (
            <li key={s.id} className="flex gap-3">
              <span>{new Date(s.createdAt).toLocaleString(locale)}</span>
              <span className="font-medium">{t(`sync.status.${s.status}`)}</span>
              {s.status === 'running' && s.progress ? (
                <span className="text-slate-500">
                  {s.progress.done}/{s.progress.total}
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
          {sync.error ? <p className="text-sm text-red-600">{t(errorKey(sync.error))}</p> : null}
        </form>
      </section>
    </div>
  )
}

import { SYNC_STATUSES, type SyncStatus as SyncStatusValue } from '@poc-intel/shared'
import type { MessageKey } from '@poc-intel/shared/i18n'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { Go } from '../Audit'
import { EndpointTable, type EndpointStat } from './Api'
import { Empty, JsonBlock, LEVEL_STYLE, Pager, PresetSelect, Th, qs, useFormat, type Page, type Preset } from './common'

interface SyncRow {
  id: string
  status: SyncStatusValue
  error: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  reportDataId: string | null
  totalMs: number | null
  counts: Record<string, number> | null
  pocId: string | null
  tenantName: string | null
  instanceUrl: string | null
  company: string | null
  email: string | null
  calls: number
  callErrors: number
}
interface SyncDetail {
  sync: SyncRow & {
    metrics: { totalMs: number; phases: Record<string, number>; concurrency: number; peakInFlight: number; counts: Record<string, number> } | null
    progress: unknown
    periodStart: string | null
    periodEnd: string | null
  }
  endpoints: EndpointStat[]
  logs: { id: number; at: string; level: string; category: string; message: string; context: unknown }[]
}

const LIMIT = 50
const STATUS_STYLE: Record<SyncRow['status'], string> = {
  queued: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  running: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  succeeded: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400',
}

function SyncStatus({ status }: { status: SyncRow['status'] }) {
  const { t } = useI18n()
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>{t(`sync.status.${status}` as MessageKey)}</span>
}

const seconds = (s: { startedAt: string | null; finishedAt: string | null }) => (s.startedAt && s.finishedAt ? (Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 1000 : null)

function SyncDetailPanel({ id, go, onClose }: { id: string; go: Go; onClose: () => void }) {
  const { t } = useI18n()
  const f = useFormat()
  const q = useQuery({
    queryKey: ['audit', 'sync', id],
    queryFn: () => api<SyncDetail>(`/admin/audit/syncs/${id}`),
    refetchInterval: (s) => (s.state.data && ['queued', 'running'].includes(s.state.data.sync.status) ? 3000 : false),
  })
  if (!q.data) return <Empty loading={q.isLoading} />
  const { sync, endpoints, logs } = q.data
  const phases = Object.entries(sync.metrics?.phases ?? {}).sort((a, b) => b[1] - a[1])
  const maxPhase = Math.max(1, ...phases.map(([, ms]) => ms))

  return (
    <section className="card space-y-4 border-brand/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{sync.company || sync.tenantName || '—'}</h2>
            <SyncStatus status={sync.status} />
          </div>
          <p className="text-sm text-slate-500">
            {sync.tenantName} · {sync.instanceUrl?.replace(/^https?:\/\//, '')} · {sync.periodStart} → {sync.periodEnd}
          </p>
          <p className="text-xs text-slate-400">
            {sync.email ?? '—'} · {f.dateTime(sync.createdAt)} · <span className="font-mono">{sync.id}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {sync.pocId ? (
            <Link className="btn-ghost" to={`/pocs/${sync.pocId}`}>
              {t('audit.openPoc')}
            </Link>
          ) : null}
          <button className="btn-ghost" onClick={() => go('api', { syncId: sync.id })}>
            {t('audit.seeCalls')}
          </button>
          <button className="btn-ghost" onClick={onClose} aria-label={t('audit.close')}>
            ✕
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
        <div>
          <div className="text-xs text-slate-500">{t('audit.duration')}</div>
          <div className="font-semibold tabular-nums">{f.duration(seconds(sync))}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">{t('audit.calls')}</div>
          <div className="font-semibold tabular-nums">{f.num(sync.calls)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">{t('audit.errors')}</div>
          <div className={`font-semibold tabular-nums ${sync.callErrors ? 'text-red-600' : ''}`}>{f.num(sync.callErrors)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">{t('audit.concurrency')}</div>
          <div className="font-semibold tabular-nums">
            {sync.metrics ? `${sync.metrics.peakInFlight} / ${sync.metrics.concurrency}` : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">{t('audit.result')}</div>
          <div className={`font-semibold ${sync.error ? 'text-red-600' : ''}`}>{sync.error ?? (sync.reportDataId ? t('audit.reportStored') : '—')}</div>
        </div>
      </div>

      {sync.metrics?.counts ? (
        <div className="flex flex-wrap gap-2">
          {Object.entries(sync.metrics.counts).map(([k, v]) => (
            <span key={k} className="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">
              {k}: <b className="tabular-nums">{f.num(v)}</b>
            </span>
          ))}
        </div>
      ) : null}

      {phases.length ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">{t('audit.phases')}</h3>
          <div className="space-y-1">
            {phases.map(([name, ms]) => (
              <div key={name} className="flex items-center gap-2 text-xs">
                <span className="w-40 truncate font-mono text-slate-500">{name}</span>
                <div className="h-2 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded bg-brand/70" style={{ width: `${(ms / maxPhase) * 100}%` }} />
                </div>
                <span className="w-16 text-right tabular-nums">{f.ms(ms)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {endpoints.length ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">{t('audit.endpoints')}</h3>
          <EndpointTable rows={endpoints} onPick={(endpoint) => go('api', { syncId: sync.id, endpoint })} />
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-semibold">{t('audit.timeline')}</h3>
        {logs.length ? (
          <ol className="space-y-2 border-l-2 border-slate-200 pl-4 dark:border-slate-700">
            {logs.map((l) => (
              <li key={l.id} className="text-sm">
                <details>
                  <summary className="cursor-pointer">
                    <span className={`mr-2 rounded border px-1.5 font-mono text-xs uppercase ${LEVEL_STYLE[l.level]} bg-slate-900`}>{l.level}</span>
                    <span className="text-xs text-slate-500 tabular-nums">{f.dateTime(l.at)}</span> {l.message}
                  </summary>
                  <div className="mt-2">
                    <JsonBlock value={l.context} />
                  </div>
                </details>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-400">{t('audit.none')}</p>
        )}
      </div>
    </section>
  )
}

export function SyncsTab({ params, go }: { params: URLSearchParams; go: Go }) {
  const { t } = useI18n()
  const f = useFormat()
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [preset, setPreset] = useState<Preset>('30d')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<string | null>(params.get('syncId'))
  const filter = qs({ status, q: q.trim() }, preset)
  const syncs = useQuery({
    queryKey: ['audit', 'syncs', filter, offset],
    queryFn: () => api<Page<SyncRow>>(`/admin/audit/syncs?${filter}&limit=${LIMIT}&offset=${offset}`),
    placeholderData: keepPreviousData,
    refetchInterval: (s) => (s.state.data?.rows.some((r) => r.status === 'running' || r.status === 'queued') ? 5000 : false),
  })

  return (
    <div className="space-y-4">
      {selected ? <SyncDetailPanel id={selected} go={go} onClose={() => setSelected(null)} /> : null}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-auto" aria-label={t('audit.status')} value={status} onChange={(e) => (setStatus(e.target.value), setOffset(0))}>
            <option value="">{t('audit.allStatuses')}</option>
            {SYNC_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`sync.status.${s}` as MessageKey)}
              </option>
            ))}
          </select>
          <PresetSelect value={preset} onChange={(p) => (setPreset(p), setOffset(0))} />
          <input className="input min-w-40 flex-1" placeholder={t('audit.searchSyncs')} value={q} onChange={(e) => (setQ(e.target.value), setOffset(0))} />
        </div>
        {syncs.data?.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>{t('audit.when')}</Th>
                  <Th>{t('audit.status')}</Th>
                  <Th>{t('audit.poc')}</Th>
                  <Th>{t('audit.user')}</Th>
                  <Th right>{t('audit.duration')}</Th>
                  <Th right>{t('audit.calls')}</Th>
                  <Th right>{t('audit.errors')}</Th>
                </tr>
              </thead>
              <tbody>
                {syncs.data.rows.map((s) => (
                  <tr
                    key={s.id}
                    className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 ${selected === s.id ? 'bg-brand/5' : ''}`}
                    onClick={() => {
                      setSelected(s.id)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  >
                    <td className="px-2 py-2 whitespace-nowrap text-slate-500 tabular-nums">{f.dateTime(s.createdAt)}</td>
                    <td className="px-2 py-2">
                      <SyncStatus status={s.status} />
                      {s.error ? <div className="text-xs text-red-600">{s.error}</div> : null}
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-medium">{s.company || s.tenantName || '—'}</div>
                      <div className="text-xs text-slate-500">
                        {s.tenantName} · {s.instanceUrl?.replace(/^https?:\/\//, '')}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-500">{s.email ?? '—'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{f.duration(seconds(s))}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{f.num(s.calls)}</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${s.callErrors ? 'font-semibold text-red-600' : 'text-slate-400'}`}>{f.num(s.callErrors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty loading={syncs.isLoading} />
        )}
        <Pager total={syncs.data?.total ?? 0} limit={LIMIT} offset={offset} onChange={setOffset} />
      </section>
    </div>
  )
}

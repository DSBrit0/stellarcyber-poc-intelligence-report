import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Fragment, useState } from 'react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { Empty, ExportButtons, JsonBlock, Pager, PresetSelect, StatusBadge, Th, qs, useFormat, type Page, type Preset } from './common'
import { Select } from '../../lib/Select'

interface CallRow {
  id: number
  at: string
  syncId: string | null
  userId: string | null
  email: string | null
  instance: string
  method: string
  endpoint: string
  path: string
  query: Record<string, string> | null
  status: number | null
  outcome: 'ok' | 'http_error' | 'network'
  ms: number
  bytes: number
  retry: boolean
  error: string | null
}
export interface EndpointStat {
  endpoint: string
  method?: string
  requests: number
  errors: number
  retries: number
  p50: number
  p95: number
  max: number
  bytes: number
  statuses?: Record<string, number>
}
interface Stats {
  instances: { instance: string; requests: number; errors: number; p95: number; bytes: number; lastAt: string }[]
  endpoints: EndpointStat[]
  statuses: { status: string; n: number }[]
}

const LIMIT = 100
const host = (url: string) => url.replace(/^https?:\/\//, '')

/** Per-endpoint table; clicking a row filters the calls below. Shared with the Sync detail. */
export function EndpointTable({ rows, onPick }: { rows: EndpointStat[]; onPick?: (endpoint: string) => void }) {
  const { t } = useI18n()
  const f = useFormat()
  const maxP95 = Math.max(1, ...rows.map((r) => r.p95))
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <Th>{t('audit.endpoint')}</Th>
            <Th right>{t('audit.requests')}</Th>
            <Th right>{t('audit.errors')}</Th>
            <Th right>{t('audit.retries')}</Th>
            <Th right>p50</Th>
            <Th>p95</Th>
            <Th right>max</Th>
            <Th right>{t('audit.volume')}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={`${r.method ?? ''}${r.endpoint}`}
              className={`border-t border-slate-100 dark:border-slate-800 ${onPick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}`}
              onClick={() => onPick?.(r.endpoint)}
              title={r.statuses ? Object.entries(r.statuses).map(([s, n]) => `${s}: ${n}`).join(' · ') : undefined}
            >
              <td className="px-2 py-1.5 font-mono text-xs whitespace-nowrap">
                {r.method ? <span className="mr-1 text-slate-400">{r.method}</span> : null}
                {r.endpoint}
              </td>
              <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">{f.num(r.requests)}</td>
              <td className={`px-2 py-1.5 text-right tabular-nums ${r.errors ? 'font-semibold text-red-600' : 'text-slate-400'}`}>{f.num(r.errors)}</td>
              <td className={`px-2 py-1.5 text-right tabular-nums ${r.retries ? 'text-amber-600' : 'text-slate-400'}`}>{f.num(r.retries)}</td>
              <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">{f.ms(r.p50)}</td>
              <td className="w-40 min-w-32 px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                    <div className={`h-full rounded ${r.p95 > 10_000 ? 'bg-red-500' : r.p95 > 3_000 ? 'bg-amber-400' : 'bg-green-500'}`} style={{ width: `${(r.p95 / maxP95) * 100}%` }} />
                  </div>
                  <span className="w-16 text-right text-xs whitespace-nowrap tabular-nums">{f.ms(r.p95)}</span>
                </div>
              </td>
              <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums text-slate-500">{f.ms(r.max)}</td>
              <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums text-slate-500">{f.bytes(r.bytes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ApiTab({ params }: { params: URLSearchParams }) {
  const { t } = useI18n()
  const f = useFormat()
  const [preset, setPreset] = useState<Preset>(params.get('syncId') ? 'all' : '24h')
  const [syncId, setSyncId] = useState(params.get('syncId') ?? '')
  const [outcome, setOutcome] = useState(params.get('outcome') ?? '')
  const [endpoint, setEndpoint] = useState('')
  const [instance, setInstance] = useState('')
  const [slowMs, setSlowMs] = useState('')
  const [offset, setOffset] = useState(0)
  const [live, setLive] = useState(false)
  const [open, setOpen] = useState<number | null>(null)

  const range = qs({}, preset)
  const stats = useQuery({ queryKey: ['audit', 'api-stats', range], queryFn: () => api<Stats>(`/admin/audit/api-stats?${range}`), refetchInterval: live ? 5000 : false })
  const filter = qs({ syncId, outcome, endpoint, instance, slowMs }, preset)
  const calls = useQuery({
    queryKey: ['audit', 'api-calls', filter, offset],
    queryFn: () => api<Page<CallRow>>(`/admin/audit/api-calls?${filter}&limit=${LIMIT}&offset=${offset}`),
    placeholderData: keepPreviousData,
    refetchInterval: live ? 5000 : false,
  })
  const set = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v)
    setOffset(0)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PresetSelect value={preset} onChange={set(setPreset)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> {t('audit.live')}
        </label>
        <span className="ml-auto flex flex-wrap gap-1">
          {stats.data?.statuses.map((s) => (
            <button key={s.status} className="flex items-center gap-1" onClick={() => set(setOutcome)(s.status === 'network' ? 'network' : Number(s.status) >= 400 ? 'http_error' : 'ok')}>
              <StatusBadge status={s.status === 'network' ? null : Number(s.status)} outcome={s.status === 'network' ? 'network' : undefined} />
              <span className="text-xs tabular-nums text-slate-500">{f.num(s.n)}</span>
            </button>
          ))}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <section className="card lg:col-span-1">
          <h2 className="mb-2 text-sm font-semibold">{t('audit.instances')}</h2>
          {stats.data?.instances.length ? (
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {stats.data.instances.map((i) => (
                <li key={i.instance}>
                  <button className={`w-full py-2 text-left ${instance === i.instance ? 'text-brand' : ''}`} onClick={() => set(setInstance)(instance === i.instance ? '' : i.instance)}>
                    <div className="truncate font-medium">{host(i.instance)}</div>
                    <div className="flex gap-3 text-xs text-slate-500 tabular-nums">
                      <span>
                        {f.num(i.requests)} {t('audit.calls')}
                      </span>
                      <span className={i.errors ? 'text-red-600' : ''}>
                        {f.num(i.errors)} {t('audit.errors')}
                      </span>
                      <span>p95 {f.ms(i.p95)}</span>
                      <span>{f.bytes(i.bytes)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty loading={stats.isLoading} />
          )}
        </section>
        <section className="card lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold">{t('audit.endpoints')}</h2>
          {stats.data?.endpoints.length ? <EndpointTable rows={stats.data.endpoints} onPick={set(setEndpoint)} /> : <Empty loading={stats.isLoading} />}
        </section>
      </div>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-sm font-semibold">{t('audit.callLog')}</h2>
          <Select className="input w-auto" aria-label={t('audit.outcome')} value={outcome} onChange={(e) => set(setOutcome)(e.target.value)}>
            <option value="">{t('audit.allOutcomes')}</option>
            <option value="ok">{t('audit.outcome.ok')}</option>
            <option value="http_error">{t('audit.outcome.http_error')}</option>
            <option value="network">{t('audit.outcome.network')}</option>
          </Select>
          <Select className="input w-auto" aria-label={t('audit.slow')} value={slowMs} onChange={(e) => set(setSlowMs)(e.target.value)}>
            <option value="">{t('audit.anyLatency')}</option>
            {[1000, 5000, 10_000, 30_000].map((ms) => (
              <option key={ms} value={ms}>
                ≥ {f.ms(ms)}
              </option>
            ))}
          </Select>
          {[
            [syncId, setSyncId, `Sync ${syncId.slice(0, 8)}`],
            [endpoint, setEndpoint, endpoint],
            [instance, setInstance, host(instance)],
          ].map(([v, fn, text]) =>
            v ? (
              <button key={String(text)} className="rounded-full bg-brand/10 px-3 py-1 text-xs text-brand" onClick={() => set(fn as (v: string) => void)('')}>
                {String(text)} ✕
              </button>
            ) : null,
          )}
          <span className="ml-auto">
            <ExportButtons kind="api-calls" query={filter} />
          </span>
        </div>

        {calls.data?.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>{t('audit.when')}</Th>
                  <Th>{t('audit.status')}</Th>
                  <Th>{t('audit.endpoint')}</Th>
                  <Th>{t('audit.instance')}</Th>
                  <Th right>{t('audit.latency')}</Th>
                  <Th right>{t('audit.volume')}</Th>
                  <Th>{t('audit.user')}</Th>
                </tr>
              </thead>
              <tbody>
                {calls.data.rows.map((c) => (
                  <Fragment key={c.id}>
                    <tr className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50" onClick={() => setOpen(open === c.id ? null : c.id)}>
                      <td className="px-2 py-1.5 whitespace-nowrap text-slate-500 tabular-nums">{f.dateTime(c.at)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <StatusBadge status={c.status} outcome={c.outcome} />
                        {c.retry ? <span className="ml-1 text-xs text-amber-600" title={t('audit.retry')}>↻</span> : null}
                      </td>
                      <td className="max-w-sm truncate px-2 py-1.5 font-mono text-xs">
                        <span className="text-slate-400">{c.method}</span> {c.endpoint}
                        {c.error ? <div className="truncate text-red-600">{c.error}</div> : null}
                      </td>
                      <td className="px-2 py-1.5 text-xs whitespace-nowrap text-slate-500">{host(c.instance)}</td>
                      <td className={`px-2 py-1.5 text-right whitespace-nowrap tabular-nums ${c.ms > 10_000 ? 'font-semibold text-red-600' : c.ms > 3_000 ? 'text-amber-600' : ''}`}>{f.ms(c.ms)}</td>
                      <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums text-slate-500">{f.bytes(c.bytes)}</td>
                      <td className="px-2 py-1.5 text-xs whitespace-nowrap text-slate-500">{c.email ?? '—'}</td>
                    </tr>
                    {open === c.id ? (
                      <tr>
                        <td colSpan={7} className="px-2 pb-3">
                          <JsonBlock value={{ method: c.method, url: `${c.instance}${c.path}`, query: c.query, status: c.status, outcome: c.outcome, ms: c.ms, bytes: c.bytes, retry: c.retry, error: c.error, syncId: c.syncId }} />
                          {c.syncId && !syncId ? (
                            <button className="mt-2 text-xs text-brand hover:underline" onClick={() => set(setSyncId)(c.syncId!)}>
                              {t('audit.sameSync')}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty loading={calls.isLoading} />
        )}
        <Pager total={calls.data?.total ?? 0} limit={LIMIT} offset={offset} onChange={setOffset} />
      </section>
    </div>
  )
}

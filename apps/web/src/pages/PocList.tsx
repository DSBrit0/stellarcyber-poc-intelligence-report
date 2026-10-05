import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { api } from '../lib/api'
import { errorKey } from '../lib/errors'
import { useMe } from '../lib/auth'
import { useI18n } from '../lib/i18n'

interface PocRow {
  id: string
  ownerId: string
  ownerName: string | null
  linkedCustomer: string | null
  reports: number
  /** A Sync is queued or running: the PoC cannot be deleted until it ends or is cancelled. */
  syncing: boolean
  draft: boolean
  /** Started as a PoC Notebook; until it has a Report target it has no Tenant or period. */
  notebook: boolean
  startDate: string | null
  customerName: string
  tenantName: string
  periodStart: string | null
  periodEnd: string | null
  updatedAt: string
}

export function PocListPage() {
  const { t, locale } = useI18n()
  const { data: me } = useMe()
  const [params, setParams] = useSearchParams()
  const isAdmin = me?.role === 'admin'
  // Admins see every PoC; the filter narrows to their own or one Owner's.
  const owner = isAdmin ? (params.get('owner') ?? '') : ''
  const { data = [], isLoading } = useQuery({ queryKey: ['pocs', owner], queryFn: () => api<PocRow[]>(`/pocs${owner ? `?owner=${owner}` : ''}`) })
  const all = useQuery({ queryKey: ['pocs', ''], queryFn: () => api<PocRow[]>('/pocs'), enabled: isAdmin })
  const ownerName = owner && owner !== 'me' ? (all.data ?? []).find((p) => p.ownerId === owner)?.ownerName : null
  // The heading follows the Owner filter: an Admin's unfiltered list holds everyone's PoCs.
  const heading = !isAdmin || owner === 'me' || owner === me?.id ? t('poc.list') : owner ? t('poc.listOf', { name: ownerName ?? '—' }) : t('poc.listAll')
  const owners = [...new Map((all.data ?? []).map((p) => [p.ownerId, p.ownerName ?? '—'])).entries()].sort((a, b) => a[1].localeCompare(b[1]))
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{heading}</h1>
        {isAdmin ? (
          <select
            className="input mr-auto w-auto"
            aria-label={t('poc.owner')}
            value={owner}
            onChange={(e) => setParams(e.target.value ? { owner: e.target.value } : {})}
          >
            <option value="">{t('poc.allOwners', { n: all.data?.length ?? 0 })}</option>
            <option value="me">{t('poc.mine')}</option>
            {owners
              .filter(([id]) => id !== me?.id)
              .map(([id, name]) => (
                <option key={id} value={id}>
                  {name} ({(all.data ?? []).filter((p) => p.ownerId === id).length})
                </option>
              ))}
          </select>
        ) : null}
        {me?.role !== 'customer' ? (
          <Link to="/pocs/new" className="btn">
            {t('poc.create')}
          </Link>
        ) : null}
      </div>
      {!isLoading && data.length === 0 ? <p className="text-slate-500">{t('poc.empty')}</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((p) => (
          <li key={p.id} className="relative">
            {me && (me.role === 'admin' || me.id === p.ownerId) ? <DeletePoc id={p.id} name={p.customerName} syncing={p.syncing} /> : null}
            <Link to={`/pocs/${p.id}`} className="card block h-full pr-12 hover:border-brand">
              <div className="flex flex-wrap items-center gap-2 font-semibold">
                {p.customerName}
                {p.notebook ? (
                  p.reports > 0 ? (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-green-800 dark:bg-green-950 dark:text-green-300">{t('poc.phase.report')}</span>
                  ) : (
                    <span className="rounded bg-violet-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-violet-800 dark:bg-violet-950 dark:text-violet-300">{t('poc.phase.notebook')}</span>
                  )
                ) : null}
                {p.draft ? <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-amber-800 dark:bg-amber-950 dark:text-amber-300">{t('poc.draft')}</span> : null}
                {p.syncing ? (
                  <span className="inline-flex items-center gap-1.5 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />
                    {t('poc.syncing')}
                  </span>
                ) : null}
              </div>
              <div className="text-sm text-slate-500">{p.tenantName}</div>
              <div className="mt-2 text-xs text-slate-500">
                {[
                  p.periodStart ? `${p.periodStart} → ${p.periodEnd}` : null,
                  !p.periodStart && p.startDate ? t('poc.startsOn', { date: new Date(`${p.startDate}T12:00:00`).toLocaleDateString(locale) }) : null,
                  t('poc.reportsCount', { n: p.reports }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              {isAdmin || p.linkedCustomer ? (
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-400">
                  {isAdmin ? <span>{t('poc.ownerIs', { name: p.ownerName ?? '—' })}</span> : null}
                  {p.linkedCustomer ? <span>{t('poc.customerIs', { name: p.linkedCustomer })}</span> : null}
                </div>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Trash icon in the corner of a PoC card: permanent deletion of the PoC and everything it holds. */
function DeletePoc({ id, name, syncing }: { id: string; name: string; syncing: boolean }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const del = useMutation({
    mutationFn: () => api(`/pocs/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['pocs'] }),
    onError: (err) => {
      window.alert(t(errorKey(err, { sync_in_progress: 'poc.deleteBlocked' })))
      void qc.invalidateQueries({ queryKey: ['pocs'] })
    },
  })
  return (
    <button
      className="absolute top-3 right-3 z-10 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
      title={syncing ? t('poc.deleteBlocked') : `${t('poc.delete')}: ${name}`}
      aria-label={`${t('poc.delete')}: ${name}`}
      disabled={del.isPending || syncing}
      onClick={() => window.confirm(t('poc.deleteConfirm')) && del.mutate()}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
      </svg>
    </button>
  )
}

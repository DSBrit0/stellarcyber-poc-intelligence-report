import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api } from '../lib/api'
import { useMe } from '../lib/auth'
import { useI18n } from '../lib/i18n'

interface PocRow {
  id: string
  ownerId: string
  customerName: string
  tenantName: string
  periodStart: string
  periodEnd: string
  updatedAt: string
}

export function PocListPage() {
  const { t } = useI18n()
  const { data: me } = useMe()
  const { data = [], isLoading } = useQuery({ queryKey: ['pocs'], queryFn: () => api<PocRow[]>('/pocs') })
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('poc.list')}</h1>
        {me?.role !== 'customer' ? (
          <Link to="/pocs/new" className="btn">
            {t('poc.new')}
          </Link>
        ) : null}
      </div>
      {!isLoading && data.length === 0 ? <p className="text-slate-500">{t('poc.empty')}</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((p) => (
          <li key={p.id} className="relative">
            {me && (me.role === 'admin' || me.id === p.ownerId) ? <DeletePoc id={p.id} name={p.customerName} /> : null}
            <Link to={`/pocs/${p.id}`} className="card block pr-12 hover:border-brand">
              <div className="font-semibold">{p.customerName}</div>
              <div className="text-sm text-slate-500">{p.tenantName}</div>
              <div className="mt-2 text-xs text-slate-500">
                {p.periodStart} → {p.periodEnd}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Trash icon in the corner of a PoC card: permanent deletion of the PoC and everything it holds. */
function DeletePoc({ id, name }: { id: string; name: string }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const del = useMutation({
    mutationFn: () => api(`/pocs/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['pocs'] }),
  })
  return (
    <button
      className="absolute top-3 right-3 z-10 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
      title={`${t('poc.delete')}: ${name}`}
      aria-label={`${t('poc.delete')}: ${name}`}
      disabled={del.isPending}
      onClick={() => window.confirm(t('poc.deleteConfirm')) && del.mutate()}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
      </svg>
    </button>
  )
}

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api } from '../lib/api'
import { useMe } from '../lib/auth'
import { useI18n } from '../lib/i18n'

interface PocRow {
  id: string
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
          <li key={p.id}>
            <Link to={`/pocs/${p.id}`} className="card block hover:border-brand">
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

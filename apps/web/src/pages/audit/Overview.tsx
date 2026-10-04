import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { Go } from '../Audit'
import { Empty, HourlyBars, Kpi, useFormat } from './common'

interface Summary {
  counts: Record<
    | 'logins24h'
    | 'failedLogins24h'
    | 'failedLogins7d'
    | 'activeUsers7d'
    | 'pendingUsers'
    | 'syncs7d'
    | 'syncsFailed7d'
    | 'syncsRunning'
    | 'avgSyncSeconds7d'
    | 'apiCalls24h'
    | 'apiErrors24h'
    | 'apiP95Ms24h'
    | 'errors24h'
    | 'warnings24h',
    number
  >
  hourly: { hour: string; calls: number; callErrors: number; errors: number; warnings: number; events: number }[]
  recentFailures: { at: string; ip: string | null; email: string | null; meta: { email?: string } | null }[]
  recentErrors: { id: number; at: string; source: string; category: string; message: string }[]
  topUsers: { id: string; email: string; name: string; role: string; events: number; lastAt: string }[]
}

export function OverviewTab({ go }: { go: Go }) {
  const { t } = useI18n()
  const f = useFormat()
  const q = useQuery({ queryKey: ['audit', 'summary'], queryFn: () => api<Summary>('/admin/audit/summary'), refetchInterval: 30_000 })
  if (!q.data) return <Empty loading={q.isLoading} />
  const { counts: c, hourly, recentFailures, recentErrors, topUsers } = q.data
  const errorRate = c.apiCalls24h ? (c.apiErrors24h / c.apiCalls24h) * 100 : 0

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={t('audit.kpi.logins')} value={f.num(c.logins24h)} hint={t('audit.last24h')} />
        <Kpi label={t('audit.kpi.failedLogins')} value={f.num(c.failedLogins24h)} hint={t('audit.kpi.failed7d', { n: c.failedLogins7d })} tone={c.failedLogins24h ? 'warn' : 'default'} />
        <Kpi label={t('audit.kpi.activeUsers')} value={f.num(c.activeUsers7d)} hint={t('audit.kpi.pending', { n: c.pendingUsers })} />
        <Kpi label={t('audit.kpi.syncs')} value={f.num(c.syncs7d)} hint={t('audit.kpi.syncsHint', { failed: c.syncsFailed7d, running: c.syncsRunning })} tone={c.syncsFailed7d ? 'warn' : 'default'} />
        <Kpi label={t('audit.kpi.avgSync')} value={f.duration(c.avgSyncSeconds7d)} hint={t('audit.last7d')} />
        <Kpi label={t('audit.kpi.apiCalls')} value={f.num(c.apiCalls24h)} hint={t('audit.kpi.p95', { ms: f.ms(c.apiP95Ms24h) })} />
        <Kpi
          label={t('audit.kpi.apiErrors')}
          value={f.num(c.apiErrors24h)}
          hint={t('audit.kpi.errorRate', { p: errorRate.toFixed(1) })}
          tone={errorRate > 5 ? 'bad' : c.apiErrors24h ? 'warn' : 'good'}
        />
        <Kpi label={t('audit.kpi.appErrors')} value={f.num(c.errors24h)} hint={t('audit.kpi.warnings', { n: c.warnings24h })} tone={c.errors24h ? 'bad' : 'good'} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">{t('audit.chart.api')}</h2>
          <HourlyBars
            data={hourly}
            series={[
              { key: 'callErrors', color: 'bg-red-500', label: t('audit.errors') },
              { key: 'calls', color: 'bg-brand/70', label: t('audit.calls') },
            ]}
          />
        </section>
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">{t('audit.chart.logs')}</h2>
          <HourlyBars
            data={hourly}
            series={[
              { key: 'errors', color: 'bg-red-500', label: 'error' },
              { key: 'warnings', color: 'bg-amber-400', label: 'warn' },
              { key: 'events', color: 'bg-slate-400', label: t('audit.events') },
            ]}
          />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <section className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t('audit.recentFailures')}</h2>
            <button className="text-xs text-brand hover:underline" onClick={() => go('activity', { action: 'auth.login_failed' })}>
              {t('audit.seeAll')}
            </button>
          </div>
          {recentFailures.length ? (
            <ul className="space-y-2 text-sm">
              {recentFailures.map((r, i) => (
                <li key={i}>
                  <div className="truncate" title={r.email ?? r.meta?.email ?? undefined}>
                    {r.email ?? r.meta?.email ?? '—'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {r.ip} · {f.dateTime(r.at)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">{t('audit.none')}</p>
          )}
        </section>
        <section className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t('audit.recentErrors')}</h2>
            <button className="text-xs text-brand hover:underline" onClick={() => go('logs', { level: 'error' })}>
              {t('audit.seeAll')}
            </button>
          </div>
          {recentErrors.length ? (
            <ul className="space-y-2 text-sm">
              {recentErrors.map((r) => (
                <li key={r.id}>
                  <div className="truncate font-mono text-xs text-red-600 dark:text-red-400" title={r.message}>
                    {r.message}
                  </div>
                  <div className="text-xs text-slate-500">
                    {r.source}/{r.category} · {f.dateTime(r.at)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">{t('audit.none')}</p>
          )}
        </section>
        <section className="card">
          <h2 className="mb-2 text-sm font-semibold">{t('audit.topUsers')}</h2>
          {topUsers.length ? (
            <ul className="space-y-2 text-sm">
              {topUsers.map((u) => (
                <li key={u.id}>
                  <button className="flex w-full justify-between gap-2 text-left hover:text-brand" onClick={() => go('activity', { userId: u.id })}>
                    <span className="truncate">
                      {u.name} <span className="text-xs text-slate-400">{t(`role.${u.role}` as never)}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-500">{f.num(u.events)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">{t('audit.none')}</p>
          )}
        </section>
      </div>
    </div>
  )
}

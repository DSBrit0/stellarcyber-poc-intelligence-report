import type { MessageKey } from '@poc-intel/shared/i18n'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Fragment, useState } from 'react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { Empty, ExportButtons, JsonBlock, Pager, PresetSelect, Th, qs, useFormat, type Page, type Preset } from './common'

interface EventRow {
  id: number
  at: string
  action: string
  target: string | null
  ip: string | null
  meta: Record<string, unknown> | null
  userId: string | null
  email: string | null
  name: string | null
  role: string | null
}
interface UserOption {
  id: string
  email: string
  name: string
}

const LIMIT = 50
const GROUP_STYLE: Record<string, string> = {
  auth: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  admin: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  poc: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  sync: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  report: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  customer: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  retention: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}
const DANGER = new Set(['auth.login_failed', 'admin.user_disabled', 'admin.user_rejected', 'poc.deleted', 'report.deleted', 'admin.mfa_reset'])

export function useActionLabel() {
  const { t } = useI18n()
  return (action: string) => {
    const key = `audit.action.${action}` as MessageKey
    const label = t(key)
    return label === key ? action : label
  }
}

export function ActionBadge({ action }: { action: string }) {
  const label = useActionLabel()
  const group = action.split('.')[0] ?? ''
  const cls = DANGER.has(action) ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : (GROUP_STYLE[group] ?? GROUP_STYLE.retention)
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`} title={action}>
      {label(action)}
    </span>
  )
}

/** One line summary of the details an event carries. */
function metaSummary(meta: Record<string, unknown> | null): string {
  if (!meta) return ''
  return Object.entries(meta)
    .filter(([, v]) => v != null && typeof v !== 'object')
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(' · ')
}

export function ActivityTab({ params }: { params: URLSearchParams }) {
  const { t } = useI18n()
  const f = useFormat()
  const label = useActionLabel()
  const [userId, setUserId] = useState(params.get('userId') ?? '')
  const [action, setAction] = useState(params.get('action') ?? '')
  const [q, setQ] = useState('')
  const [preset, setPreset] = useState<Preset>('7d')
  const [offset, setOffset] = useState(0)
  const [open, setOpen] = useState<number | null>(null)

  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: () => api<UserOption[]>('/admin/users') })
  const actions = useQuery({ queryKey: ['audit', 'actions'], queryFn: () => api<string[]>('/admin/audit/actions') })
  const filter = qs({ userId, action, q: q.trim() }, preset)
  const events = useQuery({
    queryKey: ['audit', 'events', filter, offset],
    queryFn: () => api<Page<EventRow>>(`/admin/audit/events?${filter}&limit=${LIMIT}&offset=${offset}`),
    placeholderData: keepPreviousData,
  })
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setOffset(0)
  }
  const groups = [...new Set((actions.data ?? []).map((a) => a.split('.')[0]))]

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto max-w-full" aria-label={t('audit.user')} value={userId} onChange={(e) => reset(setUserId)(e.target.value)}>
          <option value="">{t('audit.allUsers')}</option>
          {users.data?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {u.email}
            </option>
          ))}
        </select>
        <select className="input w-auto max-w-full" aria-label={t('audit.action')} value={action} onChange={(e) => reset(setAction)(e.target.value)}>
          <option value="">{t('audit.allActions')}</option>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              <option value={`${g}.`}>{t('audit.allOf', { group: g ?? '' })}</option>
              {actions.data
                ?.filter((a) => a.startsWith(`${g}.`))
                .map((a) => (
                  <option key={a} value={a}>
                    {label(a)}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <PresetSelect value={preset} onChange={reset(setPreset)} />
        <input className="input min-w-40 flex-1" placeholder={t('audit.searchEvents')} value={q} onChange={(e) => reset(setQ)(e.target.value)} />
        <ExportButtons kind="events" query={filter} />
      </div>

      {events.data?.rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>{t('audit.when')}</Th>
                <Th>{t('audit.user')}</Th>
                <Th>{t('audit.action')}</Th>
                <Th>{t('audit.details')}</Th>
                <Th>IP</Th>
              </tr>
            </thead>
            <tbody>
              {events.data.rows.map((e) => (
                <Fragment key={e.id}>
                  <tr className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50" onClick={() => setOpen(open === e.id ? null : e.id)}>
                    <td className="px-2 py-2 whitespace-nowrap text-slate-500 tabular-nums">{f.dateTime(e.at)}</td>
                    <td className="px-2 py-2">
                      {e.email ? (
                        <>
                          <div className="font-medium">{e.name}</div>
                          <div className="text-xs text-slate-500">{e.email}</div>
                        </>
                      ) : (
                        <span className="text-slate-400">{String(e.meta?.email ?? t('audit.system'))}</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <ActionBadge action={e.action} />
                    </td>
                    <td className="max-w-md truncate px-2 py-2 text-xs text-slate-500">{metaSummary(e.meta) || e.target || ''}</td>
                    <td className="px-2 py-2 font-mono text-xs whitespace-nowrap text-slate-500">{e.ip ?? '—'}</td>
                  </tr>
                  {open === e.id ? (
                    <tr>
                      <td colSpan={5} className="px-2 pb-3">
                        <JsonBlock value={{ action: e.action, target: e.target, userId: e.userId, role: e.role, ip: e.ip, meta: e.meta }} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty loading={events.isLoading} />
      )}
      <Pager total={events.data?.total ?? 0} limit={LIMIT} offset={offset} onChange={setOffset} />
    </section>
  )
}

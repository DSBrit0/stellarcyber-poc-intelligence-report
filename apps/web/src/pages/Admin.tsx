import { ROLES, type Role } from '@poc-intel/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../lib/api'
import { useI18n } from '../lib/i18n'

interface UserRow {
  id: string
  email: string
  name: string
  company: string
  role: Role
  status: string
  mfaEnabled: boolean
  mfaExempt: boolean
  createdAt: string
  customers: number
  pocs: number
}

interface Settings {
  retentionDays: number
  registrationAllowedDomains: string[]
}

export function AdminPage() {
  const { t } = useI18n()
  const qc = useQueryClient()
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: () => api<UserRow[]>('/admin/users') })
  const settings = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api<Settings>('/admin/settings') })
  const [roles, setRoles] = useState<Record<string, Role>>({})
  const [resetUrl, setResetUrl] = useState<string | null>(null)

  const act = useMutation({
    mutationFn: ({ path, body, method = 'POST' }: { path: string; body?: unknown; method?: string }) => api(path, { method, body: body ?? {} }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  const saveSettings = useMutation({
    mutationFn: (s: Settings) => api<Settings>('/admin/settings', { method: 'PUT', body: s }),
    onSuccess: (s) => qc.setQueryData(['admin', 'settings'], s),
  })

  const pending = users.data?.filter((u) => u.status === 'pending') ?? []
  const others = users.data?.filter((u) => u.status !== 'pending') ?? []

  return (
    <div className="space-y-6">
      <section className="card space-y-3">
        <h2 className="font-semibold">{t('admin.pending')}</h2>
        {pending.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">{u.name}</span>
            <span className="text-slate-500">
              {u.email}
              {u.company ? ` · ${u.company}` : ''}
            </span>
            <select className="input ml-auto w-auto" value={roles[u.id] ?? 'partner'} onChange={(e) => setRoles((r) => ({ ...r, [u.id]: e.target.value as Role }))}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`role.${r}`)}
                </option>
              ))}
            </select>
            <button className="btn" onClick={() => act.mutate({ path: `/admin/users/${u.id}/approve`, body: { role: roles[u.id] ?? 'partner' } })}>
              {t('admin.approve')}
            </button>
            <button className="btn-ghost" onClick={() => act.mutate({ path: `/admin/users/${u.id}/reject` })}>
              {t('admin.reject')}
            </button>
          </div>
        ))}
      </section>

      <section className="card space-y-3 overflow-x-auto">
        <h2 className="font-semibold">{t('admin.users')}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
              <th className="py-2 font-medium">{t('auth.name')}</th>
              <th className="font-medium">{t('auth.email')}</th>
              <th className="font-medium">{t('admin.role')}</th>
              <th className="font-medium">{t('admin.status')}</th>
              <th className="text-right font-medium">{t('nav.customers')}</th>
              <th className="text-right font-medium">PoCs</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {others.map((u) => (
              <tr key={u.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-2">{u.name}</td>
                <td className="text-slate-500">{u.email}</td>
                <td>
                  <select
                    className="input w-auto py-1"
                    aria-label={t('admin.role')}
                    value={u.role}
                    onChange={(e) => act.mutate({ path: `/admin/users/${u.id}`, method: 'PATCH', body: { role: e.target.value } })}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t(`role.${r}`)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{u.status}</td>
                <td className="text-right tabular-nums">{u.role === 'customer' ? '—' : u.customers}</td>
                <td className="text-right tabular-nums">
                  {u.role === 'customer' ? (
                    '—'
                  ) : (
                    <Link className="text-brand hover:underline" to={`/?owner=${u.id}`}>
                      {u.pocs}
                    </Link>
                  )}
                </td>
                <td className="space-x-2 text-right whitespace-nowrap">
                  <label className="inline-flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={u.mfaExempt}
                      onChange={(e) => act.mutate({ path: `/admin/users/${u.id}`, method: 'PATCH', body: { mfaExempt: e.target.checked } })}
                    />
                    {t('admin.mfaExempt')}
                  </label>
                  <button className="btn-ghost" onClick={() => act.mutate({ path: `/admin/users/${u.id}/reset-mfa` })}>
                    MFA reset
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={async () => setResetUrl((await api<{ url: string }>(`/admin/users/${u.id}/password-reset`, { method: 'POST', body: {} })).url)}
                  >
                    Password link
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {resetUrl ? <p className="rounded bg-amber-50 p-3 text-xs break-all text-amber-900">{resetUrl}</p> : null}
      </section>

      {settings.data ? <SettingsForm initial={settings.data} onSave={(s) => saveSettings.mutate(s)} saving={saveSettings.isPending} /> : null}
    </div>
  )
}

function SettingsForm({ initial, onSave, saving }: { initial: Settings; onSave: (s: Settings) => void; saving: boolean }) {
  const { t } = useI18n()
  const [days, setDays] = useState(String(initial.retentionDays))
  const [domains, setDomains] = useState(initial.registrationAllowedDomains.join(', '))
  return (
    <form
      className="card space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSave({
          retentionDays: Number(days),
          registrationAllowedDomains: domains.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean),
        })
      }}
    >
      <h2 className="font-semibold">{t('admin.settings')}</h2>
      <label className="block max-w-xs">
        <span className="label">{t('admin.retentionDays')}</span>
        <input className="input" type="number" min={1} max={3650} required value={days} onChange={(e) => setDays(e.target.value)} />
      </label>
      <label className="block">
        <span className="label">{t('admin.allowedDomains')}</span>
        <input className="input" placeholder="stellarcyber.ai, partner.com" value={domains} onChange={(e) => setDomains(e.target.value)} />
      </label>
      <button className="btn" disabled={saving}>
        {t('common.save')}
      </button>
    </form>
  )
}

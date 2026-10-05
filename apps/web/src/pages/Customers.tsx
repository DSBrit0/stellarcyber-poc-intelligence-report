import { COMPANY_PROFILES, type CompanyProfile } from '@poc-intel/shared'
import type { MessageKey } from '@poc-intel/shared/i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { useCustomers, type CustomerRow } from '../lib/CustomerSelect'
import { errorKey } from '../lib/errors'
import { DeleteCompanyButton, DeleteUserButton } from '../lib/DeleteAccount'
import { useMe } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { Select } from '../lib/Select'
import { useDialogs } from '../lib/dialogs'

const USER_STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  active: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  disabled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

interface CustomerUser {
  id: string
  name: string
  email: string
  status: string
  customerName: string
  profile: CompanyProfile
  createdAt: string
}

const PROFILE_STYLE: Record<CompanyProfile, string> = {
  customer: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  partner: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
}

export function CustomersPage() {
  const { t, locale } = useI18n()
  const { confirm } = useDialogs()
  const { data: me } = useMe()
  // Deleting accounts and Companies: Admins, and Sales Engineers for the Companies they registered.
  const canDelete = me?.role === 'admin' || me?.role === 'sales_engineer'
  const qc = useQueryClient()
  const customers = useCustomers()
  const people = useQuery({ queryKey: ['customer-users'], queryFn: () => api<CustomerUser[]>('/customers/users') })
  const [name, setName] = useState('')
  const [profile, setProfile] = useState<CompanyProfile>('customer')
  const [filter, setFilter] = useState<CompanyProfile | ''>('')
  const [shownKey, setShownKey] = useState<{ customer: string; key: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['customers'] })
    void qc.invalidateQueries({ queryKey: ['customer-users'] })
  }
  const create = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const c = await api<{ name: string; accessKey: string }>('/customers', { method: 'POST', body: { name, profile } })
      setShownKey({ customer: c.name, key: c.accessKey })
      setName('')
      refresh()
    } catch (err) {
      setError(t(errorKey(err)))
    }
  }
  const rotate = async (id: string, customer: string) => {
    const r = await api<{ accessKey: string }>(`/customers/${id}/access-key`, { method: 'POST', body: {} })
    setShownKey({ customer, key: r.accessKey })
  }
  const changeProfile = async (c: CustomerRow, next: CompanyProfile) => {
    if (!(await confirm(t('customers.profileConfirm', { name: c.name, profile: t(`customers.profile.${next}`) })))) return
    setError(null)
    try {
      await api(`/customers/${c.id}`, { method: 'PATCH', body: { profile: next } })
      refresh()
    } catch (err) {
      setError(t(errorKey(err)))
    }
  }
  const rows = (customers.data ?? []).filter((c) => !filter || c.profile === filter)
  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' | 'disable' }) => api(`/customers/users/${id}/${action}`, { method: 'POST', body: {} }),
    onSuccess: refresh,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('customers.title')}</h1>
        <p className="max-w-3xl text-sm text-slate-500">{t('customers.help')}</p>
      </div>

      <form className="card flex flex-wrap items-end gap-3" onSubmit={create}>
        <label className="block min-w-56 flex-1">
          <span className="label">{t('customers.name')}</span>
          <input className="input" required minLength={2} maxLength={160} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block w-40">
          <span className="label">{t('customers.profile')}</span>
          <Select className="input" value={profile} onChange={(e) => setProfile(e.target.value as CompanyProfile)}>
            {COMPANY_PROFILES.map((p) => (
              <option key={p} value={p}>
                {t(`customers.profile.${p}`)}
              </option>
            ))}
          </Select>
        </label>
        <button className="btn whitespace-nowrap">{t('customers.new')}</button>
        {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
      </form>

      {shownKey ? (
        <div className="card border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <p className="text-sm">
            <b>{shownKey.customer}</b> — {t('customers.keyOnce')}
          </p>
          <p className="mt-2 font-mono text-2xl tracking-widest select-all">{shownKey.key}</p>
        </div>
      ) : null}

      <section className="card overflow-x-auto">
        <div className="mb-2 flex justify-end">
          <Select className="input w-auto py-1 text-sm" aria-label={t('customers.profile')} value={filter} onChange={(e) => setFilter(e.target.value as CompanyProfile | '')}>
            <option value="">{t('customers.filterAll')}</option>
            {COMPANY_PROFILES.map((p) => (
              <option key={p} value={p}>
                {t(`customers.profile.${p}`)}
              </option>
            ))}
          </Select>
        </div>
        <table className="w-full text-sm [&_td]:px-2 [&_td:first-child]:pl-0 [&_th]:px-2 [&_th:first-child]:pl-0">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-2">{t('customers.name')}</th>
              <th>{t('customers.profile')}</th>
              <th>{t('customers.pocs')}</th>
              <th>{t('customers.users')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-2 font-medium">
                  {c.name}
                  {c.manageable ? null : <span className="block text-xs font-normal text-slate-500">{t('customers.registeredBy', { name: c.ownerName })}</span>}
                  {/* On narrow screens the key button sits under the name instead of a fifth column. */}
                  {c.manageable ? (
                    <div className="mt-1 sm:hidden">
                      <button className="btn-ghost px-2 py-1 text-xs font-normal whitespace-nowrap" onClick={() => void rotate(c.id, c.name)}>
                        {t('customers.rotate')}
                      </button>
                    </div>
                  ) : null}
                </td>
                <td>
                  {c.manageable ? (
                    <Select
                      className={`rounded border-0 px-2 py-0.5 text-xs ${PROFILE_STYLE[c.profile]}`}
                      aria-label={t('customers.profile')}
                      value={c.profile}
                      onChange={(e) => void changeProfile(c, e.target.value as CompanyProfile)}
                    >
                      {COMPANY_PROFILES.map((p) => (
                        <option key={p} value={p}>
                          {t(`customers.profile.${p}`)}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <span className={`rounded px-2 text-xs ${PROFILE_STYLE[c.profile]}`}>{t(`customers.profile.${c.profile}`)}</span>
                  )}
                </td>
                <td>{c.pocs}</td>
                <td>
                  {c.users}
                  {c.pending ? (
                    <span className="mt-0.5 block w-fit rounded bg-amber-100 px-2 text-xs whitespace-nowrap text-amber-800 sm:mt-0 sm:ml-2 sm:inline dark:bg-amber-950 dark:text-amber-300">
                      {c.pending} {t('customers.pending')}
                    </span>
                  ) : null}
                </td>
                <td className="pr-0 text-right">
                  {c.manageable ? (
                    <span className="inline-flex items-center gap-1">
                      <button className="btn-ghost hidden whitespace-nowrap sm:inline-flex" onClick={() => void rotate(c.id, c.name)}>
                        {t('customers.rotate')}
                      </button>
                      {canDelete ? <DeleteCompanyButton companyId={c.id} name={c.name} /> : null}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">{t('customers.users')}</h2>
        {(people.data ?? []).map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 border-t border-slate-200 py-2 text-sm first:border-0 dark:border-slate-800">
            <span className="font-medium">{u.name}</span>
            {/* The separator stays with the e-mail, so a wrapped line never starts with "·". */}
            <span className="text-slate-500">
              {[u.email, u.customerName].filter(Boolean).join(' · ')}
            </span>
            <span className={`rounded px-2 text-xs ${PROFILE_STYLE[u.profile]}`}>{t(`customers.profile.${u.profile}`)}</span>
            <span className="text-xs text-slate-400">{new Date(u.createdAt).toLocaleDateString(locale)}</span>
            <span className={`rounded px-2 text-xs whitespace-nowrap ${USER_STATUS_STYLE[u.status] ?? USER_STATUS_STYLE.disabled}`}>{t(`user.status.${u.status}` as MessageKey)}</span>
            <span className="ml-auto flex gap-2">
              {u.status !== 'active' ? (
                <button className="btn" onClick={() => decide.mutate({ id: u.id, action: 'approve' })}>
                  {t('admin.approve')}
                </button>
              ) : null}
              {u.status === 'pending' ? (
                <button className="btn-ghost" onClick={() => decide.mutate({ id: u.id, action: 'reject' })}>
                  {t('admin.reject')}
                </button>
              ) : u.status === 'active' ? (
                <button className="btn-ghost" title={t('del.disable')} onClick={() => decide.mutate({ id: u.id, action: 'disable' })}>
                  {t('del.disable')}
                </button>
              ) : null}
              {canDelete ? <DeleteUserButton userId={u.id} label={u.name} /> : null}
            </span>
          </div>
        ))}
      </section>
    </div>
  )
}

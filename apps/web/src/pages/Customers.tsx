import type { MessageKey } from '@poc-intel/shared/i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { useCustomers } from '../lib/CustomerSelect'
import { errorKey } from '../lib/errors'
import { useI18n } from '../lib/i18n'

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
  createdAt: string
}

export function CustomersPage() {
  const { t, locale } = useI18n()
  const qc = useQueryClient()
  const customers = useCustomers()
  const people = useQuery({ queryKey: ['customer-users'], queryFn: () => api<CustomerUser[]>('/customers/users') })
  const [name, setName] = useState('')
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
      const c = await api<{ name: string; accessKey: string }>('/customers', { method: 'POST', body: { name } })
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
          <span className="label">{t('form.customerName')}</span>
          <input className="input" required minLength={2} maxLength={160} value={name} onChange={(e) => setName(e.target.value)} />
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
        <table className="w-full text-sm [&_td]:px-2 [&_td:first-child]:pl-0 [&_th]:px-2 [&_th:first-child]:pl-0">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-2">{t('form.customerName')}</th>
              <th>{t('customers.pocs')}</th>
              <th>{t('customers.users')}</th>
              <th className="hidden sm:table-cell" />
            </tr>
          </thead>
          <tbody>
            {(customers.data ?? []).map((c) => (
              <tr key={c.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-2 font-medium">
                  {c.name}
                  {/* On narrow screens the key button sits under the name instead of a fourth column. */}
                  <div className="mt-1 sm:hidden">
                    <button className="btn-ghost px-2 py-1 text-xs font-normal whitespace-nowrap" onClick={() => void rotate(c.id, c.name)}>
                      {t('customers.rotate')}
                    </button>
                  </div>
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
                <td className="hidden pr-0 text-right sm:table-cell">
                  <button className="btn-ghost whitespace-nowrap" onClick={() => void rotate(c.id, c.name)}>
                    {t('customers.rotate')}
                  </button>
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
                <button className="btn-ghost" onClick={() => decide.mutate({ id: u.id, action: 'disable' })}>
                  ✕
                </button>
              ) : null}
            </span>
          </div>
        ))}
      </section>
    </div>
  )
}

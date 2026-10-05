import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from './api'
import type { CustomerRow } from './CustomerSelect'
import { errorKey } from './errors'
import { useI18n } from './i18n'

export interface CreatedCustomer {
  id: string
  name: string
  instanceUrl: string | null
  accessKey: string
}

/** Name + Instance URL of a new Customer (Customer Profile); on success shows the Access Key once. Used by the "+" dialog. */
export function CustomerForm({ onCreated, compact }: { onCreated?: (c: CreatedCustomer) => void; compact?: boolean }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [instanceUrl, setInstanceUrl] = useState('')
  const [created, setCreated] = useState<CreatedCustomer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setBusy(true)
    setError(null)
    try {
      const c = await api<CreatedCustomer>('/customers', { method: 'POST', body: { name, instanceUrl: instanceUrl.trim() || null } })
      setCreated(c)
      setName('')
      setInstanceUrl('')
      qc.setQueryData<CustomerRow[]>(['customers'], (rows) => [...(rows ?? []), { id: c.id, name: c.name, instanceUrl: c.instanceUrl, profile: 'customer', ownerId: '', ownerName: '', manageable: true, pocs: 0, users: 0, pending: 0 }])
      void qc.invalidateQueries({ queryKey: ['customers'] })
      onCreated?.(c)
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <form className={`grid gap-3 ${compact ? '' : 'sm:grid-cols-[1fr_1fr_auto]'} items-end`} onSubmit={submit}>
        <label className="block">
          <span className="label">{t('form.customerName')}</span>
          <input className="input" required minLength={2} maxLength={160} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">{t('poc.instance')}</span>
          <input className="input" type="url" placeholder="https://cliente.stellarcyber.cloud" value={instanceUrl} onChange={(e) => setInstanceUrl(e.target.value)} />
        </label>
        <button className="btn" disabled={busy}>
          {t('customers.new')}
        </button>
      </form>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {created ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/30">
          <p className="text-sm">
            <b>{created.name}</b> — {t('customers.keyOnce')}
          </p>
          <p className="mt-1 font-mono text-xl tracking-widest select-all">{created.accessKey}</p>
        </div>
      ) : null}
    </div>
  )
}

/** The "+" dialog: same form, in the same window; closing it keeps the new Customer selected. */
export function CustomerDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (c: CreatedCustomer) => void }) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl bg-white p-0 shadow-xl backdrop:bg-slate-900/60 dark:bg-slate-900 dark:text-slate-100">
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('wiz.newCustomer')}</h2>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="text-sm text-slate-500">{t('customers.help')}</p>
        <CustomerForm compact onCreated={onCreated} />
        <div className="text-right">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.continue')}
          </button>
        </div>
      </div>
    </dialog>
  )
}

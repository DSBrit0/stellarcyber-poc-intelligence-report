import type { StellarCredential } from '@poc-intel/shared'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../lib/api'
import { CredentialFields } from '../lib/CredentialFields'
import { errorKey } from '../lib/errors'
import { useI18n } from '../lib/i18n'

interface Tenant {
  id: string
  name: string
  group: string
}

const isoDay = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10)

// One flow: credential → list Tenants → pick Tenant and period → create the PoC and start its first Sync
// with the same credential, which is then dropped.
export function PocNewPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [instanceUrl, setInstanceUrl] = useState('https://')
  const [credential, setCredential] = useState<StellarCredential>({ method: 'apiKey', apiKey: '' })
  const [tenants, setTenants] = useState<Tenant[] | null>(null)
  const [tenantId, setTenantId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [period, setPeriod] = useState({ start: isoDay(-30), end: isoDay(-1) })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setBusy(false)
    }
  }

  const loadTenants = (e: FormEvent) => {
    e.preventDefault()
    void run(async () => {
      const list = await api<Tenant[]>('/stellar/tenants', { method: 'POST', body: { instanceUrl, credential } })
      setTenants(list)
      setTenantId(list[0]?.id ?? '')
    })
  }

  const create = (e: FormEvent) => {
    e.preventDefault()
    const tenant = tenants?.find((x) => x.id === tenantId)
    if (!tenant) return
    void run(async () => {
      const poc = await api<{ id: string }>('/pocs', {
        method: 'POST',
        body: { instanceUrl, tenant: { id: tenant.id, name: tenant.name }, period, details: { customerName } },
      })
      await api(`/pocs/${poc.id}/syncs`, { method: 'POST', body: { credential } })
      navigate(`/pocs/${poc.id}`)
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">{t('poc.new')}</h1>
      <form className="card space-y-4" onSubmit={loadTenants}>
        <label className="block">
          <span className="label">{t('poc.instance')}</span>
          <input className="input" type="url" required value={instanceUrl} onChange={(e) => setInstanceUrl(e.target.value)} />
        </label>
        <CredentialFields value={credential} onChange={setCredential} />
        <button className="btn" disabled={busy}>
          {t('common.continue')}
        </button>
      </form>

      {tenants ? (
        <form className="card space-y-4" onSubmit={create}>
          <label className="block">
            <span className="label">{t('poc.tenant')}</span>
            <select className="input" value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
              {tenants.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.group ? `${x.group} / ` : ''}
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">{t('poc.customer')}</span>
            <input className="input" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">{t('poc.period')}</span>
              <input className="input" type="date" required value={period.start} onChange={(e) => setPeriod((p) => ({ ...p, start: e.target.value }))} />
            </label>
            <label className="block">
              <span className="label">&nbsp;</span>
              <input className="input" type="date" required value={period.end} onChange={(e) => setPeriod((p) => ({ ...p, end: e.target.value }))} />
            </label>
          </div>
          <button className="btn" disabled={busy}>
            {t('sync.start')}
          </button>
        </form>
      ) : null}

      {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
    </div>
  )
}

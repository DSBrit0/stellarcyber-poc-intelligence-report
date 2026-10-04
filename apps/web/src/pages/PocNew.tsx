import type { PocDetails, StellarCredential } from '@poc-intel/shared'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../lib/api'
import { CredentialFields } from '../lib/CredentialFields'
import { AutoTriageCheckbox } from '../lib/AutoTriage'
import { CustomerDialog } from '../lib/CustomerForm'
import { HelpTip } from '../lib/HelpTip'
import { useCustomers } from '../lib/CustomerSelect'
import { PeriodFields, periodOk } from '../lib/PeriodFields'
import { errorKey } from '../lib/errors'
import { useI18n } from '../lib/i18n'
import { PocForm, emptyDetails } from '../lib/PocForm'
import { SyncBar, isRunning, useSync } from '../lib/SyncProgress'

interface Tenant {
  id: string
  name: string
  group: string
}
interface Remembered {
  instanceUrl: string
  method: string
  savedAt: string
}

const validUrl = (u: string) => /^https:\/\/[^/\s]+\.[^/\s]+/.test(u.trim())
const origin = (u: string) => {
  try {
    return new URL(u.trim()).origin
  } catch {
    return ''
  }
}

/**
 * One step of the page. `locked` means "not yet" (dimmed) or "already used by the Sync" (read-only):
 * either way it cannot be changed, but the values must stay readable.
 */
function Block({ title, help, helpTip, done, locked, children }: { title: string; help?: string; helpTip?: ReactNode; done?: boolean; locked?: boolean; children: ReactNode }) {
  return (
    <section className={`card space-y-3 transition ${locked ? 'pointer-events-none opacity-60' : ''}`} aria-disabled={locked}>
      <h2 className="flex items-center gap-2 font-semibold">
        <span
          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${done ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}
        >
          {done ? '✓' : ''}
        </span>
        {title}
      </h2>
      {help ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {help}
          {helpTip}
        </p>
      ) : null}
      {children}
    </section>
  )
}

/**
 * Create PoC, one page: Customer (optional) → Instance + API key → Tenant (auto) → period → Run Sync.
 * "Run Sync" creates a Draft PoC; the details form opens while the Sync runs; Save completes the PoC
 * and opens its Report as soon as the collection ends.
 */
export function PocNewPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const customers = useCustomers()
  const remembered = useQuery({ queryKey: ['remembered'], queryFn: () => api<Remembered[]>('/stellar/credentials') })

  const [customerId, setCustomerId] = useState<string | null>(null)
  const [dialog, setDialog] = useState(false)
  const [instanceUrl, setInstanceUrl] = useState('https://')
  const [credential, setCredential] = useState<StellarCredential>({ method: 'apiKey', apiKey: '' })
  const [remember, setRemember] = useState(true)
  const [useStored, setUseStored] = useState(true)
  const [tenants, setTenants] = useState<Tenant[] | null>(null)
  const [tenantsError, setTenantsError] = useState<string | null>(null)
  const [loadingTenants, setLoadingTenants] = useState(false)
  const [filter, setFilter] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [pocId, setPocId] = useState<string | null>(null)
  const [syncId, setSyncId] = useState<string | null>(null)
  const [details, setDetails] = useState<PocDetails>(emptyDetails())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  // Details as last saved (JSON); Save stays disabled until the form differs from it.
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
  const sync = useSync(syncId).data

  const url = origin(instanceUrl)
  const stored = (remembered.data ?? []).find((r) => r.instanceUrl === url)
  const usingStored = Boolean(stored) && useStored
  const typed = credential.method === 'apiKey' ? credential.apiKey.trim().length >= 8 : credential.username.trim() !== '' && credential.token !== ''
  const ready = validUrl(instanceUrl) && (usingStored || typed)

  // A Customer with a known Instance prefills the URL.
  const pickCustomer = (id: string | null) => {
    setCustomerId(id)
    const c = customers.data?.find((x) => x.id === id)
    if (c?.instanceUrl && (!validUrl(instanceUrl) || instanceUrl === 'https://')) setInstanceUrl(c.instanceUrl)
  }

  // Tenants are looked up automatically once URL and credential are there (1 s after the last keystroke).
  const lookup = useRef(0)
  useEffect(() => {
    if (!ready || pocId) return
    const n = ++lookup.current
    const timer = setTimeout(async () => {
      setLoadingTenants(true)
      setTenantsError(null)
      try {
        const list = await api<Tenant[]>('/stellar/tenants', { method: 'POST', body: { instanceUrl: url, credential: usingStored ? undefined : credential, remember: !usingStored && remember } })
        if (n !== lookup.current) return
        setTenants(list)
        if (list.length === 1) setTenantId(list[0]!.id)
        if (!usingStored && remember) void remembered.refetch()
      } catch (err) {
        if (n === lookup.current) {
          setTenants(null)
          setTenantsError(t(errorKey(err)))
        }
      } finally {
        if (n === lookup.current) setLoadingTenants(false)
      }
    }, 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, url, usingStored, credential, remember, pocId])

  const tenant = tenants?.find((x) => x.id === tenantId)
  const shown = useMemo(() => (tenants ?? []).filter((x) => `${x.name} ${x.group}`.toLowerCase().includes(filter.toLowerCase())), [tenants, filter])
  const groups = useMemo(() => [...new Set(shown.map((x) => x.group))].sort(), [shown])

  const periodValid = periodOk(start, end)

  const runSync = async () => {
    if (!tenant || !periodValid) return
    setBusy(true)
    setError(null)
    try {
      const draft = { ...details, customerName: details.customerName || tenant.name }
      const poc = await api<{ id: string }>('/pocs', { method: 'POST', body: { instanceUrl: url, customerId, draft: true, tenant: { id: tenant.id, name: tenant.name }, period: { start, end }, details: draft } })
      setPocId(poc.id)
      setDetails(draft)
      const s = await api<{ syncId: string }>(`/pocs/${poc.id}/syncs`, { method: 'POST', body: { credential: usingStored ? undefined : credential, remember: !usingStored && remember } })
      setSyncId(s.syncId)
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!pocId) return
    const snapshot = JSON.stringify(details)
    setBusy(true)
    setError(null)
    try {
      await api(`/pocs/${pocId}`, { method: 'PATCH', body: { finalize: true, details: { ...details, analysts: details.analysts.map((a) => a.trim()).filter(Boolean) } } })
      setSavedSnapshot(snapshot)
      setSaved(true)
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setBusy(false)
    }
  }

  const dirty = savedSnapshot !== JSON.stringify(details)

  // After Save, open the Report as soon as the collection is over (not while there are unsaved edits).
  useEffect(() => {
    if (saved && !dirty && pocId && sync && !isRunning(sync)) navigate(`/pocs/${pocId}`)
  }, [saved, dirty, pocId, sync, navigate])

  const forget = async () => {
    await api(`/stellar/credentials?instanceUrl=${encodeURIComponent(url)}`, { method: 'DELETE' })
    void remembered.refetch()
  }

  const locked = Boolean(pocId)
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">{t('poc.create')}</h1>

      <Block
        title={t('wiz.customerTitle')}
        help={t('wiz.customerHelp')}
        helpTip={
          <HelpTip title={t('help.customerTitle')}>
            <p>{t('help.customer')}</p>
          </HelpTip>
        }
        done={Boolean(customerId)} locked={locked}>
        <div className="flex gap-2">
          <select className="input" value={customerId ?? ''} onChange={(e) => pickCustomer(e.target.value || null)}>
            <option value="">{t('form.noCustomer')}</option>
            {(customers.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn shrink-0" onClick={() => setDialog(true)} aria-label={t('wiz.newCustomer')} title={t('wiz.newCustomer')}>
            +
          </button>
        </div>
      </Block>
      {/* Outside the Block: a closed <dialog> still counts as a child for space-y. */}
      <CustomerDialog
        open={dialog}
        onClose={() => setDialog(false)}
        onCreated={(c) => {
          setCustomerId(c.id)
          if (c.instanceUrl && !validUrl(instanceUrl)) setInstanceUrl(c.instanceUrl)
        }}
      />

      <Block title={t('wiz.instanceTitle')} done={Boolean(tenants)} locked={locked}>
        <label className="block">
          <span className="label">{t('poc.instance')}</span>
          <input className="input" type="url" list="known-instances" required value={instanceUrl} onChange={(e) => setInstanceUrl(e.target.value)} />
          <datalist id="known-instances">
            {[...new Set([...(remembered.data ?? []).map((r) => r.instanceUrl), ...(customers.data ?? []).flatMap((c) => (c.instanceUrl ? [c.instanceUrl] : []))])].map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </label>
        {stored && useStored ? (
          <p className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded bg-green-100 px-2 py-1 text-green-800 dark:bg-green-950 dark:text-green-300">✓ {t('wiz.remembered')}</span>
            <button type="button" className="text-brand underline" onClick={() => setUseStored(false)}>
              {t('wiz.useOther')}
            </button>
            <button type="button" className="text-red-600 underline" onClick={() => void forget()}>
              {t('wiz.forget')}
            </button>
          </p>
        ) : (
          <>
            <CredentialFields value={credential} onChange={setCredential} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              {t('wiz.remember')}
            </label>
          </>
        )}
        {loadingTenants ? <p className="text-sm text-slate-500">{t('wiz.loadingTenants')}</p> : null}
        {tenantsError ? <p className="text-sm text-red-600" role="alert">{tenantsError}</p> : null}
      </Block>

      <Block title={t('wiz.tenantTitle')} done={Boolean(tenant)} locked={!tenants || locked}>
        {tenants && tenants.length > 8 ? (
          <input
            className="input"
            placeholder={t('wiz.searchTenant')}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
              // One match left: pick it, so the filter alone is enough.
              const q = e.target.value.toLowerCase()
              const matches = (tenants ?? []).filter((x) => `${x.name} ${x.group}`.toLowerCase().includes(q))
              if (q && matches.length === 1) setTenantId(matches[0]!.id)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (shown[0]) setTenantId(shown[0].id)
              }
            }}
          />
        ) : null}
        {tenant ? (
          <p className="text-sm">
            <span className="rounded bg-green-100 px-2 py-1 text-green-800 dark:bg-green-950 dark:text-green-300">✓ {tenant.group ? `${tenant.group} / ` : ''}{tenant.name}</span>
          </p>
        ) : null}
        {/* A list of buttons rather than a <select size>: a click always selects, filtered or not. */}
        {tenants ? (
          <div role="listbox" aria-label={t('wiz.tenantTitle')} className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
            {groups.map((g) => (
              <div key={g || '-'} role="group" aria-label={g || '—'}>
                {/* Tenants outside any Tenant Group come first, without a header. */}
                {g ? <div className="sticky top-0 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{g}</div> : null}
                {shown
                  .filter((x) => x.group === g)
                  .map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      role="option"
                      aria-selected={x.id === tenantId}
                      className={`block w-full px-4 py-1.5 text-left text-sm ${x.id === tenantId ? 'bg-brand font-medium text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      onClick={() => setTenantId(x.id)}
                    >
                      {x.name}
                    </button>
                  ))}
              </div>
            ))}
            {tenants && shown.length === 0 ? <p className="px-3 py-2 text-sm text-slate-500">{t('wiz.noTenantMatch')}</p> : null}
          </div>
        ) : null}
      </Block>

      <Block title={t('wiz.autoTriageTitle')} help={t('wiz.autoTriageHelp')} done={details.aiTriageTested} locked={!tenant || locked}>
        <AutoTriageCheckbox checked={details.aiTriageTested} onChange={(v) => setDetails((d) => ({ ...d, aiTriageTested: v }))} />
      </Block>

      <Block title={t('wiz.periodTitle')} help={t('wiz.periodHelp')} done={periodValid} locked={!tenant || locked}>
        <PeriodFields
          start={start}
          end={end}
          onChange={(s, e) => {
            setStart(s)
            setEnd(e)
          }}
        />
        {!pocId ? (
          <button type="button" className="btn" disabled={!periodValid || busy || !tenant} onClick={() => void runSync()}>
            {t('wiz.runSync')}
          </button>
        ) : null}
      </Block>

      {syncId ? <SyncBar sticky canCancel sync={sync} label={saved ? t('wiz.waiting') : undefined} /> : null}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {pocId ? (
        <Block title={t('wiz.detailsTitle')} done={saved}>
          <PocForm value={details} onChange={setDetails} autoTriage={false} />
          <div className="flex items-center gap-3">
            <button type="button" className="btn" disabled={busy || !dirty} onClick={() => void save()}>
              {t('common.save')}
            </button>
            {saved && isRunning(sync) ? <span className="text-sm text-slate-500">{t('wiz.waiting')}</span> : null}
            {saved && sync?.status === 'failed' ? (
              <button type="button" className="btn-ghost" onClick={() => navigate(`/pocs/${pocId}`)}>
                {t('report.view')}
              </button>
            ) : null}
          </div>
        </Block>
      ) : null}
    </div>
  )
}

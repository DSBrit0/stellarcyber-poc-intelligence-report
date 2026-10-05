import type { PocDetails, StellarCredential } from '@poc-intel/shared'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
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
import { typedDetailsValid } from '../lib/TypedFields'
import { suggestedPeriod, type Milestone } from './notebook/ScheduleSection'
import { SyncBar, isRunning, useSync } from '../lib/SyncProgress'
import { Select } from '../lib/Select'

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
 * New PoC: first the choice between starting a PoC Notebook and creating the Final Report straight away.
 * `?from=<pocId>` is "Create the Final Report" on an existing Notebook: the Report flow on that PoC.
 */
export function PocNewPage() {
  const [params] = useSearchParams()
  const from = params.get('from')
  const [mode, setMode] = useState<'notebook' | 'report' | null>(null)
  if (from) return <ReportFlow key={from} fromId={from} />
  if (mode === 'report') return <ReportFlow onBack={() => setMode(null)} />
  if (mode === 'notebook') return <NotebookStart onBack={() => setMode(null)} />
  return <ChooseStart onChoose={setMode} />
}

function ChooseStart({ onChoose }: { onChoose: (m: 'notebook' | 'report') => void }) {
  const { t } = useI18n()
  const card = (m: 'notebook' | 'report', title: string, help: string, icon: ReactNode) => (
    <button type="button" className="card group flex h-full flex-col items-start gap-3 text-left transition hover:border-brand focus-visible:border-brand" onClick={() => onChoose(m)}>
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand" aria-hidden="true">
        {icon}
      </span>
      <span className="text-lg font-semibold group-hover:text-brand">{title}</span>
      <span className="text-sm text-slate-500 dark:text-slate-400">{help}</span>
    </button>
  )
  const svg = (d: string) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">{t('poc.create')}</h1>
      <p className="text-sm text-slate-500">{t('newpoc.choose')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {card('notebook', t('newpoc.notebook'), t('newpoc.notebookHelp'), svg('M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4zM8 8h8M8 12h8M8 16h5'))}
        {card('report', t('newpoc.report'), t('newpoc.reportHelp'), svg('M4 20V10M10 20V4M16 20v-7M22 20H2'))}
      </div>
    </div>
  )
}

/** Start a PoC Notebook: a Customer (required, ADR 0010) and the PoC start date; no Tenant yet. */
function NotebookStart({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const customers = useCustomers()
  const [customerId, setCustomerId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dialog, setDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const options = (customers.data ?? []).filter((c) => c.profile === 'customer' && c.manageable)
  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      const poc = await api<{ id: string }>('/pocs/notebook', { method: 'POST', body: { customerId, startDate } })
      navigate(`/pocs/${poc.id}`)
    } catch (err) {
      setError(t(errorKey(err)))
      setBusy(false)
    }
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">{t('newpoc.notebookTitle')}</h1>
      <form
        className="card space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void start()
        }}
      >
        <label className="block">
          <span className="label">{t('nav.customers')}</span>
          <div className="flex gap-2">
            <Select className="input" required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="" disabled>
                {t('newpoc.chooseCustomer')}
              </option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <button type="button" className="btn shrink-0" onClick={() => setDialog(true)} aria-label={t('wiz.newCustomer')} title={t('wiz.newCustomer')}>
              +
            </button>
          </div>
          <span className="mt-1 block text-xs text-slate-500">{t('newpoc.customerHelp')}</span>
        </label>
        <label className="block max-w-56">
          <span className="label">{t('newpoc.startDate')}</span>
          <input className="input" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button className="btn" disabled={busy || !customerId || !startDate}>
            {t('newpoc.start')}
          </button>
          <button type="button" className="btn-ghost" onClick={onBack}>
            {t('newpoc.back')}
          </button>
        </div>
      </form>
      <CustomerDialog open={dialog} onClose={() => setDialog(false)} onCreated={(c) => setCustomerId(c.id)} />
    </div>
  )
}

interface FromPoc {
  id: string
  details: PocDetails
  customerId: string | null
  customerName: string | null
  reports: unknown[]
}

/**
 * Create PoC, one page: Customer → Instance + API key → Tenant (auto) → period → Run Sync.
 * "Run Sync" creates a Draft PoC; the details form opens while the Sync runs; Save completes the PoC
 * and opens its Report as soon as the collection ends. With `fromId`, the PoC is an existing Notebook:
 * its customer and details are kept, and Run Sync sets its Report target instead of creating a PoC.
 */
function ReportFlow({ fromId, onBack }: { fromId?: string; onBack?: () => void }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const customers = useCustomers()
  const fromPoc = useQuery({ queryKey: ['poc', fromId], queryFn: () => api<FromPoc>(`/pocs/${fromId}`), enabled: Boolean(fromId) })
  const fromNotebook = useQuery({
    queryKey: ['notebook', fromId],
    queryFn: () => api<{ overview: { startDate: string }; milestones: Milestone[] }>(`/pocs/${fromId}/notebook`),
    enabled: Boolean(fromId),
  })
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
  // A Notebook brings its customer and details; one that already has a Report is done here.
  const from = fromPoc.data
  useEffect(() => {
    if (!from) return
    if (from.reports.length > 0) navigate(`/pocs/${from.id}`, { replace: true })
    setCustomerId(from.customerId)
    setDetails(from.details)
    const c = customers.data?.find((x) => x.id === from.customerId)
    if (c?.instanceUrl) setInstanceUrl((u) => (u === 'https://' ? c.instanceUrl! : u))
  }, [from, customers.data, navigate])
  // The PoC Schedule suggests the period: Kickoff to Closeout, at most 30 days, ending yesterday at the latest.
  const nb = fromNotebook.data
  useEffect(() => {
    if (!nb) return
    const period = suggestedPeriod(nb.overview.startDate, nb.milestones)
    if (!period) return
    setStart((s) => s || period.start)
    setEnd((e) => e || period.end)
  }, [nb])
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
      const target = { instanceUrl: url, tenant: { id: tenant.id, name: tenant.name }, period: { start, end } }
      const poc = from
        ? (await api(`/pocs/${from.id}/report-target`, { method: 'POST', body: target }), { id: from.id })
        : await api<{ id: string }>('/pocs', { method: 'POST', body: { ...target, customerId, draft: true, details: draft } })
      if (from && details.aiTriageTested !== from.details.aiTriageTested) await api(`/pocs/${from.id}`, { method: 'PATCH', body: { details: draft } })
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{from ? t('newpoc.fromNotebook', { name: from.details.customerName }) : t('poc.create')}</h1>
        {onBack && !locked ? (
          <button type="button" className="btn-ghost" onClick={onBack}>
            {t('newpoc.back')}
          </button>
        ) : null}
      </div>

      <Block
        title={t('wiz.customerTitle')}
        help={t('wiz.customerHelp')}
        helpTip={
          <HelpTip title={t('help.customerTitle')}>
            <p>{t('help.customer')}</p>
          </HelpTip>
        }
        done={Boolean(customerId)} locked={locked || Boolean(from)}>
        <div className="flex gap-2">
          <Select className="input" value={customerId ?? ''} onChange={(e) => pickCustomer(e.target.value || null)}>
            <option value="">{t('form.noCustomer')}</option>
            {from?.customerId && from.customerName ? <option value={from.customerId}>{from.customerName}</option> : null}
            {(customers.data ?? []).filter((c) => c.profile === 'customer' && c.manageable && c.id !== from?.customerId).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
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
          <PocForm value={details} onChange={setDetails} autoTriage={false} criteriaInNotebook={Boolean(from)} />
          <div className="flex items-center gap-3">
            <button type="button" className="btn" disabled={busy || !dirty || !typedDetailsValid(details)} onClick={() => void save()}>
              {t('common.save')}
            </button>
            {!typedDetailsValid(details) ? <span className="text-sm text-red-600">{t('field.fixToSave')}</span> : null}
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

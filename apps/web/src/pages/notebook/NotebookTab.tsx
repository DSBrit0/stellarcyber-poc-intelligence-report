import {
  CRITERION_STATUSES,
  DATA_SOURCE_STATUSES,
  type CatalogKind,
  type DataSourceStatus,
  PROCESS_STATUSES,
  fieldValid,
  normalizeField,
  type CriterionStatus,
  type I18nText,
  type Locale,
  type NotebookDetails,
  type NotebookOverview,
  type ProcessKind,
  type ProcessStatus,
} from '@poc-intel/shared'
import type { MessageKey } from '@poc-intel/shared/i18n'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { api } from '../../lib/api'
import { errorKey } from '../../lib/errors'
import { useI18n } from '../../lib/i18n'
import { ContactFields, TypedInput, contactOk, linesOf } from '../../lib/TypedFields'
import { ScheduleSection, type Milestone } from './ScheduleSection'
import { SaveIndicator, SaveProvider, useLiveAutosave, useSaveTracker } from './saving'

interface Criterion {
  id: string
  text: string
  status: CriterionStatus | null
  notes: string
  weight: number | null
}
interface DataSource {
  id: string
  kind: CatalogKind
  catalogId: string | null
  name: string
  port: string
  status: DataSourceStatus | null
  notes: string
  category: string | null
  docUrl: string | null
  /** The catalog no longer lists it. */
  removed: boolean
}
interface CatalogEntry {
  id: string
  kind: CatalogKind
  name: string
  port: string
  category: string
  detail: string
  docUrl: string
}
interface Meeting {
  id: string
  date: string | null
  link: string
  passcode: string
  notes: string
  nextSteps: string
}
interface ProcessRow {
  id: string
  kind: ProcessKind
  indent: number
  text: I18nText
  hidden: boolean
  status: ProcessStatus | null
}
export interface NotebookView {
  overview: NotebookOverview
  details: NotebookDetails
  criteria: Criterion[]
  meetings: Meeting[]
  sources: DataSource[]
  milestones: Milestone[]
  /** The documentation version of the Data Source Catalog, e.g. "7.0.xs". */
  docsVersion: string | null
  process: ProcessRow[]
  canFill: boolean
  canShape: boolean
  hasReportTarget: boolean
}

type Section = 'overview' | 'sources' | 'criteria' | 'meetings' | 'process' | 'schedule'
const SECTIONS: { key: Section; label: MessageKey }[] = [
  { key: 'overview', label: 'nb.overview' },
  { key: 'sources', label: 'nb.sources' },
  { key: 'criteria', label: 'nb.criteria' },
  { key: 'meetings', label: 'nb.meetings' },
  { key: 'process', label: 'nb.process' },
  { key: 'schedule', label: 'nb.schedule' },
]

/** The official documentation links, in the documentation version the Data Source Catalog follows. */
const docLinks = (version: string | null): { label: MessageKey; href: string }[] => {
  const docs = `https://docs.stellarcyber.ai/prod-docs/${version ?? '7.0.xs'}`
  return [
    { label: 'nb.doc.learning', href: 'https://academy.stellarcyber.ai/' },
    { label: 'nb.doc.sensorVm', href: `${docs}/Installation/Virtual-Appliance-Sizing-Specifications.htm` },
    { label: 'nb.doc.firewall', href: `${docs}/Configure/Ports/Firewall-Requirements.htm` },
    { label: 'nb.doc.connectors', href: `${docs}/Configure/Connectors/1-Connectors-List.htm` },
    { label: 'nb.doc.parsers', href: `${docs}/Configure/Ports/Firewall-Ports-for-Parsers.htm` },
    { label: 'nb.doc.indices', href: `${docs}/Common/Understanding-Indices.htm` },
    { label: 'nb.doc.installSensor', href: `${docs}/Installation/SaaS/Overview-SaaS-Mod-Sensor.htm` },
  ]
}

/** Template text in the reader's language; en and es fall back to pt-BR when blank (ADR 0012). */
export const localText = (text: I18nText, locale: Locale) => text[locale]?.trim() || text['pt-BR']

export function NotebookTab({ pocId }: { pocId: string }) {
  const { t } = useI18n()
  // Everyone sees the others' changes: refreshed every 5 s while the tab is visible (not in the background).
  const { data: nb, error } = useQuery({ queryKey: ['notebook', pocId], queryFn: () => api<NotebookView>(`/pocs/${pocId}/notebook`), refetchInterval: 5000 })
  // A failed background refresh keeps the last data on screen.
  if (!nb) return error ? <p className="card text-sm text-red-600">{t(errorKey(error))}</p> : null
  return (
    <SaveProvider queryKey={['notebook', pocId]}>
      <NotebookBody pocId={pocId} nb={nb} />
    </SaveProvider>
  )
}

function NotebookBody({ pocId, nb }: { pocId: string; nb: NotebookView }) {
  const { t } = useI18n()
  const [section, setSection] = useState<Section>('overview')
  const phases = phasesOf(nb.process)
  const done = phases.reduce((n, p) => n + p.done, 0)
  const total = phases.reduce((n, p) => n + p.total, 0)
  // Each milestone follows its PoC Process phase: hidden with it, done when all its items are.
  const phaseState = new Map(phases.flatMap((p) => (p.head ? [[p.head.id, { hidden: p.head.hidden, done: p.total > 0 && p.done === p.total }] as const] : [])))
  return (
    <div className="space-y-4">
      {!nb.canFill ? <p className="text-sm text-slate-500">{t('nb.readOnly')}</p> : null}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-slate-200 dark:border-slate-800">
      <nav className="flex flex-wrap gap-1" aria-label={t('tab.notebook')}>
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-current={section === s.key ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${section === s.key ? 'border-brand font-semibold text-brand' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            onClick={() => setSection(s.key)}
          >
            {t(s.label)}
            {s.key === 'sources' ? <Count n={nb.sources.length} /> : s.key === 'criteria' ? <Count n={nb.criteria.length} /> : s.key === 'meetings' ? <Count n={nb.meetings.length} /> : s.key === 'process' ? <Count n={`${done}/${total}`} /> : s.key === 'schedule' ? <Count n={nb.milestones.length} /> : null}
          </button>
        ))}
      </nav>
      {nb.canFill ? (
        <div className="pb-2">
          <SaveIndicator />
        </div>
      ) : null}
      </div>
      {section === 'overview' ? (
        <OverviewSection pocId={pocId} nb={nb} />
      ) : section === 'sources' ? (
        <div className="space-y-4">
          <SourcesSection pocId={pocId} nb={nb} kind="parser" />
          <SourcesSection pocId={pocId} nb={nb} kind="connector" />
        </div>
      ) : section === 'criteria' ? (
        <CriteriaSection pocId={pocId} nb={nb} />
      ) : section === 'meetings' ? (
        <MeetingsSection pocId={pocId} nb={nb} />
      ) : section === 'process' ? (
        <ProcessSection pocId={pocId} nb={nb} done={done} total={total} />
      ) : (
        <ScheduleSection pocId={pocId} startDate={nb.overview.startDate} milestones={nb.milestones} phaseState={phaseState} canShape={nb.canShape} />
      )}
    </div>
  )
}

function Count({ n }: { n: number | string }) {
  return <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-[11px] font-normal text-slate-500 dark:bg-slate-800">{n}</span>
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  )
}

const badNames = (text: string) => linesOf(text.split('\n')).filter((a) => !fieldValid('personName', a.replace(/\s+/g, ' ')))

const overviewValid = ({ overview, details, analysts }: { overview: NotebookOverview; details: NotebookDetails; analysts: string }) =>
  overview.startDate !== '' &&
  details.customerName.trim() !== '' &&
  fieldValid('url', overview.pocUrl) &&
  contactOk(overview.businessContact) &&
  contactOk(overview.technicalContact) &&
  fieldValid('email', details.customerEmail) &&
  contactOk(details.salesEngineer) &&
  fieldValid('personName', details.partner.name) &&
  fieldValid('email', details.partner.email) &&
  fieldValid('url', details.partner.site) &&
  badNames(analysts).length === 0

/** The fields of `now` that differ from `base`. */
const changedFields = <O extends object>(now: O, base: O): Partial<O> =>
  Object.fromEntries(Object.entries(now).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify((base as Record<string, unknown>)[k]))) as Partial<O>

function OverviewSection({ pocId, nb }: { pocId: string; nb: NotebookView }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  // Stakeholders are typed one per line; each line is a person's name.
  const [form, setForm] = useLiveAutosave(
    { overview: nb.overview, details: nb.details, analysts: nb.details.analysts.join('\n') },
    async (v, base) => {
      // Only the fields changed here: two people editing other fields of the Overview keep both edits.
      const overview = changedFields(v.overview, base.overview)
      const { analysts: _a, ...detailsNow } = v.details
      const { analysts: _b, ...detailsBase } = base.details
      const details: Record<string, unknown> = changedFields(detailsNow, detailsBase)
      if (JSON.stringify(linesOf(v.analysts.split('\n'))) !== JSON.stringify(linesOf(base.analysts.split('\n')))) details.analysts = linesOf(v.analysts.split('\n'))
      if (Object.keys(overview).length === 0 && Object.keys(details).length === 0) return
      await api(`/pocs/${pocId}/notebook`, { method: 'PATCH', body: { overview, details } })
      void qc.invalidateQueries({ queryKey: ['poc', pocId] })
    },
    (v) => nb.canFill && overviewValid(v),
  )
  const { overview, details, analysts } = form
  const setOverview = (f: (o: NotebookOverview) => NotebookOverview) => setForm((x) => ({ ...x, overview: f(x.overview) }))
  const setDetails = (f: (d: NotebookDetails) => NotebookDetails) => setForm((x) => ({ ...x, details: f(x.details) }))
  const setAnalysts = (text: string) => setForm((x) => ({ ...x, analysts: text }))
  const ro = !nb.canFill
  const badAnalysts = badNames(analysts)
  const valid = overviewValid(form)
  const ov = <K extends keyof NotebookOverview>(k: K, v: NotebookOverview[K]) => setOverview((o) => ({ ...o, [k]: v }))
  const heading = (key: MessageKey) => <h3 className="border-t border-slate-200 pt-4 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200">{t(key)}</h3>
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <section className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">{t('nb.overview')}</h2>
          {!valid && nb.canFill ? <span className="text-xs text-red-600">{t('field.fixToSave')}</span> : null}
        </div>
        <div className="grid items-start gap-3 sm:grid-cols-3">
          <Field label={t('newpoc.startDate')}>
            <input className="input" type="date" required disabled={ro} value={overview.startDate} onChange={(e) => ov('startDate', e.target.value)} />
          </Field>
          <Field label={t('nb.sizing')}>
            <input
              className="input"
              type="number"
              min={0}
              step="any"
              disabled={ro}
              value={overview.sizingGbDay ?? ''}
              onChange={(e) => ov('sizingGbDay', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
            />
          </Field>
          <TypedInput kind="url" label={t('nb.pocUrl')} maxLength={500} disabled={ro} value={overview.pocUrl} onChange={(v) => ov('pocUrl', v)} />
        </div>

        {heading('nb.businessContact')}
        <ContactFields disabled={ro} value={overview.businessContact} onChange={(v) => ov('businessContact', v)} />
        {heading('nb.technicalContact')}
        <ContactFields disabled={ro} value={overview.technicalContact} onChange={(v) => ov('technicalContact', v)} />

        {heading('form.sectionCustomer')}
        <div className="grid items-start gap-3 sm:grid-cols-3">
          <Field label={t('form.customerName')}>
            <input className="input" required maxLength={160} disabled={ro} value={details.customerName} onChange={(e) => setDetails((d) => ({ ...d, customerName: e.target.value }))} />
          </Field>
          <Field label={t('form.department')}>
            <input className="input" maxLength={160} disabled={ro} value={details.department} onChange={(e) => setDetails((d) => ({ ...d, department: e.target.value }))} />
          </Field>
          <TypedInput kind="email" label={t('form.customerEmail')} maxLength={254} disabled={ro} value={details.customerEmail} onChange={(v) => setDetails((d) => ({ ...d, customerEmail: v }))} />
        </div>
        <Field label={t('form.analysts')}>
          <textarea
            className={`input ${badAnalysts.length ? 'border-red-500' : ''}`}
            rows={3}
            disabled={ro}
            value={analysts}
            onChange={(e) => setAnalysts(e.target.value.split('\n').slice(0, 50).join('\n'))}
            onBlur={() => setAnalysts(linesOf(analysts.split('\n')).map((a) => normalizeField('personName', a)).join('\n'))}
          />
          {badAnalysts.length ? <span className="mt-1 block text-xs text-red-600">{t('field.invalid.personName')} ({badAnalysts.join(', ')})</span> : null}
        </Field>

        {heading('form.sectionSe')}
        <ContactFields disabled={ro} value={details.salesEngineer} onChange={(v) => setDetails((d) => ({ ...d, salesEngineer: v }))} />

        {heading('form.sectionPartner')}
        <div className="grid items-start gap-3 sm:grid-cols-3">
          <TypedInput kind="personName" label={t('form.partnerName')} maxLength={120} disabled={ro} value={details.partner.name} onChange={(v) => setDetails((d) => ({ ...d, partner: { ...d.partner, name: v } }))} />
          <TypedInput kind="email" label={t('form.partnerEmail')} maxLength={254} disabled={ro} value={details.partner.email} onChange={(v) => setDetails((d) => ({ ...d, partner: { ...d.partner, email: v } }))} />
          <TypedInput kind="url" label={t('form.partnerSite')} maxLength={254} disabled={ro} value={details.partner.site} onChange={(v) => setDetails((d) => ({ ...d, partner: { ...d.partner, site: v } }))} />
        </div>
      </section>

      <aside className="card h-fit space-y-2">
        <h2 className="font-semibold">{t('nb.docs')}</h2>
        <ul className="space-y-1.5 text-sm">
          {docLinks(nb.docsVersion).map((d) => (
            <li key={d.href}>
              <a className="text-brand underline-offset-2 hover:underline" href={d.href} target="_blank" rel="noopener noreferrer">
                {t(d.label)} ↗
              </a>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}

const SOURCE_STYLE: Record<DataSourceStatus, string> = {
  in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  ingesting: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  ticket_open: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
}

/** Log sources (parsers, with their port) or Connectors of the PoC, picked from the Data Source Catalog. */
function SourcesSection({ pocId, nb, kind }: { pocId: string; nb: NotebookView; kind: CatalogKind }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const { track } = useSaveTracker()
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: () => api<{ version: { label: string } | null; entries: CatalogEntry[] }>('/catalog'), staleTime: 10 * 60_000 })
  const rows = nb.sources.filter((s) => s.kind === kind)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const used = new Set(rows.map((r) => r.catalogId).filter(Boolean))
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const matches =
    words.length === 0
      ? []
      : (catalog.data?.entries ?? [])
          .filter((e) => e.kind === kind && !used.has(e.id))
          .filter((e) => {
            const hay = `${e.name} ${e.category} ${e.port}`.toLowerCase()
            return words.every((w) => hay.includes(w))
          })
          .slice(0, 8)
  const add = async (body: { catalogId?: string; name?: string }) => {
    setBusy(true)
    setError(null)
    try {
      await track(api(`/pocs/${pocId}/notebook/sources`, { method: 'POST', body: { kind, ...body } }))
      setQ('')
      await qc.invalidateQueries({ queryKey: ['notebook', pocId] })
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setBusy(false)
    }
  }
  const parser = kind === 'parser'
  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{t(parser ? 'nb.parsersTitle' : 'nb.connectorsTitle')}</h2>
        {catalog.data?.version ? <span className="text-xs text-slate-400">{t('nb.catalogVersion', { label: catalog.data.version.label })}</span> : null}
      </div>
      {rows.length === 0 ? <p className="text-sm text-slate-500">{t(parser ? 'nb.noParsers' : 'nb.noConnectors')}</p> : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="py-1 pr-2 font-medium">{t('nb.sourceName')}</th>
                <th className="px-2 font-medium">{t(parser ? 'nb.port' : 'nb.category')}</th>
                <th className="px-2 font-medium">{t('nb.status')}</th>
                <th className="px-2 font-medium">{t('nb.meetingNotes')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <SourceRow key={r.id} pocId={pocId} r={r} canFill={nb.canFill} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {nb.canFill ? (
        <div className="relative border-t border-slate-200 pt-3 dark:border-slate-800">
          <input
            className="input"
            placeholder={t(parser ? 'nb.searchParser' : 'nb.searchConnector')}
            value={q}
            disabled={busy}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (matches[0]) void add({ catalogId: matches[0].id })
              }
            }}
          />
          {q.trim() ? (
            <ul className="absolute z-10 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {matches.map((e) => (
                <li key={e.id}>
                  <button type="button" className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => void add({ catalogId: e.id })}>
                    <span className="flex-1">{e.name}</span>
                    <span className="text-xs text-slate-500">{parser ? e.port : [e.category, e.detail].filter(Boolean).join(' · ')}</span>
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="w-full border-t border-slate-100 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800" onClick={() => void add({ name: q.trim() })}>
                  {t('nb.addOutside', { name: q.trim() })}
                </button>
              </li>
            </ul>
          ) : null}
          {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </section>
  )
}

function SourceRow({ pocId, r, canFill }: { pocId: string; r: DataSource; canFill: boolean }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const { track } = useSaveTracker()
  const [row, setRow] = useLiveAutosave({ status: r.status, notes: r.notes, port: r.port }, (v) => api(`/pocs/${pocId}/notebook/sources/${r.id}`, { method: 'PATCH', body: v }), () => canFill)
  const remove = async () => {
    if (!window.confirm(t('nb.deleteConfirm'))) return
    await track(api(`/pocs/${pocId}/notebook/sources/${r.id}`, { method: 'DELETE' }))
    void qc.invalidateQueries({ queryKey: ['notebook', pocId] })
  }
  return (
    <tr className="border-t border-slate-100 align-top dark:border-slate-800">
      <td className="py-1.5 pr-2">
        <span className="font-medium">{r.name}</span>
        {r.docUrl ? (
          <a className="ml-1 text-brand" href={r.docUrl} target="_blank" rel="noopener noreferrer" title={t('nb.docs')}>
            ↗
          </a>
        ) : null}
        {r.removed ? <span className="ml-2 rounded bg-red-100 px-1.5 text-[11px] text-red-700 dark:bg-red-950 dark:text-red-300">{t('nb.removedFromDocs')}</span> : null}
        {!r.catalogId ? <span className="ml-2 rounded bg-slate-200 px-1.5 text-[11px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">{t('nb.outsideCatalog')}</span> : null}
      </td>
      <td className="px-2 py-1.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
        {r.kind === 'parser' ? (
          r.catalogId ? (
            r.port
          ) : (
            <input className="input w-28 py-1" maxLength={80} disabled={!canFill} value={row.port} onChange={(e) => setRow((x) => ({ ...x, port: e.target.value }))} />
          )
        ) : (
          (r.category ?? '')
        )}
      </td>
      <td className="px-2 py-1">
        <select
          className={`rounded border-0 px-2 py-1 text-xs ${row.status ? SOURCE_STYLE[row.status] : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}
          aria-label={t('nb.status')}
          disabled={!canFill}
          value={row.status ?? ''}
          onChange={(e) => setRow((x) => ({ ...x, status: (e.target.value || null) as DataSourceStatus | null }))}
        >
          <option value="">{t('nb.ps.none')}</option>
          {DATA_SOURCE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`nb.ds.${s}`)}
            </option>
          ))}
        </select>
      </td>
      <td className="w-full px-2 py-1">
        <input className="input py-1" maxLength={4000} disabled={!canFill} value={row.notes} onChange={(e) => setRow((x) => ({ ...x, notes: e.target.value }))} />
      </td>
      <td className="py-1 pl-2 whitespace-nowrap">
        {canFill ? (
          <button type="button" className="btn-ghost px-2 text-red-600" title={t('nb.delete')} aria-label={t('nb.delete')} onClick={() => void remove()}>
            ✕
          </button>
        ) : null}
      </td>
    </tr>
  )
}

const CRITERION_STYLE: Record<CriterionStatus, string> = {
  completed_success: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  completed_partial: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  completed_failed: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  ticket_open: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
}
const EXAMPLES: MessageKey[] = ['nb.example.1', 'nb.example.2', 'nb.example.3', 'nb.example.4', 'nb.example.5', 'nb.example.6', 'nb.example.7']

function CriteriaSection({ pocId, nb }: { pocId: string; nb: NotebookView }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const { track } = useSaveTracker()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const add = async (text: string) => {
    if (!text.trim()) return
    setBusy(true)
    setError(null)
    try {
      await track(api(`/pocs/${pocId}/notebook/criteria`, { method: 'POST', body: { text } }))
      setDraft('')
      await qc.invalidateQueries({ queryKey: ['notebook', pocId] })
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setBusy(false)
    }
  }
  const [requirements, setRequirements] = useLiveAutosave(nb.overview.businessRequirements, (v) => api(`/pocs/${pocId}/notebook`, { method: 'PATCH', body: { overview: { businessRequirements: v } } }), () => nb.canFill)
  const used = new Set(nb.criteria.map((c) => c.text.trim().toLowerCase()))
  return (
    <div className="space-y-4">
      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t('nb.businessRequirements')}</h2>
        </div>
        <textarea className="input" rows={3} maxLength={4000} disabled={!nb.canFill} value={requirements} onChange={(e) => setRequirements(e.target.value)} />
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">{t('nb.criteria')}</h2>
        {nb.criteria.length === 0 ? <p className="text-sm text-slate-500">{t('nb.noCriteria')}</p> : null}
        <ul className="space-y-3">
          {nb.criteria.map((c) => (
            <CriterionItem key={c.id} pocId={pocId} c={c} canFill={nb.canFill} />
          ))}
        </ul>
        {nb.canFill ? (
          <>
            <form
              className="flex gap-2 border-t border-slate-200 pt-3 dark:border-slate-800"
              onSubmit={(e) => {
                e.preventDefault()
                void add(draft)
              }}
            >
              <input className="input" maxLength={1000} placeholder={t('nb.criterion')} value={draft} onChange={(e) => setDraft(e.target.value)} />
              <button className="btn shrink-0" disabled={busy || !draft.trim()}>
                {t('nb.addCriterion')}
              </button>
            </form>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">{t('nb.suggestions')}:</span>
              {EXAMPLES.filter((k) => !used.has(t(k).toLowerCase())).map((k) => (
                <button key={k} type="button" className="rounded-full border border-slate-300 px-2 py-0.5 hover:border-brand hover:text-brand dark:border-slate-700" disabled={busy} onClick={() => void add(t(k))}>
                  + {t(k)}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </div>
  )
}

function CriterionItem({ pocId, c, canFill }: { pocId: string; c: Criterion; canFill: boolean }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const { track } = useSaveTracker()
  const [row, setRow] = useLiveAutosave(
    { text: c.text, status: c.status, notes: c.notes, weight: c.weight },
    (v) => api(`/pocs/${pocId}/notebook/criteria/${c.id}`, { method: 'PATCH', body: v }),
    (v) => canFill && v.text.trim() !== '',
  )
  const remove = async () => {
    if (!window.confirm(t('nb.deleteConfirm'))) return
    await track(api(`/pocs/${pocId}/notebook/criteria/${c.id}`, { method: 'DELETE' }))
    void qc.invalidateQueries({ queryKey: ['notebook', pocId] })
  }
  return (
    <li className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div className="flex items-start gap-2">
        <textarea className="input min-h-0 flex-1 font-medium" rows={1} maxLength={1000} disabled={!canFill} value={row.text} onChange={(e) => setRow((r) => ({ ...r, text: e.target.value }))} />
        {canFill ? (
          <button type="button" className="btn-ghost px-2 text-red-600" title={t('nb.delete')} aria-label={t('nb.delete')} onClick={() => void remove()}>
            ✕
          </button>
        ) : null}
      </div>
      <div className="grid items-end gap-2 sm:grid-cols-[14rem_6rem_1fr_auto]">
        <Field label={t('nb.status')}>
          <select
            className={`input ${row.status ? CRITERION_STYLE[row.status] : ''}`}
            disabled={!canFill}
            value={row.status ?? ''}
            onChange={(e) => setRow((r) => ({ ...r, status: (e.target.value || null) as CriterionStatus | null }))}
          >
            <option value="">{t('nb.cs.none')}</option>
            {CRITERION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`nb.cs.${s}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('nb.weight')}>
          <select className="input" title={t('nb.weightHelp')} disabled={!canFill} value={row.weight ?? ''} onChange={(e) => setRow((r) => ({ ...r, weight: e.target.value ? Number(e.target.value) : null }))}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('nb.evalNotes')}>
          <input className="input" maxLength={4000} disabled={!canFill} value={row.notes} onChange={(e) => setRow((r) => ({ ...r, notes: e.target.value }))} />
        </Field>
        <span className="pb-2">
        </span>
      </div>
    </li>
  )
}

function MeetingsSection({ pocId, nb }: { pocId: string; nb: NotebookView }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const { track } = useSaveTracker()
  const [busy, setBusy] = useState(false)
  const add = async () => {
    setBusy(true)
    try {
      await track(api(`/pocs/${pocId}/notebook/meetings`, { method: 'POST', body: { date: new Date().toISOString().slice(0, 10) } }))
      await qc.invalidateQueries({ queryKey: ['notebook', pocId] })
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{t('nb.meetings')}</h2>
        {nb.canFill ? (
          <button type="button" className="btn" disabled={busy} onClick={() => void add()}>
            {t('nb.addMeeting')}
          </button>
        ) : null}
      </div>
      {nb.meetings.length === 0 ? <p className="text-sm text-slate-500">{t('nb.noMeetings')}</p> : null}
      <ul className="space-y-3">
        {nb.meetings.map((m) => (
          <MeetingItem key={m.id} pocId={pocId} m={m} canFill={nb.canFill} />
        ))}
      </ul>
    </section>
  )
}

function MeetingItem({ pocId, m, canFill }: { pocId: string; m: Meeting; canFill: boolean }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const { track } = useSaveTracker()
  const [row, setRow] = useLiveAutosave(
    { date: m.date, link: m.link, passcode: m.passcode, notes: m.notes, nextSteps: m.nextSteps },
    (v) => api(`/pocs/${pocId}/notebook/meetings/${m.id}`, { method: 'PATCH', body: v }),
    () => canFill,
  )
  const set = <K extends keyof typeof row>(k: K, v: (typeof row)[K]) => setRow((r) => ({ ...r, [k]: v }))
  const remove = async () => {
    if (!window.confirm(t('nb.deleteConfirm'))) return
    await track(api(`/pocs/${pocId}/notebook/meetings/${m.id}`, { method: 'DELETE' }))
    void qc.invalidateQueries({ queryKey: ['notebook', pocId] })
  }
  return (
    <li className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div className="grid items-end gap-2 sm:grid-cols-[10rem_1fr_9rem_auto]">
        <Field label={t('nb.meetingDate')}>
          <input className="input" type="date" disabled={!canFill} value={row.date ?? ''} onChange={(e) => set('date', e.target.value || null)} />
        </Field>
        <Field label={t('nb.meetingLink')}>
          <div className="flex gap-1">
            <input className="input" type="url" maxLength={1000} disabled={!canFill} value={row.link} onChange={(e) => set('link', e.target.value)} />
            {/^https?:\/\//.test(row.link) ? (
              <a className="btn-ghost px-2" href={row.link} target="_blank" rel="noopener noreferrer" aria-label={t('nb.meetingLink')}>
                ↗
              </a>
            ) : null}
          </div>
        </Field>
        <Field label={t('nb.passcode')}>
          <input className="input" maxLength={200} disabled={!canFill} value={row.passcode} onChange={(e) => set('passcode', e.target.value)} />
        </Field>
        {canFill ? (
          <button type="button" className="btn-ghost mb-0.5 px-2 text-red-600" title={t('nb.delete')} aria-label={t('nb.delete')} onClick={() => void remove()}>
            ✕
          </button>
        ) : (
          <span />
        )}
      </div>
      <Field label={t('nb.meetingNotes')}>
        <textarea className="input" rows={4} maxLength={20000} disabled={!canFill} value={row.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>
      <Field label={t('nb.nextSteps')}>
        <textarea className="input" rows={2} maxLength={4000} disabled={!canFill} value={row.nextSteps} onChange={(e) => set('nextSteps', e.target.value)} />
      </Field>
      <div className="text-right">
      </div>
    </li>
  )
}

const PROCESS_STYLE: Record<ProcessStatus, string> = {
  in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  na: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

interface Phase {
  head: ProcessRow | null
  rows: ProcessRow[]
  done: number
  total: number
}

/** Rows grouped under their phase; rows before the first phase form a group without a head. */
export function phasesOf(rows: ProcessRow[]): Phase[] {
  const phases: Phase[] = []
  for (const r of rows) {
    if (r.kind === 'phase' || phases.length === 0) phases.push({ head: r.kind === 'phase' ? r : null, rows: [], done: 0, total: 0 })
    const cur = phases[phases.length - 1]!
    if (r.kind === 'phase') continue
    cur.rows.push(r)
    // A hidden phase hides its whole section: its items do not count.
    if (r.kind === 'item' && !r.hidden && !cur.head?.hidden) {
      cur.total++
      if (r.status === 'completed' || r.status === 'na') cur.done++
    }
  }
  return phases
}

/** Which phases are open, remembered per PoC in this browser; by default the first one not finished. */
function useOpenPhases(pocId: string, phases: Phase[]) {
  const key = `nb-open-${pocId}`
  const [open, setOpen] = useState<Set<string> | null>(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved ? new Set(JSON.parse(saved) as string[]) : null
    } catch {
      return null
    }
  })
  const fallback = phases.find((p) => p.head && p.done < p.total)?.head?.id
  const current = open ?? new Set(fallback ? [fallback] : [])
  const save = (next: Set<string>) => {
    setOpen(next)
    try {
      localStorage.setItem(key, JSON.stringify([...next]))
    } catch {
      // Private window or storage blocked: the choice lasts until the page reloads.
    }
  }
  return {
    isOpen: (id: string) => current.has(id),
    toggle: (id: string) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      save(next)
    },
    all: (expand: boolean) => save(new Set(expand ? phases.flatMap((p) => (p.head ? [p.head.id] : [])) : [])),
  }
}

function ProcessSection({ pocId, nb, done, total }: { pocId: string; nb: NotebookView; done: number; total: number }) {
  const { t } = useI18n()
  const [showHidden, setShowHidden] = useState(false)
  // A hidden phase hides its whole section; "show hidden" brings both back into view.
  const phases = phasesOf(nb.process)
    .filter((ph) => showHidden || !ph.head?.hidden)
    .map((ph) => ({ ...ph, rows: ph.rows.filter((r) => showHidden || !r.hidden) }))
  const hiddenCount = nb.process.filter((p) => p.hidden).length
  const open = useOpenPhases(pocId, phases)
  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t('nb.process')}</h2>
          <p className="text-xs text-slate-500">{t('nb.progress', { done, total })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {nb.canShape && hiddenCount > 0 ? (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
              {t('nb.showHidden')} ({hiddenCount})
            </label>
          ) : null}
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => open.all(true)}>
            {t('nb.expandAll')}
          </button>
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => open.all(false)}>
            {t('nb.collapseAll')}
          </button>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full bg-green-600" style={{ width: total ? `${(done / total) * 100}%` : '0%' }} />
      </div>
      <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {phases.map((ph, i) => {
          const expanded = ph.head ? open.isOpen(ph.head.id) : true
          return (
            <div key={ph.head?.id ?? `lead-${i}`}>
              {ph.head ? (
                <ProcessItem pocId={pocId} p={ph.head} canFill={nb.canFill} canShape={nb.canShape} phase={{ expanded, done: ph.done, total: ph.total, onToggle: () => open.toggle(ph.head!.id) }} />
              ) : null}
              {expanded ? (
                <ul className="px-3 pb-2">
                  {ph.rows.map((p) => (
                    <ProcessItem key={p.id} pocId={pocId} p={p} canFill={nb.canFill} canShape={nb.canShape} />
                  ))}
                </ul>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ProcessItem({
  pocId,
  p,
  canFill,
  canShape,
  phase,
}: {
  pocId: string
  p: ProcessRow
  canFill: boolean
  canShape: boolean
  /** Set on a phase head: it opens and closes its phase. */
  phase?: { expanded: boolean; done: number; total: number; onToggle: () => void }
}) {
  const { t, locale } = useI18n()
  const qc = useQueryClient()
  const { track } = useSaveTracker()
  const [error, setError] = useState<string | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['notebook', pocId] })
  const patch = async (body: Record<string, unknown>) => {
    setError(null)
    try {
      await track(api(`/pocs/${pocId}/notebook/process/${p.id}`, { method: 'PATCH', body }))
      await refresh()
    } catch (err) {
      setError(t(errorKey(err)))
    }
  }
  const addBelow = async () => {
    const text = window.prompt(t('nb.newItemPrompt'))?.trim()
    if (!text) return
    // Written in the reader's language; pt-BR, the required one, gets the same text.
    await track(api(`/pocs/${pocId}/notebook/process`, { method: 'POST', body: { afterId: p.id, kind: 'item', text: { 'pt-BR': text, [locale]: text }, indent: 0 } }))
    await refresh()
  }
  const remove = async () => {
    if (!window.confirm(t(p.kind === 'phase' ? 'nb.deletePhaseConfirm' : 'nb.deleteConfirm'))) return
    await track(api(`/pocs/${pocId}/notebook/process/${p.id}`, { method: 'DELETE' }))
    await refresh()
  }
  const text = localText(p.text, locale)
  const tools = canShape ? (
    <span className="flex shrink-0 gap-1 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
      <button type="button" className="rounded px-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title={t('nb.addBelow')} aria-label={t('nb.addBelow')} onClick={() => void addBelow()}>
        +
      </button>
      <button type="button" className="rounded px-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => void patch({ hidden: !p.hidden })}>
        {p.hidden ? t('nb.show') : t('nb.hide')}
      </button>
      <button type="button" className="rounded px-1.5 text-xs text-red-600 hover:bg-red-50" title={t('nb.delete')} aria-label={t('nb.delete')} onClick={() => void remove()}>
        ✕
      </button>
    </span>
  ) : null
  const hidden = p.hidden ? <span className="ml-2 rounded bg-slate-200 px-1.5 text-[11px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">{t('nb.hiddenBadge')}</span> : null

  if (phase) {
    const complete = phase.total > 0 && phase.done === phase.total
    return (
      <div className={`group flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 ${p.hidden ? 'opacity-50' : ''}`}>
        <button type="button" className="flex flex-1 items-center gap-2 text-left" aria-expanded={phase.expanded} onClick={phase.onToggle}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" className={`shrink-0 text-slate-400 transition-transform ${phase.expanded ? 'rotate-90' : ''}`} aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
          <h3 className="flex-1 font-semibold text-slate-800 dark:text-slate-100">
            {text}
            {hidden}
          </h3>
          {phase.total > 0 ? (
            <span className={`rounded-full px-2 text-xs tabular-nums ${complete ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
              {complete ? '✓ ' : ''}
              {phase.done}/{phase.total}
            </span>
          ) : null}
        </button>
        {tools}
      </div>
    )
  }
  if (p.kind === 'group' || p.kind === 'note') {
    return (
      <li className={`group flex items-start gap-2 py-1 ${p.indent ? 'pl-6' : ''} ${p.hidden ? 'opacity-50' : ''}`}>
        <p className={`flex-1 whitespace-pre-line text-sm ${p.kind === 'group' ? 'pt-2 font-medium text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
          {p.indent ? '• ' : ''}
          {text}
          {hidden}
        </p>
        {tools}
      </li>
    )
  }
  return (
    <li className={`group flex items-start gap-3 border-b border-slate-100 py-1.5 last:border-0 dark:border-slate-800/60 ${p.indent ? 'pl-6' : ''} ${p.hidden ? 'opacity-50' : ''}`}>
      <select
        className={`w-36 shrink-0 rounded border-0 px-2 py-1 text-xs ${p.status ? PROCESS_STYLE[p.status] : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}
        aria-label={t('nb.status')}
        disabled={!canFill}
        value={p.status ?? ''}
        onChange={(e) => void patch({ status: e.target.value || null })}
      >
        <option value="">{t('nb.ps.none')}</option>
        {PROCESS_STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(`nb.ps.${s}`)}
          </option>
        ))}
      </select>
      <p className={`flex-1 pt-0.5 text-sm whitespace-pre-line ${p.status === 'completed' || p.status === 'na' ? 'text-slate-400 line-through decoration-slate-300' : ''}`}>
        {text}
        {hidden}
        {error ? <span className="ml-2 text-xs text-red-600">{error}</span> : null}
      </p>
      {tools}
    </li>
  )
}

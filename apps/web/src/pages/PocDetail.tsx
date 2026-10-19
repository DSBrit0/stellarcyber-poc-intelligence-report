import { DEAL_RESULTS, LOCALES, TEMPLATES, type DealResult, type Locale, type PocDetails, type StellarCredential, type Template } from '@poc-intel/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ApiError, api } from '../lib/api'
import { AutoTriageConfirm } from '../lib/AutoTriage'
import { CredentialFields } from '../lib/CredentialFields'
import { CustomerSelect } from '../lib/CustomerSelect'
import { errorKey } from '../lib/errors'
import { useMe } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { toReportImage } from '../lib/image'
import { PeriodFields, periodOk } from '../lib/PeriodFields'
import { PocForm } from '../lib/PocForm'
import { typedDetailsValid } from '../lib/TypedFields'
import { SyncBar, type SyncRow } from '../lib/SyncProgress'
import { NotebookTab } from './notebook/NotebookTab'
import { ExperienceTab, LiveExperienceBanner } from './experience/ExperienceTab'
import { LanguageSelect } from '../lib/LanguageSelect'
import { Select } from '../lib/Select'
import { useDialogs } from '../lib/dialogs'

interface PocView {
  id: string
  instanceUrl: string | null
  tenantName: string
  periodStart: string | null
  periodEnd: string | null
  /** The PoC Notebook's overview; null when the PoC has no Notebook. */
  notebook: { startDate: string } | null
  /** False while the PoC is only a Notebook: no Tenant or period yet (ADR 0010). */
  hasReportTarget: boolean
  details: PocDetails
  customerId: string | null
  customerName: string | null
  hasArchImage: boolean
  canEdit: boolean
  draft: boolean
  /** Set while the PoC is Closed (ADR 0016). */
  closedAt: string | null
  dealResult: DealResult | null
  /** When retention deletes the PoC: only a Closed PoC has one. */
  purgeAt: string | null
  retentionDays: number
  reports: ReportRow[]
  syncs: (Pick<SyncRow, 'id' | 'status' | 'progress' | 'error' | 'createdAt'> & { periodStart: string; periodEnd: string })[]
}

interface ReportRow {
  id: string
  createdAt: string
  /** Null while the PoC is Active: its Reports are kept. */
  expiresAt: string | null
  seq: number
  /** seq.minor: one minor version per Report comment. */
  version: string
  assetsAvg: number | null
  assetsPeak: number | null
  volumeGb: number | null
  cases: number | null
  alerts: number | null
  periodStart: string
  periodEnd: string
}

type Tab = 'notebook' | 'experience' | 'reports' | 'details' | 'sync'

export function PocDetailPage() {
  const { id = '' } = useParams()
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  // `?tab=experience`: a PoC just started from "Stellar Experience" opens on its Experiences.
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab | null>(params.get('tab') === 'experience' ? 'experience' : null)
  const { data: me } = useMe()
  const { data: poc } = useQuery({
    queryKey: ['poc', id],
    queryFn: () => api<PocView>(`/pocs/${id}`),
    refetchInterval: (q) => (q.state.data?.syncs.some((s) => s.status === 'queued' || s.status === 'running') ? 2000 : false),
  })
  if (!poc) return null
  const running = poc.syncs.find((x) => x.status === 'queued' || x.status === 'running')
  const latest = poc.syncs[0]
  // Partners never take part in a Stellar Experience (CONTEXT.md).
  const withExperience = Boolean(poc.notebook) && me != null && me.role !== 'partner'
  // A Notebook PoC opens on its Notebook until it has Reports; any other PoC on its Reports.
  const current: Tab = (tab === 'experience' && !withExperience ? null : tab) ?? (poc.notebook && poc.reports.length === 0 ? 'notebook' : 'reports')
  const back = () => setTab('reports')
  const tabs: Tab[] = withExperience ? ['notebook', 'experience', 'reports'] : ['notebook', 'reports']
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        {/* At least 16rem wide: on a phone the buttons wrap below instead of squeezing the title. */}
        <div className="min-w-[min(100%,16rem)] flex-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            {poc.details.customerName}
            {poc.draft ? <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">{t('poc.draft')}</span> : null}
            {poc.closedAt ? <ClosedBadge result={poc.dealResult} /> : null}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {[
              poc.hasReportTarget ? `${poc.tenantName} · ${poc.periodStart} → ${poc.periodEnd}` : null,
              poc.notebook ? t('poc.startsOn', { date: new Date(`${poc.notebook.startDate}T12:00:00`).toLocaleDateString(locale) }) : null,
              poc.customerName ? `${t('nav.customers')}: ${poc.customerName}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {poc.canEdit ? (
          <div className="flex flex-wrap gap-2">
            {poc.closedAt ? null : poc.hasReportTarget ? (
              <>
                <button className={current === 'sync' ? 'btn' : 'btn-ghost'} onClick={() => setTab(current === 'sync' ? 'reports' : 'sync')}>
                  {t('sync.new')}
                </button>
                <button className={current === 'details' ? 'btn' : 'btn-ghost'} onClick={() => setTab(current === 'details' ? 'reports' : 'details')}>
                  {t('poc.editDetails')}
                </button>
              </>
            ) : (
              <button className="btn" onClick={() => navigate(`/pocs/new?from=${poc.id}`)}>
                {t('nb.createReport')}
              </button>
            )}
            {poc.closedAt ? null : <ClosePocButton poc={poc} syncing={Boolean(running)} />}
            <DeletePocButton id={poc.id} syncing={Boolean(running)} />
          </div>
        ) : null}
      </div>
      {poc.closedAt ? <ClosedBanner poc={poc} /> : null}
      {withExperience ? <LiveExperienceBanner pocId={poc.id} /> : null}
      {poc.notebook ? (
        <nav className="flex gap-1 border-b border-slate-200 dark:border-slate-800" aria-label="PoC">
          {tabs.map((k) => (
            <button
              key={k}
              type="button"
              aria-current={current === k || (k === 'reports' && (current === 'details' || current === 'sync')) ? 'page' : undefined}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${current === k || (k === 'reports' && (current === 'details' || current === 'sync')) ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
              onClick={() => setTab(k)}
            >
              {t(k === 'notebook' ? 'tab.notebook' : k === 'experience' ? 'tab.experience' : 'tab.report')}
              {k === 'reports' && poc.reports.length > 0 ? <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-500 dark:bg-slate-800">{poc.reports.length}</span> : null}
            </button>
          ))}
        </nav>
      ) : null}
      {running || latest?.status === 'failed' || latest?.status === 'cancelled' ? <SyncBar sync={running ?? latest} canCancel={poc.canEdit} /> : null}
      {current === 'notebook' ? (
        <NotebookTab pocId={poc.id} />
      ) : current === 'experience' ? (
        <ExperienceTab pocId={poc.id} />
      ) : current === 'reports' ? (
        <ReportsTab poc={poc} />
      ) : current === 'details' ? (
        <DetailsTab poc={poc} onSaved={back} />
      ) : (
        <SyncTab poc={poc} onStarted={back} />
      )}
    </div>
  )
}

function Widget({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
      {sub ? <div className="text-[11px] text-slate-400">{sub}</div> : null}
    </div>
  )
}

function ReportsTab({ poc }: { poc: PocView }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  if (!poc.hasReportTarget) {
    return (
      <div className="card space-y-3">
        <p className="text-sm text-slate-500">{t('nb.createReportHelp')}</p>
        {poc.canEdit ? (
          <button className="btn" onClick={() => navigate(`/pocs/new?from=${poc.id}`)}>
            {t('nb.createReport')}
          </button>
        ) : null}
      </div>
    )
  }
  if (poc.reports.length === 0) return <p className="card text-sm text-slate-500">{t('report.empty')}</p>
  return (
    <ul className="space-y-3">
      {poc.reports.map((r) => (
        <ReportItem key={r.id} poc={poc} r={r} />
      ))}
    </ul>
  )
}

/** One Report per Sync: its own widgets, Template/language, open/present/PDF, comments and trash. */
function ReportItem({ poc, r }: { poc: PocView; r: ReportRow }) {
  const { t, locale } = useI18n()
  const [template, setTemplate] = useState<Template>('executive')
  const [lang, setLang] = useState<Locale>(locale)
  const [comments, setComments] = useState(false)
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale)
  const num = (n: number | null, digits = 0) => (n == null ? '—' : n.toLocaleString(locale, { maximumFractionDigits: digits }))
  const url = (kind: 'html' | 'pdf') => `/api/report-data/${r.id}/${kind}?template=${template}&locale=${lang}`
  return (
    <li className="card space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand" title={t('report.versionHelp')}>
          v{r.version}
        </span>
        <span className="font-medium">{date(r.createdAt)}</span>
        <span className="text-slate-500 dark:text-slate-400">
          {r.periodStart} → {r.periodEnd}
        </span>
        <span className="text-xs text-slate-400">{r.expiresAt ? t('report.expiresOn', { date: date(r.expiresAt) }) : t('report.keptWhileActive')}</span>
        {poc.canEdit ? (
          <span className="ml-auto">
            <DeleteReportButton pocId={poc.id} reportId={r.id} />
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Widget label={t('widget.assets')} value={num(r.assetsAvg)} sub={r.assetsPeak != null ? t('widget.assetsPeak', { n: num(r.assetsPeak) }) : undefined} />
        <Widget label={t('widget.ingestion')} value={r.volumeGb == null ? '—' : `${num(r.volumeGb, 2)} GB`} />
        <Widget label={t('widget.cases')} value={num(r.cases)} />
        <Widget label={t('widget.alerts')} value={num(r.alerts)} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select className="input w-auto py-1.5" value={template} onChange={(e) => setTemplate(e.target.value as Template)} aria-label="Template">
          {TEMPLATES.map((tpl) => (
            <option key={tpl} value={tpl}>
              {t(`template.${tpl}`)}
            </option>
          ))}
        </Select>
        <LanguageSelect value={lang} onChange={setLang} label={t('nav.language')} />
        <a className="btn" href={url('html')} target="_blank" rel="noopener">
          {t('report.open')}
        </a>
        <PdfButton url={url('pdf')} />
        <button className="btn-ghost" onClick={() => setComments(!comments)}>
          {t('report.comments')}
        </button>
      </div>
      {comments ? <Comments pocId={poc.id} reportId={r.id} version={r.version} /> : null}
    </li>
  )
}

interface CommentRow {
  id: string
  body: string
  kind: 'internal' | 'report'
  private: boolean
  createdAt: string
  author: string | null
}

/**
 * Comments on one Report. An internal comment stays in the app; a Report comment is a change note:
 * it makes a new minor version and is printed in the Report's version history (Appendix B).
 */
function Comments({ pocId, reportId, version }: { pocId: string; reportId: string; version: string }) {
  const { t, locale } = useI18n()
  const qc = useQueryClient()
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<CommentRow['kind']>('internal')
  const [isPrivate, setPrivate] = useState(false)
  const { data: me } = useMe()
  const staff = me != null && me.role !== 'customer'
  const [major, minor] = version.split('.').map(Number)
  const { data = [] } = useQuery({ queryKey: ['comments', reportId], queryFn: () => api<CommentRow[]>(`/report-data/${reportId}/comments`) })
  const add = useMutation({
    mutationFn: () => api(`/report-data/${reportId}/comments`, { method: 'POST', body: { body, kind, private: staff && kind === 'internal' && isPrivate } }),
    onSuccess: () => {
      setBody('')
      setPrivate(false)
      void qc.invalidateQueries({ queryKey: ['comments', reportId] })
      if (kind === 'report') void qc.invalidateQueries({ queryKey: ['poc', pocId] })
    },
  })
  return (
    <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
      {data.map((c) => (
        <div key={c.id} className="text-sm">
          <span className="font-medium">{c.author ?? '—'}</span>{' '}
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${c.kind === 'report' ? 'bg-brand/10 text-brand' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
            {t(c.kind === 'report' ? 'report.commentReport' : 'report.commentInternal')}
          </span>{' '}
          {c.private ? (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300" title={t('report.commentPrivateHelp')}>
              {t('report.commentPrivateBadge')}
            </span>
          ) : null}{' '}
          <span className="text-xs text-slate-500">{new Date(c.createdAt).toLocaleString(locale)}</span>
          <p className="whitespace-pre-wrap">{c.body}</p>
        </div>
      ))}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (body.trim()) add.mutate()
        }}
      >
        <div className="flex flex-wrap gap-4 text-sm" role="radiogroup" aria-label={t('report.commentType')}>
          {(['internal', 'report'] as const).map((k) => (
            <label key={k} className="flex items-center gap-2">
              <input type="radio" name={`comment-kind-${reportId}`} checked={kind === k} onChange={() => setKind(k)} />
              {t(k === 'report' ? 'report.commentReport' : 'report.commentInternal')}
            </label>
          ))}
        </div>
        {staff && kind === 'internal' ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} />
            {t('report.commentPrivate')}
          </label>
        ) : null}
        <p className="text-xs text-slate-500">{kind === 'internal' && staff && isPrivate ? t('report.commentPrivateHelp') : kind === 'report' ? t('report.commentReportHelp', { v: `${major}.${(minor ?? 0) + 1}` }) : t('report.commentInternalHelp')}</p>
        <div className="flex gap-2">
          <textarea className="input" rows={2} maxLength={4000} placeholder={t('report.addComment')} value={body} onChange={(e) => setBody(e.target.value)} />
          <button className="btn self-end" disabled={add.isPending || !body.trim()}>
            {t('report.send')}
          </button>
        </div>
      </form>
    </div>
  )
}

function DetailsTab({ poc, onSaved }: { poc: PocView; onSaved: () => void }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [details, setDetails] = useState<PocDetails>(poc.details)
  const [customerId, setCustomerId] = useState<string | null>(poc.customerId)
  const [saved, setSaved] = useState(false)
  useEffect(() => setDetails(poc.details), [poc.details])
  const save = useMutation({
    mutationFn: () => api(`/pocs/${poc.id}`, { method: 'PATCH', body: { customerId, finalize: true, details: { ...details, analysts: details.analysts.map((a) => a.trim()).filter(Boolean) } } }),
    onSuccess: () => {
      setSaved(true)
      void qc.invalidateQueries({ queryKey: ['poc', poc.id] })
      onSaved()
    },
  })
  const image = useMutation({
    mutationFn: async (file: File | null) => api(`/pocs/${poc.id}/arch-image`, { method: 'PUT', body: { dataUrl: file ? await toReportImage(file) : null } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['poc', poc.id] }),
  })
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        setSaved(false)
        save.mutate()
      }}
    >
      <div className="card">
        <CustomerSelect value={customerId} onChange={setCustomerId} />
      </div>
      <div className="card">
        <PocForm value={details} onChange={setDetails} autoTriageNote={t('form.aiTriageNextSync')} criteriaInNotebook={poc.notebook != null} />
      </div>
      <section className="card space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('form.sectionArch')}</h3>
        {poc.hasArchImage ? <img src={`/api/pocs/${poc.id}/arch-image?v=${Date.now()}`} alt="" className="max-h-64 rounded border border-slate-200 dark:border-slate-700" /> : null}
        <div className="flex flex-wrap gap-3">
          <label className="btn-ghost cursor-pointer">
            {t('form.archUpload')}
            <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => e.target.files?.[0] && image.mutate(e.target.files[0])} />
          </label>
          {poc.hasArchImage ? (
            <button type="button" className="btn-ghost" onClick={() => image.mutate(null)}>
              {t('form.archRemove')}
            </button>
          ) : null}
        </div>
        {image.error ? <p className="text-sm text-red-600">{t(errorKey(image.error))}</p> : null}
      </section>
      <div className="flex items-center gap-3">
        <button className="btn" disabled={save.isPending || !typedDetailsValid(details)}>
          {t('common.save')}
        </button>
        {!typedDetailsValid(details) ? <span className="text-sm text-red-600">{t('field.fixToSave')}</span> : null}
        {saved ? <span className="text-sm text-green-600">{t('form.saved')}</span> : null}
        {save.error ? <span className="text-sm text-red-600">{t(errorKey(save.error))}</span> : null}
      </div>
    </form>
  )
}

function SyncTab({ poc: view, onStarted }: { poc: PocView; onStarted: () => void }) {
  // Only reachable with a Report target (the buttons are hidden without one).
  const poc = { ...view, instanceUrl: view.instanceUrl ?? '', periodStart: view.periodStart ?? '', periodEnd: view.periodEnd ?? '' }
  const { t, locale } = useI18n()
  const qc = useQueryClient()
  const remembered = useQuery({ queryKey: ['remembered'], queryFn: () => api<{ instanceUrl: string }[]>('/stellar/credentials') })
  const stored = (remembered.data ?? []).some((r) => r.instanceUrl === poc.instanceUrl)
  const [useStored, setUseStored] = useState(true)
  const [remember, setRemember] = useState(true)
  const [credential, setCredential] = useState<StellarCredential>({ method: 'apiKey', apiKey: '' })
  // The PoC's period by default; other dates re-run the Report for that period only.
  const [period, setPeriod] = useState({ start: poc.periodStart, end: poc.periodEnd })
  const custom = period.start !== poc.periodStart || period.end !== poc.periodEnd
  const running = poc.syncs.some((s) => s.status === 'queued' || s.status === 'running')
  const sync = useMutation({
    mutationFn: () =>
      api(`/pocs/${poc.id}/syncs`, {
        method: 'POST',
        body: { ...(stored && useStored ? {} : { credential, remember }), ...(custom ? { period } : {}) },
      }),
    onSuccess: () => {
      setCredential(credential.method === 'apiKey' ? { method: 'apiKey', apiKey: '' } : { method: 'basic', username: '', token: '' })
      void qc.invalidateQueries({ queryKey: ['poc', poc.id] })
      void remembered.refetch()
      onStarted()
    },
  })
  // A Sync that collects Auto Triage is confirmed again before it starts.
  const [confirming, setConfirming] = useState(false)
  const start = () => (poc.details.aiTriageTested ? setConfirming(true) : sync.mutate())
  return (
    <section className="card space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">{poc.instanceUrl}</p>
      {stored && useStored ? (
        <p className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded bg-green-100 px-2 py-1 text-green-800 dark:bg-green-950 dark:text-green-300">✓ {t('wiz.remembered')}</span>
          <button type="button" className="text-brand underline" onClick={() => setUseStored(false)}>
            {t('wiz.useOther')}
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
      <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <h3 className="text-sm font-semibold">{t('sync.periodTitle')}</h3>
        <PeriodFields start={period.start} end={period.end} onChange={(start, end) => setPeriod({ start, end })} />
        <p className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {custom ? t('sync.periodCustom') : t('sync.periodDefault')}
          {custom ? (
            <button type="button" className="text-brand underline" onClick={() => setPeriod({ start: poc.periodStart, end: poc.periodEnd })}>
              {t('sync.periodReset')}
            </button>
          ) : null}
        </p>
      </div>
      <button className="btn" disabled={sync.isPending || running || !periodOk(period.start, period.end)} onClick={start}>
        {t('wiz.runSync')}
      </button>
      {confirming ? (
        <AutoTriageConfirm
          onConfirm={() => {
            setConfirming(false)
            sync.mutate()
          }}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
      {sync.error ? <p className="text-sm text-red-600">{t(errorKey(sync.error))}</p> : null}
      {/* Sync history as a grid, so the columns line up; on a phone each Sync takes two lines. */}
      <ul className="divide-y divide-slate-100 border-t border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-800">
        {poc.syncs.map((s) => (
          <li key={s.id} className="grid grid-cols-[auto_1fr] gap-x-3 py-1.5 sm:grid-cols-[11rem_7rem_13rem_1fr]">
            <span className="tabular-nums">{new Date(s.createdAt).toLocaleString(locale)}</span>
            <span className="font-medium">{t(`sync.status.${s.status}`)}</span>
            <span className="tabular-nums text-slate-500 dark:text-slate-400">
              {s.periodStart} → {s.periodEnd}
            </span>
            {s.error && s.status === 'failed' ? <span className="text-red-600 dark:text-red-400">{t(errorKey(new ApiError(500, `stellar_${s.error}`)))}</span> : <span />}
          </li>
        ))}
      </ul>
    </section>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
    </svg>
  )
}

/** Permanent deletion of one Report (Report Data, PDFs, comments, its Sync). */
function DeleteReportButton({ pocId, reportId }: { pocId: string; reportId: string }) {
  const { t } = useI18n()
  const { confirm } = useDialogs()
  const qc = useQueryClient()
  const del = useMutation({
    mutationFn: () => api(`/report-data/${reportId}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['poc', pocId] }),
  })
  return (
    <button
      className="btn-ghost text-red-600 hover:bg-red-50"
      title={t('report.delete')}
      aria-label={t('report.delete')}
      disabled={del.isPending}
      onClick={async () => (await confirm(t('report.deleteConfirm'), { danger: true })) && del.mutate()}
    >
      <TrashIcon />
    </button>
  )
}

/** Permanent deletion of the whole PoC and everything it holds. */
function DeletePocButton({ id, syncing }: { id: string; syncing: boolean }) {
  const { t } = useI18n()
  const { confirm, alert } = useDialogs()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const del = useMutation({
    mutationFn: () => api(`/pocs/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pocs'] })
      navigate('/')
    },
    onError: (err) => {
      void alert(t(errorKey(err, { sync_in_progress: 'poc.deleteBlocked' })))
      void qc.invalidateQueries({ queryKey: ['poc', id] })
    },
  })
  return (
    <button
      className="btn-ghost text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      title={syncing ? t('poc.deleteBlocked') : t('poc.delete')}
      aria-label={t('poc.delete')}
      disabled={del.isPending || syncing}
      onClick={async () => (await confirm(t('poc.deleteConfirm'), { danger: true })) && del.mutate()}
    >
      <TrashIcon />
      <span className="hidden sm:inline">{t('poc.delete')}</span>
    </button>
  )
}

export function ClosedBadge({ result }: { result: DealResult | null }) {
  const { t } = useI18n()
  const tone =
    result === 'won'
      ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
      : result === 'lost'
        ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
        : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tone}`}>
      {t('poc.closed')}
      {result ? ` · ${t(`poc.deal.${result}`)}` : ''}
    </span>
  )
}

/** A Closed PoC: when it closed, how it ended, when retention deletes it, and Reopen for its editors. */
function ClosedBanner({ poc }: { poc: PocView }) {
  const { t, locale } = useI18n()
  const { alert } = useDialogs()
  const qc = useQueryClient()
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale)
  const reopen = useMutation({
    mutationFn: () => api(`/pocs/${poc.id}/reopen`, { method: 'POST', body: {} }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['poc', poc.id] }),
    onError: (err) => void alert(t(errorKey(err))),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['pocs'] }),
  })
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/50">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{t('poc.closedBanner', { date: date(poc.closedAt!), result: poc.dealResult ? t(`poc.deal.${poc.dealResult}`) : '—' })}</div>
        {poc.purgeAt ? <div className="text-xs text-slate-500 dark:text-slate-400">{t('poc.purgeOn', { date: date(poc.purgeAt) })}</div> : null}
      </div>
      {poc.canEdit ? (
        <button className="btn-ghost" disabled={reopen.isPending} onClick={() => reopen.mutate()}>
          {t('poc.reopen')}
        </button>
      ) : null}
    </div>
  )
}

/** Closes the PoC with its Deal Result, after saying when retention will delete it. */
function ClosePocButton({ poc, syncing }: { poc: PocView; syncing: boolean }) {
  const { t, locale } = useI18n()
  const { alert } = useDialogs()
  const qc = useQueryClient()
  const ref = useRef<HTMLDialogElement>(null)
  const [result, setResult] = useState<DealResult | null>(null)
  const purgeOn = new Date(Date.now() + poc.retentionDays * 86_400_000).toLocaleDateString(locale)
  const close = useMutation({
    mutationFn: (dealResult: DealResult) => api(`/pocs/${poc.id}/close`, { method: 'POST', body: { dealResult } }),
    onSuccess: () => {
      ref.current?.close()
      void qc.invalidateQueries({ queryKey: ['poc', poc.id] })
    },
    onError: (err) => {
      ref.current?.close()
      void alert(t(errorKey(err)))
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['pocs'] }),
  })
  return (
    <>
      <button
        className="btn-ghost disabled:cursor-not-allowed disabled:opacity-40"
        disabled={syncing}
        title={syncing ? t('err.sync_in_progress') : undefined}
        onClick={() => {
          setResult(null)
          ref.current?.showModal()
        }}
      >
        {t('poc.close')}
      </button>
      <dialog ref={ref} aria-labelledby="close-poc-title" onClick={(e) => e.target === e.currentTarget && ref.current?.close()} className="dialog-panel max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (result) close.mutate(result)
          }}
        >
          <div className="space-y-4 px-6 pt-6">
            <h2 id="close-poc-title" className="text-base font-semibold">
              {t('poc.closeTitle')}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">{t('poc.closeHelp', { date: purgeOn, days: poc.retentionDays })}</p>
            <fieldset>
              <legend className="label mb-2">{t('poc.dealResult')}</legend>
              <div className="grid grid-cols-3 gap-2">
                {DEAL_RESULTS.map((r) => (
                  <label
                    key={r}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${result === r ? 'border-brand bg-brand/10 text-brand' : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'}`}
                  >
                    <input type="radio" name="deal-result" value={r} className="sr-only" checked={result === r} onChange={() => setResult(r)} />
                    {t(`poc.deal.${r}`)}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end dark:border-slate-800 dark:bg-slate-800/40">
            <button type="button" className="btn-ghost" onClick={() => ref.current?.close()}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn" disabled={!result || close.isPending}>
              {t('poc.close')}
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}

/**
 * Downloads the PDF in place: the button says it is generating, the file is saved when ready, and a
 * failure shows next to the button instead of an error page.
 */
function PdfButton({ url }: { url: string }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const download = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, { credentials: 'same-origin' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new ApiError(res.status, body.error ?? 'unknown')
      }
      const name = /filename\*=UTF-8''([^;]+)/.exec(res.headers.get('content-disposition') ?? '')?.[1]
      const href = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = href
      a.download = name ? decodeURIComponent(name) : 'report.pdf'
      a.click()
      setTimeout(() => URL.revokeObjectURL(href), 10_000)
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button type="button" className="btn-ghost inline-flex items-center gap-2" disabled={busy} aria-busy={busy} onClick={() => void download()}>
        {busy ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" aria-hidden="true" /> : null}
        {busy ? t('report.pdfGenerating') : t('report.pdf')}
      </button>
      {error ? (
        <span role="alert" className="basis-full text-sm text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </>
  )
}

import { LOCALES, MILESTONE_TONES, type I18nText, type Locale, type MilestoneTone, type ProcessKind } from '@poc-intel/shared'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../lib/api'
import { errorKey } from '../../lib/errors'
import { useI18n } from '../../lib/i18n'
import { SaveIndicator, SaveProvider, useLiveAutosave, useSaveTracker } from '../notebook/saving'
import { Select } from '../../lib/Select'
import { useDialogs } from '../../lib/dialogs'

interface TemplateRow {
  id: string
  section: 'process' | 'schedule'
  kind: ProcessKind | 'milestone'
  position: number
  indent: number
  text: I18nText
  hidden: boolean
  days: number | null
  tone: MilestoneTone | null
  key: string | null
}
interface Template {
  process: TemplateRow[]
  schedule: TemplateRow[]
}

const QUERY = ['admin', 'template'] as const
const KIND_STYLE: Record<TemplateRow['kind'], string> = {
  phase: 'bg-brand/10 text-brand',
  group: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  item: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  note: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  milestone: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
}
const TONE: Record<MilestoneTone, string> = { start: 'bg-green-500', pre: 'bg-blue-500', poc: 'bg-amber-400', close: 'bg-violet-500' }

/**
 * Admin: the Notebook Template (ADR 0012), the PoC Process and PoC Schedule a new PoC Notebook starts
 * from. Only pt-BR is required; en and es fall back to it. Notebooks already started keep their copy.
 */
export function TemplatePage() {
  const { t } = useI18n()
  const [tab, setTab] = useState<'process' | 'schedule'>('process')
  const { data, error } = useQuery({ queryKey: QUERY, queryFn: () => api<Template>('/admin/template') })
  return (
    <SaveProvider queryKey={QUERY}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm">
              <Link to="/admin" className="text-brand hover:underline">
                ← {t('nav.admin')}
              </Link>
            </p>
            <h1 className="text-xl font-semibold">{t('tpl.title')}</h1>
            <p className="max-w-3xl text-sm text-slate-500">{t('tpl.help')}</p>
          </div>
          <SaveIndicator />
        </div>
        <nav className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
          {(['process', 'schedule'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-current={tab === k ? 'page' : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? 'border-brand font-semibold text-brand' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
              onClick={() => setTab(k)}
            >
              {t(k === 'process' ? 'nb.process' : 'nb.schedule')}
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-[11px] font-normal text-slate-500 dark:bg-slate-800">{data?.[k].length ?? 0}</span>
            </button>
          ))}
        </nav>
        {error ? <p className="card text-sm text-red-600">{t(errorKey(error))}</p> : null}
        {data ? tab === 'process' ? <ProcessTemplate data={data} /> : <ScheduleTemplate data={data} /> : null}
      </div>
    </SaveProvider>
  )
}

/** Process rows grouped under their phase, each phase opening and closing. */
function ProcessTemplate({ data }: { data: Template }) {
  const { t, locale } = useI18n()
  const [open, setOpen] = useState<Set<string>>(new Set())
  const groups: { head: TemplateRow | null; rows: TemplateRow[] }[] = []
  for (const r of data.process) {
    if (r.kind === 'phase' || groups.length === 0) groups.push({ head: r.kind === 'phase' ? r : null, rows: [] })
    if (r.kind !== 'phase') groups[groups.length - 1]!.rows.push(r)
  }
  const milestoneOf = (key: string | null) => (key ? data.schedule.find((m) => m.key === key) : undefined)
  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap justify-end gap-2 text-xs">
        <button type="button" className="btn-ghost px-2 py-1" onClick={() => setOpen(new Set(groups.flatMap((g) => (g.head ? [g.head.id] : []))))}>
          {t('nb.expandAll')}
        </button>
        <button type="button" className="btn-ghost px-2 py-1" onClick={() => setOpen(new Set())}>
          {t('nb.collapseAll')}
        </button>
      </div>
      <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {groups.map((g, i) => {
          const expanded = g.head ? open.has(g.head.id) : true
          const milestone = milestoneOf(g.head?.key ?? null)
          return (
            <div key={g.head?.id ?? `lead-${i}`}>
              {g.head ? (
                <div className={`flex items-start gap-2 px-3 py-2 ${g.head.hidden ? 'opacity-50' : ''}`}>
                  <button
                    type="button"
                    className="mt-2 text-slate-400"
                    aria-expanded={expanded}
                    aria-label={g.head.text['pt-BR']}
                    onClick={() => {
                      const next = new Set(open)
                      if (next.has(g.head!.id)) next.delete(g.head!.id)
                      else next.add(g.head!.id)
                      setOpen(next)
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${expanded ? 'rotate-90' : ''}`} aria-hidden="true">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </button>
                  <div className="min-w-0 flex-1 space-y-1">
                    <RowEditor row={g.head} />
                    <p className="text-xs text-slate-500">
                      {milestone ? t('tpl.linkedMilestone', { name: milestone.text[locale]?.trim() || milestone.text['pt-BR'] }) : t('tpl.noMilestone')} · {t('tpl.itemsCount', { n: g.rows.filter((r) => r.kind === 'item').length })}
                    </p>
                  </div>
                </div>
              ) : null}
              {expanded ? (
                <ul className="space-y-1 px-3 pb-3 pl-9">
                  {g.rows.map((r) => (
                    <li key={r.id} className={r.indent ? 'pl-6' : ''}>
                      <RowEditor row={r} />
                    </li>
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

function ScheduleTemplate({ data }: { data: Template }) {
  const { t, locale } = useI18n()
  const phaseOf = (key: string | null) => (key ? data.process.find((p) => p.kind === 'phase' && p.key === key) : undefined)
  return (
    <section className="card space-y-3">
      <p className="text-sm text-slate-500">{t('tpl.scheduleHelp')}</p>
      <ul className="space-y-2">
        {data.schedule.map((m) => {
          const phase = phaseOf(m.key)
          return (
            <li key={m.id} className="space-y-1 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <RowEditor row={m} />
              <p className="text-xs text-slate-500">
                {m.key === 'start' ? t('tpl.startMilestone') : phase ? t('tpl.linkedPhase', { name: phase.text[locale]?.trim() || phase.text['pt-BR'] }) : t('tpl.noPhase')}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** One template row: its text in the three languages, saved as typed, and its actions. */
function RowEditor({ row }: { row: TemplateRow }) {
  const { t } = useI18n()
  const { confirm, prompt } = useDialogs()
  const { track } = useSaveTracker()
  const [error, setError] = useState<string | null>(null)
  const [langs, setLangs] = useState(false)
  const [text, setText] = useLiveAutosave(row.text, (v) => api(`/admin/template/${row.id}`, { method: 'PATCH', body: { text: v } }), (v) => v['pt-BR'].trim() !== '')
  const act = async (p: Promise<unknown>) => {
    setError(null)
    try {
      await track(p)
    } catch (err) {
      setError(t(errorKey(err)))
    }
  }
  const patch = (body: Record<string, unknown>) => act(api(`/admin/template/${row.id}`, { method: 'PATCH', body }))
  const add = async () => {
    const value = (await prompt(t(row.section === 'schedule' ? 'sch.newMilestone' : 'nb.newItemPrompt')))?.trim()
    if (!value) return
    const kind = row.section === 'schedule' ? 'milestone' : row.kind === 'phase' ? 'item' : row.kind
    await act(api('/admin/template', { method: 'POST', body: { section: row.section, afterId: row.id, kind, text: { 'pt-BR': value }, indent: row.kind === 'phase' ? 0 : row.indent } }))
  }
  const addPhase = async () => {
    const value = (await prompt(t('tpl.newPhase')))?.trim()
    if (!value) return
    await act(api('/admin/template', { method: 'POST', body: { section: 'process', afterId: row.id, kind: 'phase', text: { 'pt-BR': value }, withMilestone: true } }))
  }
  const remove = async () => {
    if (!(await confirm(t(row.kind === 'phase' ? 'tpl.deletePhaseConfirm' : 'nb.deleteConfirm'), { danger: true }))) return
    await act(api(`/admin/template/${row.id}`, { method: 'DELETE' }))
  }
  const move = (direction: 'up' | 'down') => act(api(`/admin/template/${row.id}/move`, { method: 'POST', body: { direction } }))
  const btn = 'rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
  return (
    <div className={`space-y-1 ${row.hidden ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`shrink-0 rounded px-1.5 text-[11px] font-medium ${KIND_STYLE[row.kind]}`}>{t(`tpl.kind.${row.kind}`)}</span>
        {row.kind === 'milestone' && row.tone ? <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${TONE[row.tone]}`} aria-hidden="true" /> : null}
        <textarea
          className={`input min-h-0 flex-1 py-1 text-sm ${row.kind === 'phase' ? 'font-semibold' : ''}`}
          rows={1}
          aria-label="pt-BR"
          value={text['pt-BR']}
          onChange={(e) => setText((x) => ({ ...x, 'pt-BR': e.target.value }))}
        />
        <span className="flex shrink-0 flex-wrap gap-0.5">
          <button type="button" className={btn} onClick={() => setLangs(!langs)} aria-expanded={langs}>
            {t('tpl.languages')}
          </button>
          <button type="button" className={btn} title={t('tpl.up')} aria-label={t('tpl.up')} onClick={() => void move('up')}>
            ↑
          </button>
          <button type="button" className={btn} title={t('tpl.down')} aria-label={t('tpl.down')} onClick={() => void move('down')}>
            ↓
          </button>
          <button type="button" className={btn} onClick={() => void patch({ hidden: !row.hidden })}>
            {row.hidden ? t('nb.show') : t('tpl.hide')}
          </button>
          <button type="button" className={btn} title={t('nb.addBelow')} aria-label={t('nb.addBelow')} onClick={() => void add()}>
            +
          </button>
          {row.kind === 'phase' ? (
            <button type="button" className={btn} onClick={() => void addPhase()}>
              {t('tpl.addPhase')}
            </button>
          ) : null}
          <button type="button" className={`${btn} text-red-600 hover:bg-red-50`} title={t('nb.delete')} aria-label={t('nb.delete')} onClick={() => void remove()}>
            ✕
          </button>
        </span>
      </div>
      {langs ? (
        <div className="grid gap-2 pl-2 sm:grid-cols-2">
          {LOCALES.filter((l): l is Exclude<Locale, 'pt-BR'> => l !== 'pt-BR').map((l) => (
            <label key={l} className="block">
              <span className="label">{l}</span>
              <textarea className="input min-h-0 py-1 text-sm" rows={1} placeholder={t('tpl.fallback')} value={text[l]} onChange={(e) => setText((x) => ({ ...x, [l]: e.target.value }))} />
            </label>
          ))}
          {row.kind === 'milestone' ? (
            <>
              <label className="block">
                <span className="label">{t('tpl.tone')}</span>
                <Select className="input py-1 text-sm" value={row.tone ?? 'poc'} onChange={(e) => void patch({ tone: e.target.value })}>
                  {MILESTONE_TONES.map((tone) => (
                    <option key={tone} value={tone}>
                      {t(`sch.tone.${tone}`)}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="label">{t('tpl.cadence')}</span>
                <input className="input py-1 text-sm" type="number" min={0} max={60} defaultValue={row.days ?? 2} onBlur={(e) => void patch({ days: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })} />
              </label>
            </>
          ) : null}
        </div>
      ) : null}
      {text['pt-BR'].trim() === '' ? <p className="text-xs text-red-600">{t('tpl.ptRequired')}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

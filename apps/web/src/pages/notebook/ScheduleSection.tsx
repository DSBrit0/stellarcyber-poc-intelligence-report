import { MAX_POC_DAYS, computeSchedule, daysBetween, type I18nText, type Locale, type MilestoneTone } from '@poc-intel/shared'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { useLiveAutosave, useSaveTracker } from './saving'
import { useDialogs } from '../../lib/dialogs'

export interface Milestone {
  id: string
  key: string | null
  text: I18nText
  days: number
  tone: MilestoneTone
  dateOverride: string | null
  /** The PoC Process phase it stands for. */
  phaseId: string | null
}

/** The state of each PoC Process phase, by id: a hidden phase hides its milestone; a done one marks it done. */
export type PhaseState = Map<string, { hidden: boolean; done: boolean }>

const localText = (text: I18nText, locale: Locale) => text[locale]?.trim() || text['pt-BR']

const TONE: Record<MilestoneTone, string> = {
  start: 'bg-green-500',
  pre: 'bg-blue-500',
  poc: 'bg-amber-400',
  close: 'bg-violet-500',
}
const MIN_DAY_PX = 28
const LABEL_PX = 256

const isoAdd = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const dateOf = (iso: string) => new Date(`${iso}T12:00:00Z`)

/**
 * The Report period a Notebook suggests: from the Kickoff meeting to the Post-PoC Closeout, at most
 * MAX_POC_DAYS long and ending yesterday at the latest (a Sync needs past days). Null when unknown.
 */
export function suggestedPeriod(startDate: string, milestones: Milestone[]): { start: string; end: string } | null {
  const { dates } = computeSchedule(startDate, milestones)
  const at = (key: string) => {
    const i = milestones.findIndex((m) => m.key === key)
    return i >= 0 ? dates[i] : undefined
  }
  const start = at('kickoff')
  let end = at('closeout')
  if (!start || !end) return null
  const yesterday = isoAdd(new Date().toISOString().slice(0, 10), -1)
  if (daysBetween(start, end) > MAX_POC_DAYS) end = isoAdd(start, MAX_POC_DAYS - 1)
  if (end > yesterday) end = yesterday
  return end >= start ? { start, end } : null
}

/** The PoC Schedule: milestones computed from the PoC start date, as a timeline. */
export function ScheduleSection({
  pocId,
  startDate,
  milestones: all,
  phaseState,
  canShape,
}: {
  pocId: string
  startDate: string
  milestones: Milestone[]
  phaseState: PhaseState
  canShape: boolean
}) {
  const { t, locale } = useI18n()
  const { prompt } = useDialogs()
  const { track } = useSaveTracker()
  const [editing, setEditing] = useState(false)
  // A milestone whose PoC Process phase is hidden leaves the schedule with it.
  const milestones = all.filter((m) => !m.phaseId || !phaseState.get(m.phaseId)?.hidden)
  const { dates, completion } = computeSchedule(startDate, milestones)
  // The days stretch to fill the width; below MIN_DAY_PX the timeline scrolls sideways.
  const [width, setWidth] = useState(0)
  const observer = useRef<ResizeObserver | null>(null)
  const measure = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect()
    if (!el) return
    observer.current = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width))
    observer.current.observe(el)
  }, [])
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }) => dateOf(iso).toLocaleDateString(locale, { timeZone: 'UTC', ...opts })
  const first = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : startDate
  const last = [completion, ...dates].reduce((a, b) => (a > b ? a : b))
  const total = Math.max(1, daysBetween(first, last))
  const DAY_PX = Math.max(MIN_DAY_PX, Math.floor((width - LABEL_PX) / total))
  const statusOf = (m: Milestone, date: string) => {
    if (!m.phaseId) return null
    if (phaseState.get(m.phaseId)?.done) return 'done' as const
    return date < new Date().toISOString().slice(0, 10) ? ('late' as const) : null
  }
  const days = Array.from({ length: total }, (_, i) => isoAdd(first, i))
  const today = new Date().toISOString().slice(0, 10)
  const period = suggestedPeriod(startDate, milestones)
  const months = days.reduce<{ label: string; span: number }[]>((acc, d) => {
    const label = fmt(d, { month: 'long', year: 'numeric' })
    const lastMonth = acc[acc.length - 1]
    if (lastMonth?.label === label) lastMonth.span++
    else acc.push({ label, span: 1 })
    return acc
  }, [])

  const addBelow = async (afterId: string | null) => {
    const text = (await prompt(t('sch.newMilestone')))?.trim()
    if (!text) return
    await track(api(`/pocs/${pocId}/notebook/milestones`, { method: 'POST', body: { afterId, text: { 'pt-BR': text, [locale]: text }, days: 2 } }))
  }

  return (
    // On wide screens the schedule takes the whole width, 4 cm from each edge of the window.
    <section className="card ml-[min(0px,calc(50%-50vw+4cm))] w-[max(100%,calc(100vw-8cm))] space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="font-semibold">{t('nb.schedule')}</h2>
          <p className="text-sm text-slate-500">
            {t('sch.summary', { start: fmt(startDate, { day: '2-digit', month: 'short', year: 'numeric' }), end: fmt(completion, { day: '2-digit', month: 'short', year: 'numeric' }), n: milestones.length })}
          </p>
          {period ? <p className="text-xs text-slate-500">{t('sch.reportPeriod', { start: fmt(period.start), end: fmt(period.end) })}</p> : null}
        </div>
        {canShape ? (
          <button type="button" className={editing ? 'btn' : 'btn-ghost'} onClick={() => setEditing(!editing)}>
            {editing ? t('sch.doneEditing') : t('sch.edit')}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        {(['start', 'pre', 'poc', 'close'] as const).map((tone) => (
          <span key={tone} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${TONE[tone]}`} aria-hidden="true" />
            {t(`sch.tone.${tone}`)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="text-green-700 dark:text-green-400">✓</span>
          {t('sch.done')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm ring-2 ring-red-500" aria-hidden="true" />
          {t('sch.late')}
        </span>
      </div>

      {editing ? (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {milestones.map((m, i) => (
            <MilestoneEditor key={m.id} pocId={pocId} m={m} computed={dates[i]!} onAddBelow={() => void addBelow(m.id)} />
          ))}
        </ul>
      ) : (
        <div ref={measure} className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="grid min-w-max text-xs" style={{ gridTemplateColumns: `${LABEL_PX}px repeat(${total}, ${DAY_PX}px)` }}>
            {/* Months */}
            <div className="sticky left-0 z-10 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
            {months.map((m, i) => (
              <div key={i} className="border-b border-l border-slate-200 px-1 py-1 font-medium capitalize dark:border-slate-800" style={{ gridColumn: `span ${m.span}` }}>
                {m.label}
              </div>
            ))}
            {/* Days */}
            <div className="sticky left-0 z-10 border-b border-slate-200 bg-white px-3 py-1 font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900">{t('sch.milestone')}</div>
            {days.map((d) => {
              const dow = dateOf(d).getUTCDay()
              return (
                <div key={d} className={`border-b border-l border-slate-200 py-1 text-center dark:border-slate-800 ${dow === 0 || dow === 6 ? 'bg-slate-100 text-slate-400 dark:bg-slate-800/60' : ''} ${d === today ? 'font-bold text-brand' : ''}`}>
                  <div className="text-[10px] uppercase">{fmt(d, { weekday: 'narrow' })}</div>
                  <div>{fmt(d, { day: 'numeric' })}</div>
                </div>
              )
            })}
            {/* One row per milestone */}
            {milestones.map((m, i) => {
              // daysBetween counts both ends, so it is already the 1-based day column of the date.
              const column = daysBetween(first, dates[i]!)
              const status = statusOf(m, dates[i]!)
              return (
                <Row
                  key={m.id}
                  label={localText(m.text, locale)}
                  sub={fmt(dates[i]!, { weekday: 'short', day: '2-digit', month: 'short' })}
                  status={status}
                  days={days}
                  dayPx={DAY_PX}
                  today={today}
                >
                  <div
                    className={`relative col-span-1 my-1.5 flex h-5 items-center justify-center rounded text-[11px] font-bold text-white ${TONE[m.tone]} ${status === 'late' ? 'ring-2 ring-red-500 ring-offset-1' : ''}`}
                    style={{ gridColumnStart: column }}
                    title={`${localText(m.text, locale)} · ${fmt(dates[i]!)}${status ? ` · ${t(status === 'done' ? 'sch.done' : 'sch.late')}` : ''}`}
                  >
                    {status === 'done' ? '✓' : ''}
                  </div>
                </Row>
              )
            })}
          </div>
        </div>
      )}
      {editing ? (
        <button type="button" className="btn-ghost text-sm" onClick={() => void addBelow(milestones[milestones.length - 1]?.id ?? null)}>
          + {t('sch.addMilestone')}
        </button>
      ) : null}
    </section>
  )
}

/** One timeline row: the name on the left, then the day grid with its bar placed by `gridColumnStart`. */
function Row({
  label,
  sub,
  status,
  days,
  dayPx,
  today,
  children,
}: {
  label: string
  sub: string
  status: 'done' | 'late' | null
  days: string[]
  dayPx: number
  today: string
  children: ReactNode
}) {
  const { t } = useI18n()
  return (
    <>
      <div className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-1 dark:border-slate-800 dark:bg-slate-900">
        <div className="truncate font-medium text-slate-700 dark:text-slate-200" title={label}>
          {label}
        </div>
        <div className="text-[11px] text-slate-500">
          {sub}
          {status === 'done' ? <span className="ml-2 font-medium text-green-700 dark:text-green-400">✓ {t('sch.done')}</span> : null}
          {status === 'late' ? <span className="ml-2 font-medium text-red-600">{t('sch.late')}</span> : null}
        </div>
      </div>
      <div className="relative grid border-b border-slate-100 dark:border-slate-800" style={{ gridColumn: `span ${days.length}`, gridTemplateColumns: `repeat(${days.length}, ${dayPx}px)` }}>
        {/* Weekends and today, behind the bar. */}
        {days.map((d, i) => {
          const dow = dateOf(d).getUTCDay()
          return dow === 0 || dow === 6 || d === today ? (
            <div key={d} className={`absolute inset-y-0 ${d === today ? 'border-l-2 border-brand/60' : 'bg-slate-50 dark:bg-slate-800/40'}`} style={{ left: i * dayPx, width: dayPx }} />
          ) : null
        })}
        {children}
      </div>
    </>
  )
}

function MilestoneEditor({ pocId, m, computed, onAddBelow }: { pocId: string; m: Milestone; computed: string; onAddBelow: () => void }) {
  const { t, locale } = useI18n()
  const { confirm } = useDialogs()
  const { track } = useSaveTracker()
  // The name is edited in the reader's language; pt-BR, the required one, is filled when still empty.
  const [row, setRow] = useLiveAutosave(
    { name: localText(m.text, locale), dateOverride: m.dateOverride },
    (v) => api(`/pocs/${pocId}/notebook/milestones/${m.id}`, { method: 'PATCH', body: { dateOverride: v.dateOverride, text: { ...m.text, [locale]: v.name, 'pt-BR': m.text['pt-BR'] || v.name } } }),
    (v) => v.name.trim() !== '',
  )
  const remove = async () => {
    if (!(await confirm(t('nb.deleteConfirm'), { danger: true }))) return
    await track(api(`/pocs/${pocId}/notebook/milestones/${m.id}`, { method: 'DELETE' }))
  }
  return (
    <li className="grid items-end gap-2 p-3 sm:grid-cols-[1fr_12rem_auto]">
      <label className="block min-w-0">
        <span className="label">{t('sch.milestone')}</span>
        <input className="input" maxLength={2000} value={row.name} onChange={(e) => setRow((r) => ({ ...r, name: e.target.value }))} />
      </label>
      <label className="block">
        <span className="label">{t('sch.date')}</span>
        <div className="flex gap-1">
          <input className="input" type="date" value={row.dateOverride ?? computed} onChange={(e) => setRow((r) => ({ ...r, dateOverride: e.target.value || null }))} />
          {row.dateOverride ? (
            <button type="button" className="btn-ghost px-2" title={t('sch.auto')} aria-label={t('sch.auto')} onClick={() => setRow((r) => ({ ...r, dateOverride: null }))}>
              ↺
            </button>
          ) : null}
        </div>
      </label>

      <div className="flex gap-1 pb-0.5">
        <button type="button" className="btn-ghost px-2" title={t('nb.addBelow')} aria-label={t('nb.addBelow')} onClick={onAddBelow}>
          +
        </button>
        <button type="button" className="btn-ghost px-2 text-red-600" title={t('nb.delete')} aria-label={t('nb.delete')} onClick={() => void remove()}>
          ✕
        </button>
      </div>
    </li>
  )
}


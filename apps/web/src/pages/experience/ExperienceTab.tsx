import { AUDIENCE_PROFILES, CHAPTERS, STAGES, type AudienceProfile, type ExperienceStatus, type StageId } from '@poc-intel/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../lib/api'
import { useDialogs } from '../../lib/dialogs'
import { errorKey } from '../../lib/errors'
import { useI18n } from '../../lib/i18n'
import { useWords } from './content'

export interface ExperienceRow {
  id: string
  name: string
  profile: AudienceProfile
  status: ExperienceStatus
  stages: StageId[]
  settled: number
  /** Customer Questions still waiting for the Sales Engineer's follow-up. */
  pendingQuestions: number
  createdAt: string
  finishedAt: string | null
}

export const useExperiences = (pocId: string) =>
  useQuery({
    queryKey: ['experiences', pocId],
    queryFn: () => api<{ experiences: ExperienceRow[]; canRun: boolean }>(`/pocs/${pocId}/experiences`),
    // A Customer User learns that a session went live without reloading the page.
    refetchInterval: 10_000,
  })

export const experiencePath = (pocId: string, expId: string) => `/pocs/${pocId}/experiences/${expId}`

/** "Stellar Experience live": shown above the PoC tabs while one is Active. */
export function LiveExperienceBanner({ pocId }: { pocId: string }) {
  const { t } = useI18n()
  const { data } = useExperiences(pocId)
  const live = data?.experiences.find((e) => e.status === 'active')
  if (!live) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-linear-to-r from-[#3044E0] to-[#0A1823] px-4 py-3 text-[#FAFAF4] shadow-sm">
      <span className="relative flex size-2.5" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#41C5F9] opacity-75 motion-reduce:animate-none" />
        <span className="relative inline-flex size-2.5 rounded-full bg-[#41C5F9]" />
      </span>
      <p className="min-w-0 flex-1 text-sm font-medium">{t('exp.liveBanner', { name: live.name })}</p>
      <Link to={experiencePath(pocId, live.id)} className="rounded-lg bg-[#FAFAF4] px-4 py-1.5 text-sm font-semibold text-[#0A1823] hover:bg-white">
        {data?.canRun ? t('exp.present') : t('exp.join')}
      </Link>
    </div>
  )
}

const STATUS_STYLE: Record<ExperienceStatus, string> = {
  disabled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  active: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  finished: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
}

export function ExperienceTab({ pocId }: { pocId: string }) {
  const { t } = useI18n()
  const { data } = useExperiences(pocId)
  if (!data) return null
  const { experiences, canRun } = data
  return (
    <div className="space-y-4">
      <p className="max-w-prose text-sm text-slate-600 dark:text-slate-400">{t('exp.intro')}</p>
      {canRun ? <CreateExperience pocId={pocId} /> : null}
      {experiences.length === 0 ? (
        <p className="card text-sm text-slate-500">{t(canRun ? 'exp.empty' : 'exp.emptyCustomer')}</p>
      ) : (
        <ul className="space-y-3">
          {experiences.map((e) => (
            <ExperienceItem key={e.id} pocId={pocId} e={e} canRun={canRun} anotherLive={experiences.some((o) => o.id !== e.id && o.status === 'active')} />
          ))}
        </ul>
      )}
    </div>
  )
}

function CreateExperience({ pocId }: { pocId: string }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [profile, setProfile] = useState<AudienceProfile>('technical')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      await api(`/pocs/${pocId}/experiences`, { method: 'POST', body: { name: name.trim(), profile } })
      setName('')
      await qc.invalidateQueries({ queryKey: ['experiences', pocId] })
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      className="card flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) void create()
      }}
    >
      <h2 className="w-full font-semibold">{t('exp.new')}</h2>
      <label className="min-w-[min(100%,14rem)] flex-1">
        <span className="label">{t('exp.name')}</span>
        <input className="input" value={name} maxLength={80} placeholder={t('exp.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
      </label>
      <fieldset className="min-w-[min(100%,14rem)]">
        <legend className="label">{t('exp.profile')}</legend>
        <div className="flex flex-wrap gap-2">
          {AUDIENCE_PROFILES.map((p) => (
            <label key={p} className={`btn-ghost ${profile === p ? 'border-brand bg-brand/10 text-brand dark:text-blue-300' : ''}`}>
              <input type="radio" name="profile" className="sr-only" checked={profile === p} onChange={() => setProfile(p)} />
              {t(`exp.profile.${p}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <button className="btn" disabled={busy || !name.trim()}>
        {t('exp.create')}
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </form>
  )
}

function ExperienceItem({ pocId, e, canRun, anotherLive }: { pocId: string; e: ExperienceRow; canRun: boolean; anotherLive: boolean }) {
  const { t, locale } = useI18n()
  const qc = useQueryClient()
  const { confirm } = useDialogs()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const patch = async (body: Record<string, unknown>) => {
    setError(null)
    try {
      await api(`/pocs/${pocId}/experiences/${e.id}`, { method: 'PATCH', body })
      await qc.invalidateQueries({ queryKey: ['experiences', pocId] })
      return true
    } catch (err) {
      setError(t(errorKey(err)))
      return false
    }
  }
  const finish = async () => {
    if (await confirm(t('exp.finishConfirm', { name: e.name }))) await patch({ status: 'finished' })
  }
  return (
    <li className="card space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[min(100%,14rem)] flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {e.name}
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[e.status]}`}>{t(`exp.status.${e.status}`)}</span>
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t(`exp.profile.${e.profile}`)} · {t('exp.progress', { settled: Math.min(e.settled, e.stages.length), total: e.stages.length })}
            {e.finishedAt ? ` · ${new Date(e.finishedAt).toLocaleDateString(locale)}` : ''}
            {e.pendingQuestions > 0 ? <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">{t('exp.pendingQuestions', { n: e.pendingQuestions })}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canRun && e.status !== 'finished' ? (
            <button className="btn-ghost" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
              {t('exp.stages')}
            </button>
          ) : null}
          {canRun && e.status === 'disabled' ? (
            <button className="btn" disabled={anotherLive} onClick={() => void patch({ status: 'active' })}>
              {t('exp.start')}
            </button>
          ) : null}
          {canRun && e.status === 'active' ? (
            <button className="btn-ghost" onClick={() => void finish()}>
              {t('exp.finish')}
            </button>
          ) : null}
          {canRun && e.status === 'finished' ? (
            <button className="btn-ghost" disabled={anotherLive} onClick={() => void patch({ status: 'active' })}>
              {t('exp.reopen')}
            </button>
          ) : null}
          {e.status !== 'disabled' ? (
            <Link className="btn" to={experiencePath(pocId, e.id)}>
              {e.status === 'finished' ? t('exp.replay') : canRun ? t('exp.present') : t('exp.join')}
            </Link>
          ) : null}
        </div>
      </div>
      {editing ? <StagePicker initial={e.stages} onSave={async (stages) => (await patch({ stages })) && setEditing(false)} /> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </li>
  )
}

/** The Stages of one session, grouped by Chapter. */
function StagePicker({ initial, onSave }: { initial: StageId[]; onSave: (stages: StageId[]) => Promise<unknown> }) {
  const { t } = useI18n()
  const words = useWords()
  const [chosen, setChosen] = useState<Set<StageId>>(new Set(initial))
  const toggle = (id: StageId) =>
    setChosen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  return (
    <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
      <p className="text-sm text-slate-500">{t('exp.stagesHelp')}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {CHAPTERS.map((c) => (
          <fieldset key={c}>
            <legend className="mb-1 text-sm font-semibold">{words.chapters[c].title}</legend>
            {STAGES.filter((s) => s.chapter === c).map((s) => (
              <label key={s.id} className="flex items-center gap-2 py-0.5 text-sm">
                <input type="checkbox" className="accent-brand" checked={chosen.has(s.id)} onChange={() => toggle(s.id)} />
                {words.stages[s.id].title}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <button className="btn" disabled={chosen.size === 0} onClick={() => void onSave([...chosen])}>
        {t('exp.saveStages')}
      </button>
    </div>
  )
}

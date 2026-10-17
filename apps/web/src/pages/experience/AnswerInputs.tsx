import {
  FILTER_ACTIONS,
  MTTD_PHASES,
  automatedMinutes,
  type AnswerValue,
  type CatalogKind,
  type ChoiceValue,
  type DataSourcesValue,
  type ExperienceDataSource,
  type FiltersValue,
  type ItemsValue,
  type MttdValue,
  type NumberValue,
  type Question,
  type StageId,
} from '@poc-intel/shared'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { optionLabel, useWords } from './content'

/** A draft Answer: what the form holds before it is sent; null until something is typed. */
export type Draft = AnswerValue | null

const field = 'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-sc-silver placeholder:text-sc-silver/40 outline-none focus:border-sc-sky-light focus:ring-2 focus:ring-sc-sky-light/30'
const chip = (on: boolean) =>
  `cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? 'border-sc-sky-light bg-sc-sky-light/15 text-sc-silver' : 'border-white/15 text-sc-silver/75 hover:border-white/40 hover:text-sc-silver'}`

export function AnswerInput({ stageId, question, value, onChange, approvedSources }: { stageId: StageId; question: Question; value: Draft; onChange: (v: Draft) => void; approvedSources: string[] }) {
  switch (question.kind) {
    case 'data_sources':
      return <DataSourcesInput value={value as DataSourcesValue | null} onChange={onChange} />
    case 'choice':
      return <ChoiceInput stageId={stageId} question={question} value={value as ChoiceValue | null} onChange={onChange} />
    case 'number':
      return <NumberInput unit={question.unit} max={question.max} value={value as NumberValue | null} onChange={onChange} />
    case 'items':
      return <ItemsInput max={question.max} value={value as ItemsValue | null} onChange={onChange} />
    case 'filters':
      return <FiltersInput max={question.max} value={value as FiltersValue | null} onChange={onChange} suggestions={approvedSources} />
    case 'mttd':
      return <MttdInput value={value as MttdValue | null} onChange={onChange} />
  }
}

interface CatalogEntry {
  id: string
  kind: CatalogKind
  name: string
  port: string
  category: string
}

function DataSourcesInput({ value, onChange }: { value: DataSourcesValue | null; onChange: (v: Draft) => void }) {
  const { t } = useI18n()
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: () => api<{ entries: CatalogEntry[] }>('/catalog'), staleTime: 10 * 60_000 })
  const [q, setQ] = useState('')
  const sources = value?.sources ?? []
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const taken = new Set(sources.map((s) => s.catalogId).filter(Boolean))
  const matches =
    words.length === 0
      ? []
      : (catalog.data?.entries ?? []).filter((e) => !taken.has(e.id) && words.every((w) => `${e.name} ${e.category}`.toLowerCase().includes(w))).slice(0, 6)
  const set = (next: ExperienceDataSource[]) => onChange(next.length ? { sources: next } : null)
  const add = (s: ExperienceDataSource) => {
    set([...sources, s])
    setQ('')
  }
  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          className={field}
          value={q}
          placeholder={t('exp.searchCatalog')}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (matches[0]) add({ kind: matches[0].kind, catalogId: matches[0].id, name: matches[0].name })
            }
          }}
        />
        {q.trim() ? (
          <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-white/15 bg-sc-midnight/95 shadow-2xl backdrop-blur">
            {matches.map((e) => (
              <li key={e.id}>
                <button type="button" className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-white/10" onClick={() => add({ kind: e.kind, catalogId: e.id, name: e.name })}>
                  <span className="flex-1">{e.name}</span>
                  <span className="text-xs text-sc-silver/50">{t(`exp.kind.${e.kind}`)}</span>
                </button>
              </li>
            ))}
            <li>
              <button type="button" className="w-full border-t border-white/10 px-3 py-2 text-left text-sm text-sc-silver/60 hover:bg-white/10" onClick={() => add({ kind: 'parser', catalogId: null, name: q.trim() })}>
                {t('exp.addTyped', { name: q.trim() })}
              </button>
            </li>
          </ul>
        ) : null}
      </div>
      {sources.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {sources.map((s, i) => (
            <li key={`${s.catalogId ?? s.name}-${i}`} className="flex items-center gap-1.5 rounded-full border border-sc-sky-light/50 bg-sc-sky-light/10 py-1 pr-1.5 pl-3 text-sm">
              {s.name}
              <button type="button" className="rounded-full px-1.5 text-sc-silver/60 hover:bg-white/10 hover:text-sc-silver" aria-label={`${t('exp.remove')} ${s.name}`} onClick={() => set(sources.filter((_, j) => j !== i))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function ChoiceInput({ stageId, question, value, onChange }: { stageId: StageId; question: Extract<Question, { kind: 'choice' }>; value: ChoiceValue | null; onChange: (v: Draft) => void }) {
  const words = useWords()
  const chosen = value?.options ?? []
  const toggle = (o: string) => {
    const next = question.multiple ? (chosen.includes(o) ? chosen.filter((c) => c !== o) : [...chosen, o]) : [o]
    onChange(next.length ? { options: question.options.filter((x) => next.includes(x)) } : null)
  }
  return (
    <div className="flex flex-wrap gap-2" role={question.multiple ? 'group' : 'radiogroup'}>
      {question.options.map((o) => (
        <button key={o} type="button" role={question.multiple ? 'checkbox' : 'radio'} aria-checked={chosen.includes(o)} className={chip(chosen.includes(o))} onClick={() => toggle(o)}>
          {optionLabel(words, stageId, o)}
        </button>
      ))}
    </div>
  )
}

function NumberInput({ unit, max, value, onChange }: { unit: 'tools' | 'alerts_per_day' | 'minutes'; max: number; value: NumberValue | null; onChange: (v: Draft) => void }) {
  const { t } = useI18n()
  return (
    <label className="flex items-center gap-3">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        className={`${field} max-w-40 text-lg tabular-nums`}
        value={value?.value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : { value: Math.min(max, Math.max(0, Number(e.target.value))) })}
      />
      <span className="text-sm text-sc-silver/70">{t(`exp.unit.${unit}`)}</span>
    </label>
  )
}

function ItemsInput({ max, value, onChange }: { max: number; value: ItemsValue | null; onChange: (v: Draft) => void }) {
  const { t } = useI18n()
  const [text, setText] = useState(() => (value?.items ?? []).join('\n'))
  return (
    <textarea
      className={`${field} min-h-32`}
      value={text}
      placeholder={t('exp.itemPlaceholder')}
      onChange={(e) => {
        setText(e.target.value)
        const items = e.target.value
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, max)
        onChange(items.length ? { items } : null)
      }}
    />
  )
}

function FiltersInput({ max, value, onChange, suggestions }: { max: number; value: FiltersValue | null; onChange: (v: Draft) => void; suggestions: string[] }) {
  const { t } = useI18n()
  const words = useWords()
  const [rows, setRows] = useState<FiltersValue['filters']>(() => value?.filters ?? [{ source: '', eventType: '', action: 'drop' }])
  const update = (next: FiltersValue['filters']) => {
    setRows(next)
    const complete = next.filter((r) => r.source.trim() && r.eventType.trim())
    onChange(complete.length ? { filters: complete.map((r) => ({ ...r, source: r.source.trim(), eventType: r.eventType.trim() })) } : null)
  }
  return (
    <div className="space-y-3">
      <datalist id="exp-sources">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {rows.map((r, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input className={field} list="exp-sources" aria-label={t('exp.source')} placeholder={t('exp.source')} value={r.source} onChange={(e) => update(rows.map((x, j) => (j === i ? { ...x, source: e.target.value } : x)))} />
          <input className={field} aria-label={t('exp.eventType')} placeholder={t('exp.eventTypePlaceholder')} value={r.eventType} onChange={(e) => update(rows.map((x, j) => (j === i ? { ...x, eventType: e.target.value } : x)))} />
          <div className="flex gap-1" role="radiogroup" aria-label={t('exp.filterAction')}>
            {FILTER_ACTIONS.map((a) => (
              <button key={a} type="button" role="radio" aria-checked={r.action === a} className={chip(r.action === a)} onClick={() => update(rows.map((x, j) => (j === i ? { ...x, action: a } : x)))}>
                {words.filterActions[a]}
              </button>
            ))}
          </div>
          <button type="button" className="rounded-lg px-2 text-sm text-sc-silver/60 hover:bg-white/10 hover:text-sc-silver" onClick={() => update(rows.filter((_, j) => j !== i))} aria-label={t('exp.remove')}>
            ×
          </button>
        </div>
      ))}
      {rows.length < max ? (
        <button type="button" className="text-sm font-medium text-sc-sky-light hover:underline" onClick={() => setRows([...rows, { source: '', eventType: '', action: 'drop' }])}>
          + {t('exp.add')}
        </button>
      ) : null}
    </div>
  )
}

function MttdInput({ value, onChange }: { value: MttdValue | null; onChange: (v: Draft) => void }) {
  const { t } = useI18n()
  const words = useWords()
  const v: MttdValue = value ?? { mttdHours: 0, phases: { collection: 0, triage: 0, correlation: 0, investigation: 0 } }
  const num = (s: string) => Math.max(0, Number(s) || 0)
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3">
        <span className="flex-1 text-sm text-sc-silver/80">{t('exp.mttdHours')}</span>
        <input type="number" min={0} className={`${field} max-w-28 tabular-nums`} value={value ? v.mttdHours : ''} onChange={(e) => onChange({ ...v, mttdHours: num(e.target.value) })} />
      </label>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm text-sc-silver/80">{t('exp.phaseMinutes')}</legend>
        {MTTD_PHASES.map((p) => (
          <label key={p} className="flex items-center gap-3">
            <span className="flex-1 text-sm">{words.mttdPhases[p]}</span>
            <input type="number" min={0} className={`${field} max-w-28 tabular-nums`} value={value ? v.phases[p] : ''} onChange={(e) => onChange({ ...v, phases: { ...v.phases, [p]: num(e.target.value) } })} />
          </label>
        ))}
      </fieldset>
      {value && automatedMinutes(v) > 0 ? <p className="rounded-lg border border-sc-solar/40 bg-sc-solar/10 px-3 py-2 text-sm">{t('exp.gain', { minutes: automatedMinutes(v) })}</p> : null}
    </div>
  )
}

/** An Answer, read-only: how it shows in the list and as the Approved Answer. */
export function AnswerSummary({ stageId, question, value }: { stageId: StageId; question: Question; value: AnswerValue }) {
  const { t } = useI18n()
  const words = useWords()
  switch (question.kind) {
    case 'data_sources':
      return <span>{(value as DataSourcesValue).sources.map((s) => s.name).join(', ')}</span>
    case 'choice':
      return <span>{(value as ChoiceValue).options.map((o) => optionLabel(words, stageId, o)).join(', ')}</span>
    case 'number':
      return (
        <span className="tabular-nums">
          {(value as NumberValue).value.toLocaleString()} {t(`exp.unit.${question.unit}`)}
        </span>
      )
    case 'items':
      return <span>{(value as ItemsValue).items.join(', ')}</span>
    case 'filters':
      return (
        <ul className="space-y-0.5">
          {(value as FiltersValue).filters.map((f, i) => (
            <li key={i}>
              {words.filterActions[f.action]}: {f.source} · {f.eventType}
            </li>
          ))}
        </ul>
      )
    case 'mttd': {
      const m = value as MttdValue
      return (
        <span className="tabular-nums">
          MTTD {m.mttdHours} h · {t('exp.gain', { minutes: automatedMinutes(m) })}
        </span>
      )
    }
  }
}

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { CopyButton, ExportButtons, LEVEL_STYLE, Pager, PresetSelect, qs, useFormat, type Page, type Preset } from './common'
import { Select } from '../../lib/Select'

interface LogRow {
  id: number
  at: string
  level: 'debug' | 'info' | 'warn' | 'error'
  source: string
  category: string
  message: string
  userId: string | null
  email: string | null
  requestId: string | null
  context: unknown
}
type LogsPage = Page<LogRow> & { levels: Partial<Record<LogRow['level'], number>>; categories: string[] }

const LIMIT = 200
const LEVELS = ['debug', 'info', 'warn', 'error'] as const

const asText = (e: LogRow) =>
  `[${e.level.toUpperCase()}] ${e.at.replace('T', ' ').slice(0, 19)} [${e.source}/${e.category}] ${e.message}${e.context != null ? `\n${JSON.stringify(e.context, null, 2)}` : ''}`

/** The application log, in the style of the old app's log panel: a terminal list with level chips. */
export function LogsTab({ params }: { params: URLSearchParams }) {
  const { t } = useI18n()
  const f = useFormat()
  const [level, setLevel] = useState<LogRow['level']>((LEVELS as readonly string[]).includes(params.get('level') ?? '') ? (params.get('level') as LogRow['level']) : 'info')
  const [source, setSource] = useState('')
  const [category, setCategory] = useState('')
  const [q, setQ] = useState(params.get('q') ?? '')
  const [preset, setPreset] = useState<Preset>('24h')
  const [offset, setOffset] = useState(0)
  const [live, setLive] = useState(true)
  const [open, setOpen] = useState<Set<number>>(new Set())

  const filter = qs({ level, source, category, q: q.trim() }, preset)
  const logs = useQuery({
    queryKey: ['audit', 'logs', filter, offset],
    queryFn: () => api<LogsPage>(`/admin/audit/logs?${filter}&limit=${LIMIT}&offset=${offset}`),
    placeholderData: keepPreviousData,
    refetchInterval: live && offset === 0 ? 5000 : false,
  })
  const set = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v)
    setOffset(0)
  }
  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 text-slate-200 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-black/20 px-4 py-3">
        <Select className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs" aria-label={t('audit.level')} value={level} onChange={(e) => set(setLevel)(e.target.value as LogRow['level'])}>
          {LEVELS.map((l) => (
            <option key={l} value={l} className="bg-slate-900">
              {l.toUpperCase()}+
            </option>
          ))}
        </Select>
        <Select className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs" aria-label={t('audit.source')} value={source} onChange={(e) => set(setSource)(e.target.value)}>
          <option value="" className="bg-slate-900">
            {t('audit.allSources')}
          </option>
          <option value="api" className="bg-slate-900">
            api
          </option>
          <option value="worker" className="bg-slate-900">
            worker
          </option>
        </Select>
        <Select className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs" aria-label={t('audit.category')} value={category} onChange={(e) => set(setCategory)(e.target.value)}>
          <option value="" className="bg-slate-900">
            {t('audit.allCategories')}
          </option>
          {logs.data?.categories.map((c) => (
            <option key={c} value={c} className="bg-slate-900">
              {c}
            </option>
          ))}
        </Select>
        <PresetSelect value={preset} onChange={set(setPreset)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-200" optionClassName="bg-slate-900" />
        <input
          className="min-w-32 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs outline-none placeholder:text-slate-500"
          placeholder={t('audit.searchLogs')}
          value={q}
          onChange={(e) => set(setQ)(e.target.value)}
        />
        <span className="flex gap-1.5">
          {LEVELS.map((l) => (
            <button
              key={l}
              className={`rounded border px-2 py-0.5 font-mono text-xs ${LEVEL_STYLE[l]} ${level === l ? 'ring-1 ring-white/40' : ''}`}
              title={t('audit.levelFrom', { level: l })}
              onClick={() => set(setLevel)(l)}
            >
              {l[0]!.toUpperCase()} {f.num(logs.data?.levels[l] ?? 0)}
            </button>
          ))}
        </span>
        <label className="flex items-center gap-1 text-xs text-slate-400">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> {t('audit.live')}
        </label>
        <button className="rounded-lg p-1.5 text-xs text-slate-400 hover:bg-white/5" title={t('audit.refresh')} onClick={() => void logs.refetch()}>
          ⟳
        </button>
        <span className="[&_a]:border-white/10 [&_a]:text-slate-400 [&_a:hover]:bg-white/5">
          <ExportButtons kind="logs" query={filter} formats={['json', 'txt', 'csv']} />
        </span>
      </div>

      <div className="max-h-[65vh] overflow-y-auto font-mono text-xs">
        {!logs.data?.rows.length ? (
          <div className="py-10 text-center text-slate-500">{logs.isLoading ? t('audit.loading') : t('audit.noLogs')}</div>
        ) : (
          logs.data.rows.map((e) => {
            const hasData = e.context != null
            const isOpen = open.has(e.id)
            return (
              <div key={e.id} className={`group border-b border-white/[0.03] ${hasData ? 'cursor-pointer hover:bg-white/[0.03]' : ''}`} onClick={() => hasData && toggle(e.id)}>
                {/* Below sm the message drops to its own full-width line under the level, time and category. */}
                <div className="flex flex-wrap items-start gap-x-2 px-4 py-1.5 sm:flex-nowrap">
                  <span className={`shrink-0 rounded border px-1.5 leading-5 ${LEVEL_STYLE[e.level]}`}>{e.level[0]!.toUpperCase()}</span>
                  <span className="shrink-0 leading-5 text-slate-500 tabular-nums">{f.dateTime(e.at)}</span>
                  <span className="shrink-0 leading-5 text-violet-400">
                    [{e.source}/{e.category}]
                  </span>
                  <span
                    className={`order-last min-w-0 basis-full leading-5 [overflow-wrap:anywhere] sm:order-none sm:flex-1 sm:basis-0 ${e.level === 'error' ? 'text-red-300' : e.level === 'warn' ? 'text-amber-200' : 'text-slate-300'}`}
                  >
                    {e.message}
                  </span>
                  {e.email ? <span className="hidden shrink-0 leading-5 text-slate-500 md:inline">{e.email}</span> : null}
                  <span className="ml-auto flex shrink-0 gap-2 sm:ml-0">
                    <CopyButton text={asText(e)} />
                    {hasData ? <span className="leading-5 text-slate-600">{isOpen ? '▲' : '▼'}</span> : null}
                  </span>
                </div>
                {hasData && isOpen ? (
                  <pre className="overflow-x-auto bg-black/30 px-4 pb-3 leading-relaxed text-slate-400 select-text" onClick={(ev) => ev.stopPropagation()}>
                    {JSON.stringify({ requestId: e.requestId, userId: e.userId, ...(typeof e.context === 'object' ? e.context : { context: e.context }) }, null, 2)}
                  </pre>
                ) : null}
              </div>
            )
          })
        )}
      </div>

      <div className="border-t border-white/5 bg-black/10 px-4 py-1 [&_*]:text-slate-500 [&_button]:border-white/10">
        <Pager total={logs.data?.total ?? 0} limit={LIMIT} offset={offset} onChange={setOffset} />
      </div>
    </section>
  )
}

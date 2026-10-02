import { SYNC_PHASES, type SyncStatus } from '@poc-intel/shared'
import type { MessageKey } from '@poc-intel/shared/i18n'
import { useQuery } from '@tanstack/react-query'
import { ApiError, api } from './api'
import { errorKey } from './errors'
import { useI18n } from './i18n'

export interface SyncRow {
  id: string
  status: SyncStatus
  progress: { step?: string; done: number; total: number; phase?: number } | null
  error: string | null
  createdAt: string
}

export const syncPct = (s: SyncRow | undefined) => (!s ? 0 : s.status === 'succeeded' ? 100 : s.progress ? Math.min(99, Math.round((s.progress.done / Math.max(1, s.progress.total)) * 100)) : 0)
export const isRunning = (s: SyncRow | undefined) => s?.status === 'queued' || s?.status === 'running'

/** Polls one Sync every 2 s while it runs. */
export function useSync(syncId: string | null) {
  return useQuery({
    queryKey: ['sync', syncId],
    queryFn: () => api<SyncRow>(`/syncs/${syncId}`),
    enabled: Boolean(syncId),
    refetchInterval: (q) => (isRunning(q.state.data) || !q.state.data ? 2000 : false),
  })
}

/** Always-visible progress bar of a Sync; `sticky` pins it to the top of the viewport while the page scrolls. */
export function SyncBar({ sync, label, sticky }: { sync: SyncRow | undefined; label?: string; sticky?: boolean }) {
  const { t } = useI18n()
  if (!sync) return null
  const pct = syncPct(sync)
  const failed = sync.status === 'failed'
  const done = sync.status === 'succeeded'
  // Queued Syncs are in phase 1; Syncs from before phases existed show only the percentage.
  const phase = done ? SYNC_PHASES.length : (sync.progress?.phase ?? (sync.status === 'queued' ? 1 : null))
  const phaseText = phase ? t('sync.phaseOf', { n: phase, total: SYNC_PHASES.length, name: t(`sync.phase.${SYNC_PHASES[phase - 1]}` as MessageKey) }) : t('sync.progressPlain')
  const bar = (
    <div className={`rounded-lg border p-3 ${sticky ? 'shadow-md' : ''} ${failed ? 'border-red-300 bg-red-50' : 'border-blue-200 bg-blue-50 dark:bg-blue-950/30'}`} role="status" aria-live="polite">
      <div className="mb-2 flex justify-between text-sm">
        <span className="font-medium">
          {failed ? t('sync.status.failed') : done ? t('sync.done') : label ? `${label} · ${phaseText}` : phaseText}
        </span>
        <span className="tabular-nums">{failed ? '' : `${pct}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-white/70">
        <div className={`h-full transition-all ${failed ? 'bg-red-500' : sync.status === 'succeeded' ? 'bg-green-600' : 'bg-brand'}`} style={{ width: `${failed ? 100 : pct}%` }} />
      </div>
      {!failed && phase ? (
        <ol className="mt-2 flex gap-1" aria-hidden="true">
          {SYNC_PHASES.map((p, i) => (
            <li
              key={p}
              title={t(`sync.phase.${p}` as MessageKey)}
              className={`h-1 flex-1 rounded ${i + 1 < phase || done ? 'bg-green-600' : i + 1 === phase ? 'bg-brand' : 'bg-slate-300 dark:bg-slate-700'}`}
            />
          ))}
        </ol>
      ) : null}
      {failed ? <p className="mt-2 text-sm text-red-700">{t(errorKey(new ApiError(500, `stellar_${sync.error ?? ''}`)))}</p> : null}
    </div>
  )
  // Opaque strip in the page colour, so the content scrolling under the bar does not show through.
  return sticky ? <div className="sticky top-0 z-20 bg-slate-50 py-2 dark:bg-slate-950">{bar}</div> : bar
}

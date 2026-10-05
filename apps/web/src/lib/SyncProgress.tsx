import { SYNC_PHASES, type SyncStatus } from '@poc-intel/shared'
import type { MessageKey } from '@poc-intel/shared/i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, api } from './api'
import { errorKey } from './errors'
import { useI18n } from './i18n'
import { useDialogs } from './dialogs'

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

/** Stops a queued or running Sync, after a confirmation. Only the PoC's Owner or an Admin may (the API checks). */
function CancelSyncButton({ syncId }: { syncId: string }) {
  const { t } = useI18n()
  const { confirm, alert } = useDialogs()
  const qc = useQueryClient()
  const cancel = useMutation({
    mutationFn: () => api<SyncRow>(`/syncs/${syncId}/cancel`, { method: 'POST' }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['sync', syncId] })
      void qc.invalidateQueries({ queryKey: ['poc'] })
      void qc.invalidateQueries({ queryKey: ['pocs'] })
    },
    onError: (err) => void alert(t(errorKey(err))),
  })
  return (
    <button
      type="button"
      className="shrink-0 whitespace-nowrap rounded-md border border-red-300 bg-white px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-950"
      disabled={cancel.isPending}
      onClick={async () => (await confirm(t('sync.cancelConfirm'), { danger: true })) && cancel.mutate()}
    >
      {cancel.isPending ? t('sync.cancelling') : t('sync.cancel')}
    </button>
  )
}

/**
 * Always-visible progress bar of a Sync; `sticky` pins it to the top of the viewport while the page
 * scrolls. `canCancel` shows the Cancel button while the Sync is queued or running.
 */
export function SyncBar({ sync, label, sticky, canCancel }: { sync: SyncRow | undefined; label?: string; sticky?: boolean; canCancel?: boolean }) {
  const { t } = useI18n()
  if (!sync) return null
  const pct = syncPct(sync)
  const failed = sync.status === 'failed'
  const cancelled = sync.status === 'cancelled'
  const done = sync.status === 'succeeded'
  // Queued Syncs are in phase 1; Syncs from before phases existed show only the percentage.
  const phase = done ? SYNC_PHASES.length : (sync.progress?.phase ?? (sync.status === 'queued' ? 1 : null))
  const phaseText = phase ? t('sync.phaseOf', { n: phase, total: SYNC_PHASES.length, name: t(`sync.phase.${SYNC_PHASES[phase - 1]}` as MessageKey) }) : t('sync.progressPlain')
  const bar = (
    <div
      className={`rounded-lg border p-3 ${sticky ? 'shadow-md' : ''} ${failed ? 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40' : cancelled ? 'border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-900' : 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30'}`}
      role="status"
      aria-live="polite"
    >
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">
          {failed ? t('sync.status.failed') : cancelled ? t('sync.cancelledBar') : done ? t('sync.done') : label ? `${label} · ${phaseText}` : phaseText}
        </span>
        <span className="flex items-center gap-3">
          <span className="tabular-nums">{failed || cancelled ? '' : `${pct}%`}</span>
          {canCancel && isRunning(sync) ? <CancelSyncButton syncId={sync.id} /> : null}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-white/70 dark:bg-slate-800">
        <div
          className={`h-full transition-all ${failed ? 'bg-red-500' : cancelled ? 'bg-slate-400' : sync.status === 'succeeded' ? 'bg-green-600' : 'bg-brand'}`}
          style={{ width: `${failed ? 100 : pct}%` }}
        />
      </div>
      {!failed && !cancelled && phase ? (
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
      {failed ? <p className="mt-2 text-sm text-red-700 dark:text-red-300">{t(errorKey(new ApiError(500, `stellar_${sync.error ?? ''}`)))}</p> : null}
    </div>
  )
  // Opaque strip in the page colour, so the content scrolling under the bar does not show through.
  return sticky ? <div className="sticky top-0 z-20 bg-slate-50 py-2 dark:bg-slate-950">{bar}</div> : bar
}

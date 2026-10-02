import type { SyncStatus } from '@poc-intel/shared'
import { useQuery } from '@tanstack/react-query'
import { ApiError, api } from './api'
import { errorKey } from './errors'
import { useI18n } from './i18n'

export interface SyncRow {
  id: string
  status: SyncStatus
  progress: { done: number; total: number } | null
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

/** Always-visible progress bar of a Sync. */
export function SyncBar({ sync, label }: { sync: SyncRow | undefined; label?: string }) {
  const { t } = useI18n()
  if (!sync) return null
  const pct = syncPct(sync)
  const failed = sync.status === 'failed'
  return (
    <div className={`rounded-lg border p-3 ${failed ? 'border-red-300 bg-red-50' : 'border-blue-200 bg-blue-50 dark:bg-blue-950/30'}`} role="status" aria-live="polite">
      <div className="mb-2 flex justify-between text-sm">
        <span className="font-medium">
          {failed ? t('sync.status.failed') : sync.status === 'succeeded' ? t('sync.done') : (label ?? t('sync.progress', { p: pct }))}
        </span>
        <span className="tabular-nums">{failed ? '' : `${pct}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-white/70">
        <div className={`h-full transition-all ${failed ? 'bg-red-500' : sync.status === 'succeeded' ? 'bg-green-600' : 'bg-brand'}`} style={{ width: `${failed ? 100 : pct}%` }} />
      </div>
      {failed ? <p className="mt-2 text-sm text-red-700">{t(errorKey(new ApiError(500, `stellar_${sync.error ?? ''}`)))}</p> : null}
    </div>
  )
}

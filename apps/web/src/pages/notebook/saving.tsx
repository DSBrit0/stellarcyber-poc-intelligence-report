import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { ApiError } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

/**
 * Saving in the PoC Notebook. Every change goes to the server on its own: typing is saved 700 ms after
 * the last keystroke, a pick or a click at once. One indicator covers the whole Notebook, and nothing
 * typed is lost when the section, the page or the tab is closed: pending saves are sent right away.
 * The Notebook refreshes every few seconds, so everyone sees the others' changes.
 */

const DEBOUNCE_MS = 700

type Status = 'idle' | 'saving' | 'saved' | 'error'

interface Tracker {
  /** Runs one save and reflects it in the indicator; the Notebook is refreshed once it succeeds. */
  track: <T>(p: Promise<T>) => Promise<T>
  /** A debounced change waiting to be sent: `flush` sends it now. */
  setPending: (id: string, flush: (() => void) | null) => void
}

const Ctx = createContext<Tracker>({ track: (p) => p, setPending: () => {} })
const StatusCtx = createContext<{ status: Status; savedAt: Date | null }>({ status: 'idle', savedAt: null })

export function SaveProvider({ pocId, children }: { pocId: string; children: ReactNode }) {
  const qc = useQueryClient()
  const pending = useRef(new Map<string, () => void>())
  const [inflight, setInflight] = useState(0)
  const [waiting, setWaiting] = useState(0)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [failed, setFailed] = useState(false)
  const refresh = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const tracker = useMemo<Tracker>(
    () => ({
      track: async (p) => {
        setInflight((n) => n + 1)
        try {
          const result = await p
          setFailed(false)
          setSavedAt(new Date())
          // The cached Notebook follows what was saved, so a section reopened later shows it.
          clearTimeout(refresh.current)
          refresh.current = setTimeout(() => void qc.invalidateQueries({ queryKey: ['notebook', pocId] }), 300)
          return result
        } catch (err) {
          setFailed(true)
          throw err
        } finally {
          setInflight((n) => n - 1)
        }
      },
      setPending: (id, flush) => {
        if (flush) pending.current.set(id, flush)
        else pending.current.delete(id)
        setWaiting(pending.current.size)
      },
    }),
    [pocId, qc],
  )

  // Leaving the page: send what is still waiting, and let the browser warn while a save is under way.
  useEffect(() => {
    const flushAll = () => [...pending.current.values()].forEach((f) => f())
    const onHide = () => document.visibilityState === 'hidden' && flushAll()
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pending.current.size === 0 && inflight === 0) return
      flushAll()
      e.preventDefault()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flushAll)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flushAll)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [inflight])

  const status: Status = failed ? 'error' : inflight > 0 || waiting > 0 ? 'saving' : savedAt ? 'saved' : 'idle'
  return (
    <Ctx.Provider value={tracker}>
      <StatusCtx.Provider value={{ status, savedAt }}>{children}</StatusCtx.Provider>
    </Ctx.Provider>
  )
}

export const useSaveTracker = () => useContext(Ctx)

/**
 * A live, autosaved value. `server` is what the Notebook query last returned (it refreshes every few
 * seconds); the local copy follows it while it holds no edits of its own, so other people's changes
 * appear without overwriting what is being typed. Edits are saved 700 ms after the last change while
 * `enabled(value)`; `save` gets the value and the server's version it was edited from. A change still
 * waiting is sent when the component goes away (another section, another page).
 */
export function useLiveAutosave<T>(server: T, save: (value: T, base: T) => Promise<unknown>, enabled: (value: T) => boolean = () => true): [T, Dispatch<SetStateAction<T>>] {
  const id = useId()
  const tracker = useSaveTracker()
  const [value, setValue] = useState(server)
  const json = JSON.stringify(value)
  const serverJson = JSON.stringify(server)
  // The server's version the local copy is based on.
  const base = useRef(server)
  const baseJson = useRef(serverJson)
  const latest = useRef(value)
  const saveRef = useRef(save)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const dirty = useRef(false)
  latest.current = value
  saveRef.current = save

  // Someone else's change: taken when there are no local edits; otherwise the local copy wins and is saved.
  useEffect(() => {
    const unchanged = JSON.stringify(latest.current) === baseJson.current && !dirty.current
    base.current = server
    baseJson.current = serverJson
    if (unchanged) setValue(server)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverJson])

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    tracker.setPending(id, null)
    if (!dirty.current) return
    dirty.current = false
    const sending = saveRef.current(latest.current, base.current).catch((err: unknown) => {
      // The row was deleted meanwhile (by someone else): nothing left to save.
      if (err instanceof ApiError && err.status === 404) return
      throw err
    })
    tracker.track(sending).catch(() => {
      // The indicator shows the failure; the next change retries.
    })
  }, [id, tracker])

  useEffect(() => {
    if (json === baseJson.current || !enabled(value)) {
      // Nothing new, or invalid values (not sent; the form says what to fix).
      dirty.current = false
      clearTimeout(timer.current)
      tracker.setPending(id, null)
      return
    }
    dirty.current = true
    tracker.setPending(id, flush)
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, DEBOUNCE_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [json])

  useEffect(() => () => flush(), [flush])
  return [value, setValue]
}

/** The Notebook's one saving indicator. */
export function SaveIndicator() {
  const { t, locale } = useI18n()
  const { status, savedAt } = useContext(StatusCtx)
  if (status === 'idle') return <span className="text-xs text-slate-400">{t('nb.autosave')}</span>
  const style = status === 'error' ? 'text-red-600' : status === 'saving' ? 'text-amber-600 dark:text-amber-400' : 'text-green-700 dark:text-green-400'
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${style}`} role="status" aria-live="polite">
      {status === 'saving' ? (
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-6.2-8.6" />
        </svg>
      ) : status === 'saved' ? (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
          <path d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
          <path d="M12 8v5M12 17h.01" />
        </svg>
      )}
      {status === 'saving'
        ? t('nb.saving')
        : status === 'saved'
          ? t('nb.savedAt', { time: savedAt!.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })
          : t('nb.saveError')}
    </span>
  )
}

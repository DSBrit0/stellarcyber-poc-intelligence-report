import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from './i18n'

interface Request {
  kind: 'confirm' | 'alert' | 'prompt'
  message: string
  title?: string
  /** A destructive action: red icon and red confirm button. */
  danger?: boolean
  confirmLabel?: string
  resolve: (ok: boolean, text?: string) => void
}

type Ask = (message: string, opts?: { title?: string; danger?: boolean; confirmLabel?: string }) => Promise<boolean>

interface Dialogs {
  confirm: Ask
  alert: (message: string, title?: string) => Promise<void>
  /** Asks for one line of text; resolves to null on Cancel. */
  prompt: (message: string, title?: string) => Promise<string | null>
}

const Ctx = createContext<Dialogs | null>(null)

/**
 * The app's own confirm and alert windows, in place of window.confirm / window.alert: same look as
 * the rest of the app, translated buttons, dark mode. Both return a promise, so call sites read
 * `if (!(await confirm(text))) return`.
 */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<Request | null>(null)
  const confirm = useCallback<Ask>((message, opts = {}) => new Promise((resolve) => setReq({ kind: 'confirm', message, ...opts, resolve })), [])
  const alert = useCallback((message: string, title?: string) => new Promise<void>((resolve) => setReq({ kind: 'alert', message, title, resolve: () => resolve() })), [])
  const prompt = useCallback(
    (message: string, title?: string) => new Promise<string | null>((resolve) => setReq({ kind: 'prompt', message, title, resolve: (ok, text) => resolve(ok ? (text ?? '') : null) })),
    [],
  )
  const value = useRef<Dialogs>({ confirm, alert, prompt }).current
  return (
    <Ctx.Provider value={value}>
      {children}
      {req ? (
        <MessageDialog
          key={req.message}
          req={req}
          onDone={(ok, text) => {
            setReq(null)
            req.resolve(ok, text)
          }}
        />
      ) : null}
    </Ctx.Provider>
  )
}

export function useDialogs() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDialogs outside DialogProvider')
  return ctx
}

function MessageDialog({ req, onDone }: { req: Request; onDone: (ok: boolean, text?: string) => void }) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  const result = useRef(false)
  const [text, setText] = useState('')
  useEffect(() => ref.current?.showModal(), [])
  const close = (ok: boolean) => {
    result.current = ok
    ref.current?.close()
  }
  const tone = req.danger ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' : 'bg-brand/10 text-brand dark:bg-brand/20 dark:text-blue-300'
  return createPortal(
    <dialog
      ref={ref}
      // Esc and the backdrop count as Cancel.
      onClose={() => onDone(result.current, text)}
      onClick={(e) => e.target === e.currentTarget && close(false)}
      className="dialog-panel max-w-md"
    >
      <div className="flex items-start gap-4 px-6 pt-6">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {req.danger ? <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /> : <path d="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />}
          </svg>
        </span>
        <div className="min-w-0 flex-1 pt-1.5">
          <h2 className="text-base font-semibold">{req.title ?? (req.kind === 'prompt' ? req.message : t(req.kind === 'alert' ? 'common.noticeTitle' : 'common.confirmTitle'))}</h2>
          {req.kind === 'prompt' ? (
            <form
              id="dialog-prompt"
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault()
                close(true)
              }}
            >
              <input className="input" autoFocus aria-label={req.message} value={text} onChange={(e) => setText(e.target.value)} />
            </form>
          ) : (
            <p className="mt-2 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">{req.message}</p>
          )}
        </div>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end dark:border-slate-800 dark:bg-slate-800/40">
        {req.kind !== 'alert' ? (
          <button type="button" className="btn-ghost" onClick={() => close(false)}>
            {t('common.cancel')}
          </button>
        ) : null}
        <button type="button" autoFocus={req.kind !== 'prompt'} disabled={req.kind === 'prompt' && !text.trim()} className={req.danger ? 'btn btn-danger' : 'btn'} onClick={() => close(true)}>
          {req.kind === 'alert' ? t('common.ok') : (req.confirmLabel ?? t('common.confirm'))}
        </button>
      </div>
    </dialog>,
    document.body,
  )
}

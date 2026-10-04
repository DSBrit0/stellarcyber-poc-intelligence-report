import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from './i18n'

/**
 * A small "?" next to a label or heading that opens an explanation. It is a modal dialog rather than
 * a popover: the texts can be long (the Verdict guide) and must fit a phone screen. Closes with Esc,
 * the × button or a click on the backdrop. The dialog is portalled to <body>: the "?" often sits
 * inside a <label>, and clicks in the text must not reach the field that label controls.
 */
export function HelpTip({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (open && dialog && !dialog.open) dialog.showModal()
  }, [open])

  return (
    <>
      <button
        type="button"
        className="ml-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-400 align-[0.1em] text-[10px] leading-none font-semibold text-slate-500 hover:border-brand hover:text-brand dark:border-slate-500 dark:text-slate-400"
        aria-label={`${t('help.open')}: ${title}`}
        title={title}
        onClick={(e) => {
          // Inside a <label>, a click must not reach the input it labels.
          e.preventDefault()
          setOpen(true)
        }}
      >
        ?
      </button>
      {open
        ? createPortal(
            <dialog
              ref={ref}
              aria-label={title}
              className="m-auto max-h-[85vh] w-[min(34rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-0 text-left text-sm font-normal text-slate-700 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              onClose={() => setOpen(false)}
              // A click on the backdrop lands on the <dialog> itself, outside its content box.
              onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
            >
              <div className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
                  <button type="button" className="-mt-1 rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={t('help.close')} onClick={() => ref.current?.close()}>
                    ×
                  </button>
                </div>
                {children}
              </div>
            </dialog>,
            document.body,
          )
        : null}
    </>
  )
}

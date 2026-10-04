import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useI18n } from './i18n'

/** The text the User types to confirm. Case and surrounding spaces do not matter. */
const PHRASE = 'Auto Triage'
const confirmed = (typed: string) => typed.trim().toLowerCase() === PHRASE.toLowerCase()

/**
 * Asks the User to confirm that Auto Triage was really tested in the PoC: the next Sync then collects
 * its verdicts and the Report states its add-on license. OK stays disabled until "Auto Triage" is typed.
 */
export function AutoTriageConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (confirmed(typed)) onConfirm()
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="auto-triage-title"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      // Esc closes a <dialog> natively: treat it as Cancel so the checkbox stays off.
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
    >
      <form onSubmit={submit} className="space-y-4 p-5">
        <h2 id="auto-triage-title" className="text-lg font-semibold">
          {t('autoTriage.confirmTitle')}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t('autoTriage.confirmBody')}</p>
        <label className="block">
          <span className="label">{t('autoTriage.confirmType', { phrase: PHRASE })}</span>
          <input className="input" autoFocus autoComplete="off" spellCheck={false} placeholder={PHRASE} value={typed} onChange={(e) => setTyped(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn" disabled={!confirmed(typed)}>
            OK
          </button>
        </div>
      </form>
    </dialog>
  )
}

/**
 * The "Auto Triage was tested" checkbox. Ticking it opens the confirmation; unticking needs none.
 * `note` explains when the choice takes effect (e.g. from the next Sync).
 */
export function AutoTriageCheckbox({ checked, onChange, disabled, note }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; note?: string }) {
  const { t } = useI18n()
  const [asking, setAsking] = useState(false)
  return (
    <>
      <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
          disabled={disabled}
          checked={checked}
          onChange={(e) => (e.target.checked ? setAsking(true) : onChange(false))}
        />
        <span className="text-sm leading-5">
          <span className="font-medium">{t('form.aiTriage')}</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">{note ?? t('form.aiTriageHelp')}</span>
        </span>
      </label>
      {asking ? (
        <AutoTriageConfirm
          onConfirm={() => {
            setAsking(false)
            onChange(true)
          }}
          onCancel={() => setAsking(false)}
        />
      ) : null}
    </>
  )
}

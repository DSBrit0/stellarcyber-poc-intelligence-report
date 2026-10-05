import type { Me } from '@poc-intel/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from './api'
import { errorKey } from './errors'
import { useI18n } from './i18n'

/**
 * Blocking dialog shown while the User must change their password (first sign-in of an account
 * created by an Admin). It cannot be dismissed: the API refuses everything else until it is done.
 * With `onClose`, it is the Root Administrator's own "Change password" (ADR 0013), which can be closed.
 */
export function ChangePasswordDialog({ onClose }: { onClose?: () => void } = {}) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const ref = useRef<HTMLDialogElement>(null)
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (form.next !== form.confirm) return setError(t('password.mismatch'))
    setBusy(true)
    setError(null)
    try {
      await api('/auth/password', { method: 'POST', body: { currentPassword: form.current, newPassword: form.next } })
      qc.setQueryData<Me | null>(['me'], (me) => (me ? { ...me, mustChangePassword: false } : me))
      onClose?.()
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setBusy(false)
    }
  }

  const field = (name: keyof typeof form, label: string, autoComplete: string) => (
    <label className="block">
      <span className="label">{label}</span>
      <input
        className="input"
        type="password"
        required
        minLength={name === 'current' ? 1 : 12}
        autoComplete={autoComplete}
        value={form[name]}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
      />
    </label>
  )

  return (
    <dialog
      ref={ref}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-0 shadow-xl backdrop:bg-slate-900/60 dark:bg-slate-900 dark:text-slate-100"
      onCancel={(e) => (onClose ? onClose() : e.preventDefault())}
      aria-labelledby="change-password-title"
    >
      <form className="space-y-4 p-6" onSubmit={submit}>
        <h2 id="change-password-title" className="text-lg font-semibold">
          {t('password.changeTitle')}
        </h2>
        {onClose ? null : <p className="text-sm text-slate-500">{t('password.changeHelp')}</p>}
        {field('current', t('password.current'), 'current-password')}
        {field('next', t('password.new'), 'new-password')}
        {field('confirm', t('password.confirm'), 'new-password')}
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          {onClose ? (
            <button type="button" className="btn-ghost flex-1" onClick={onClose}>
              {t('catalog.cancel')}
            </button>
          ) : null}
          <button className="btn flex-1" disabled={busy}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </dialog>
  )
}

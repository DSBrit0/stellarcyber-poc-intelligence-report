import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { api } from '../lib/api'
import { errorKey } from '../lib/errors'
import { useI18n } from '../lib/i18n'

// The token travels in the URL fragment, so it never reaches server logs or Referer headers.
export function ResetPasswordPage() {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api('/auth/password-reset', { method: 'POST', body: { token: location.hash.slice(1), newPassword: password } })
      setDone(true)
    } catch (err) {
      setError(t(errorKey(err)))
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <form className="card w-full max-w-sm space-y-4" onSubmit={submit}>
        {done ? (
          <Link to="/login" className="btn w-full">
            {t('auth.signIn')}
          </Link>
        ) : (
          <>
            <label className="block">
              <span className="label">{t('auth.password')}</span>
              <input className="input" type="password" minLength={12} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button className="btn w-full">{t('common.save')}</button>
          </>
        )}
      </form>
    </div>
  )
}

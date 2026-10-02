import type { LoginStep, Me } from '@poc-intel/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { LocaleSwitch } from '../App'
import { api } from '../lib/api'
import { useMe } from '../lib/auth'
import { errorKey } from '../lib/errors'
import { useI18n } from '../lib/i18n'
import logo from '../assets/stellar-cyber-logo.svg'
import logoDark from '../assets/stellar-cyber-logo-dark.svg'

type Stage = 'login' | 'register' | 'registered' | LoginStep

export function LoginPage() {
  const { data: me } = useMe()
  const { t, locale } = useI18n()
  const qc = useQueryClient()
  const [stage, setStage] = useState<Stage>('login')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const [form, setForm] = useState({ email: '', password: '', name: '', company: '', code: '', accessKey: '' })
  const [isCustomer, setIsCustomer] = useState(false)

  if (me) return <Navigate to="/" replace />

  const field = (name: keyof typeof form) => ({
    value: form[name],
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [name]: e.target.value })),
  })

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run(async () => {
      if (stage === 'login') {
        const { step, me } = await api<{ step: LoginStep; me?: Me }>('/auth/login', { method: 'POST', body: { email: form.email, password: form.password } })
        // MFA-exempt accounts are signed in by the password alone.
        if (step === 'done' && me) return void qc.setQueryData(['me'], me)
        if (step === 'mfa_setup') setQr((await api<{ qrDataUrl: string }>('/auth/mfa/setup', { method: 'POST' })).qrDataUrl)
        setStage(step)
      } else if (stage === 'register') {
        await api('/auth/register', {
          method: 'POST',
          body: {
            email: form.email,
            password: form.password,
            name: form.name,
            company: form.company || undefined,
            locale,
            customer: isCustomer ? { name: form.company, accessKey: form.accessKey } : undefined,
          },
        })
        setStage('registered')
      } else if (stage === 'mfa_setup' || stage === 'mfa_verify') {
        const { me } = await api<{ me: Me }>('/auth/mfa/verify', { method: 'POST', body: { code: form.code } })
        qc.setQueryData(['me'], me)
      }
    })
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div className="space-y-2">
            {/* Official logo from the Stellar Cyber console: dark text for light mode, light text for dark mode. */}
            <img src={logo} alt="Stellar Cyber" width={159} height={22} className="h-6 w-auto dark:hidden" />
            <img src={logoDark} alt="Stellar Cyber" width={159} height={22} className="hidden h-6 w-auto dark:block" />
            <h1 className="text-lg font-semibold">{t('app.name')}</h1>
          </div>
          <LocaleSwitch />
        </div>
        <form className="card space-y-4" onSubmit={submit}>
          {stage === 'registered' ? (
            <p className="text-sm">{t('auth.registered')}</p>
          ) : stage === 'mfa_setup' || stage === 'mfa_verify' ? (
            <>
              <h2 className="font-semibold">{t(stage === 'mfa_setup' ? 'mfa.setupTitle' : 'mfa.verifyTitle')}</h2>
              {stage === 'mfa_setup' ? (
                <>
                  <p className="text-sm text-slate-500">{t('mfa.setupHelp')}</p>
                  {qr ? <img src={qr} alt="" className="mx-auto rounded bg-white p-2" width={220} height={220} /> : null}
                </>
              ) : null}
              <label className="block">
                <span className="label">{t('mfa.code')}</span>
                <input className="input tracking-widest" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus {...field('code')} />
              </label>
            </>
          ) : (
            <>
              {stage === 'register' ? (
                <>
                  <label className="block">
                    <span className="label">{t('auth.name')}</span>
                    <input className="input" required autoComplete="name" {...field('name')} />
                  </label>
                  <label className="block">
                    <span className="label">{t('auth.company')}</span>
                    <input className="input" autoComplete="organization" required={isCustomer} {...field('company')} />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={isCustomer} onChange={(e) => setIsCustomer(e.target.checked)} />
                    {t('auth.iamCustomer')}
                  </label>
                  {isCustomer ? (
                    <label className="block">
                      <span className="label">{t('auth.accessKey')}</span>
                      <input className="input font-mono tracking-widest uppercase" required autoComplete="off" placeholder="XXXX-XXXX-XXXX" {...field('accessKey')} />
                    </label>
                  ) : null}
                </>
              ) : null}
              <label className="block">
                <span className="label">{t('auth.email')}</span>
                <input className="input" type="email" required autoComplete="username" {...field('email')} />
              </label>
              <label className="block">
                <span className="label">{t('auth.password')}</span>
                <input
                  className="input"
                  type="password"
                  required
                  minLength={stage === 'register' ? 12 : 1}
                  autoComplete={stage === 'register' ? 'new-password' : 'current-password'}
                  {...field('password')}
                />
              </label>
            </>
          )}

          {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}

          {stage !== 'registered' ? (
            <button className="btn w-full" disabled={busy}>
              {stage === 'register' ? t('auth.register') : stage === 'login' ? t('auth.signIn') : t('common.continue')}
            </button>
          ) : null}

          {stage === 'login' || stage === 'register' || stage === 'registered' ? (
            <button
              type="button"
              className="w-full text-center text-sm text-brand hover:underline"
              onClick={() => {
                setError(null)
                setStage(stage === 'login' ? 'register' : 'login')
              }}
            >
              {stage === 'login' ? t('auth.register') : t('auth.signIn')}
            </button>
          ) : null}
        </form>
      </div>
    </div>
  )
}

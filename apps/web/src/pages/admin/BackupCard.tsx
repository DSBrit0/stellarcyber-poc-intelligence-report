import { useState, type FormEvent } from 'react'
import { ApiError } from '../../lib/api'
import { useMe } from '../../lib/auth'
import { useDialogs } from '../../lib/dialogs'
import { errorKey } from '../../lib/errors'
import { useI18n } from '../../lib/i18n'

const MIN_PASSWORD = 12

async function failure(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return new ApiError(res.status, body.error ?? 'internal')
}

/**
 * Download: the server dumps the database now and returns one AES-256 ZIP locked with the password
 * typed here. Restore (Root Administrator): the ZIP and its password replace the whole database,
 * the way a new server is brought back after `deploy.sh`.
 */
export function BackupCard() {
  const { t } = useI18n()
  const { data: me } = useMe()
  return (
    <section className="card space-y-4">
      <div>
        <h2 className="font-semibold">{t('backup.title')}</h2>
        <p className="max-w-3xl text-sm text-slate-500">{t('backup.help')}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <DownloadForm />
        {me?.isRoot ? <RestoreForm /> : <p className="text-sm text-slate-500">{t('backup.restoreRootOnly')}</p>}
      </div>
    </section>
  )
}

function DownloadForm() {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const problem = password.length < MIN_PASSWORD ? t('backup.passwordShort', { n: MIN_PASSWORD }) : password !== repeat ? t('backup.passwordMismatch') : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (problem) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) throw await failure(res)
      const name = /filename\*=UTF-8''([^;]+)/.exec(res.headers.get('content-disposition') ?? '')?.[1]
      const href = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = href
      a.download = name ? decodeURIComponent(name) : 'poc-intel-backup.zip'
      a.click()
      setTimeout(() => URL.revokeObjectURL(href), 10_000)
      setPassword('')
      setRepeat('')
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="space-y-3" onSubmit={(e) => void submit(e)}>
      <h3 className="text-sm font-semibold">{t('backup.download')}</h3>
      <label className="block">
        <span className="label">{t('backup.password')}</span>
        <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <label className="block">
        <span className="label">{t('backup.passwordRepeat')}</span>
        <input className="input" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      </label>
      <p className="text-xs text-slate-500">{password || repeat ? (problem ?? t('backup.passwordKeep')) : t('backup.passwordKeep')}</p>
      <button type="submit" className="btn" disabled={busy || problem != null}>
        {busy ? t('backup.generating') : t('backup.downloadButton')}
      </button>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </form>
  )
}

function RestoreForm() {
  const { t } = useI18n()
  const { confirm, alert } = useDialogs()
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file || !password) return
    if (!(await confirm(t('backup.restoreConfirm', { file: file.name }), { title: t('backup.restore'), danger: true, confirmLabel: t('backup.restoreButton') }))) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/zip', 'x-backup-password': password },
        body: file,
      })
      if (!res.ok) throw await failure(res)
      const summary = (await res.json()) as { createdAt: string; mfaReset: number }
      await alert(t('backup.restored', { date: new Date(summary.createdAt).toLocaleString(), reset: summary.mfaReset }), t('backup.restore'))
      // Every session ended with the restore: sign in again with an account from the backup.
      window.location.href = '/'
    } catch (err) {
      setError(t(errorKey(err)))
      setBusy(false)
    }
  }

  return (
    <form className="space-y-3" onSubmit={(e) => void submit(e)}>
      <h3 className="text-sm font-semibold">{t('backup.restore')}</h3>
      <label className="block">
        <span className="label">{t('backup.file')}</span>
        <input className="input" type="file" accept=".zip,application/zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <label className="block">
        <span className="label">{t('backup.password')}</span>
        <input className="input" type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <p className="text-xs text-slate-500">{t('backup.restoreHelp')}</p>
      <button type="submit" className="btn-danger" disabled={busy || !file || !password}>
        {busy ? t('backup.restoring') : t('backup.restoreButton')}
      </button>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </form>
  )
}

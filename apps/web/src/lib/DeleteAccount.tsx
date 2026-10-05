import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api } from './api'
import { errorKey } from './errors'
import { useI18n } from './i18n'

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
    </svg>
  )
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => ref.current?.showModal(), [])
  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl bg-white p-0 text-left shadow-xl backdrop:bg-slate-900/60 dark:bg-slate-900 dark:text-slate-100">
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" className="btn-ghost" onClick={() => ref.current?.close()} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

/** Refreshes every list a deletion can change. */
function useRefreshLists() {
  const qc = useQueryClient()
  return () => {
    for (const key of [['admin', 'users'], ['customers'], ['customer-users'], ['pocs']]) void qc.invalidateQueries({ queryKey: key })
  }
}

/**
 * Deletes a User account for good. When the User owns PoCs or Companies, they are handed to someone
 * chosen here first; otherwise only the account goes.
 */
export function DeleteUserButton({ userId, label }: { userId: string; label: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="btn-ghost text-red-600 hover:bg-red-50" title={t('del.userTitle')} aria-label={`${t('del.userTitle')}: ${label}`} onClick={() => setOpen(true)}>
        <TrashIcon />
      </button>
      {open ? <DeleteUserDialog userId={userId} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

interface UserDeletion {
  name: string
  email: string
  owns: { pocs: number; companies: number }
  candidates: { id: string; name: string; email: string }[]
}

function DeleteUserDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t } = useI18n()
  const refresh = useRefreshLists()
  const info = useQuery({ queryKey: ['deletion', 'user', userId], queryFn: () => api<UserDeletion>(`/accounts/users/${userId}/deletion`), gcTime: 0 })
  const [transferTo, setTransferTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const owns = info.data ? info.data.owns.pocs + info.data.owns.companies > 0 : false
  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await api(`/accounts/users/${userId}`, { method: 'DELETE', body: { transferTo: owns ? transferTo : null } })
      refresh()
      onClose()
    } catch (err) {
      setError(t(errorKey(err)))
      setBusy(false)
    }
  }
  return (
    <Dialog title={t('del.userTitle')} onClose={onClose}>
      {info.error ? <p className="text-sm text-red-600">{t(errorKey(info.error))}</p> : null}
      {info.data ? (
        <>
          <p className="text-sm">
            <b>{info.data.name}</b> <span className="text-slate-500">({info.data.email})</span>
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{t('del.userPermanent')}</p>
          {owns ? (
            <label className="block">
              <span className="label">{t('del.transferTo', { pocs: info.data.owns.pocs, companies: info.data.owns.companies })}</span>
              <select className="input" value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                <option value="" disabled>
                  {t('del.chooseUser')}
                </option>
                {info.data.candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm text-slate-500">{t('del.ownsNothing')}</p>
          )}
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              {t('catalog.cancel')}
            </button>
            <button type="button" className="btn bg-red-600 hover:bg-red-700" disabled={busy || (owns && !transferTo)} onClick={() => void remove()}>
              {t(owns ? 'del.transferAndDelete' : 'del.delete')}
            </button>
          </div>
        </>
      ) : null}
    </Dialog>
  )
}

/** Deletes a Company and everything that depends on it, after showing what goes and asking for its name. */
export function DeleteCompanyButton({ companyId, name }: { companyId: string; name: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="btn-ghost text-red-600 hover:bg-red-50" title={t('del.companyTitle')} aria-label={`${t('del.companyTitle')}: ${name}`} onClick={() => setOpen(true)}>
        <TrashIcon />
      </button>
      {open ? <DeleteCompanyDialog companyId={companyId} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

interface CompanyDeletion {
  name: string
  users: number
  pocs: number
  reports: number
  companies: number
}

function DeleteCompanyDialog({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const { t } = useI18n()
  const refresh = useRefreshLists()
  const info = useQuery({ queryKey: ['deletion', 'company', companyId], queryFn: () => api<CompanyDeletion>(`/accounts/companies/${companyId}/deletion`), gcTime: 0 })
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const matches = info.data != null && typed.trim().toLowerCase().replace(/\s+/g, ' ') === info.data.name.trim().toLowerCase().replace(/\s+/g, ' ')
  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await api(`/accounts/companies/${companyId}`, { method: 'DELETE', body: { confirmName: typed } })
      refresh()
      onClose()
    } catch (err) {
      setError(t(errorKey(err, { sync_in_progress: 'del.syncing' })))
      setBusy(false)
    }
  }
  return (
    <Dialog title={t('del.companyTitle')} onClose={onClose}>
      {info.error ? <p className="text-sm text-red-600">{t(errorKey(info.error))}</p> : null}
      {info.data ? (
        <>
          <p className="text-sm">
            <b>{info.data.name}</b>
          </p>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            <p className="font-medium">{t('del.companyWarning')}</p>
            <ul className="mt-1 list-disc pl-5">
              <li>{t('del.countUsers', { n: info.data.users })}</li>
              <li>{t('del.countPocs', { n: info.data.pocs })}</li>
              <li>{t('del.countReports', { n: info.data.reports })}</li>
              {info.data.companies > 1 ? <li>{t('del.countCompanies', { n: info.data.companies - 1 })}</li> : null}
            </ul>
            <p className="mt-2">{t('del.irreversible')}</p>
          </div>
          <label className="block">
            <span className="label">{t('del.typeName', { name: info.data.name })}</span>
            <input className="input" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
          </label>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              {t('catalog.cancel')}
            </button>
            <button type="button" className="btn bg-red-600 hover:bg-red-700" disabled={busy || !matches} onClick={() => void remove()}>
              {t('del.deleteAll')}
            </button>
          </div>
        </>
      ) : null}
    </Dialog>
  )
}

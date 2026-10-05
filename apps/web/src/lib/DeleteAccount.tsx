import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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

/**
 * The deletion dialog. It is rendered at the end of <body>, never inside the table row that opens it,
 * so the row's styles (no wrapping, small buttons, right alignment) cannot leak into it.
 */
function Dialog({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => ref.current?.showModal(), [])
  return createPortal(
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-left text-sm whitespace-normal text-slate-900 shadow-2xl backdrop:bg-slate-900/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="flex items-start gap-3 px-6 pt-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="mt-3 space-y-3">{children}</div>
        </div>
        <button
          type="button"
          className="-mt-1 -mr-2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          onClick={() => ref.current?.close()}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end dark:border-slate-800 dark:bg-slate-800/40">{footer}</div>
    </dialog>,
    document.body,
  )
}

const DANGER = 'btn bg-red-600 hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500/40'

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
    <Dialog
      title={t('del.userTitle')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t('catalog.cancel')}
          </button>
          <button type="button" className={DANGER} disabled={!info.data || busy || (owns && !transferTo)} onClick={() => void remove()}>
            {t(owns ? 'del.transferAndDelete' : 'del.delete')}
          </button>
        </>
      }
    >
      {info.error ? <p className="text-red-600">{t(errorKey(info.error))}</p> : null}
      {info.data ? (
        <>
          <div className="rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
            <p className="font-medium">{info.data.name}</p>
            <p className="break-all text-slate-500">{info.data.email}</p>
          </div>
          <p className="text-slate-600 dark:text-slate-300">{t('del.userPermanent')}</p>
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
            <p className="text-slate-500">{t('del.ownsNothing')}</p>
          )}
          {error ? (
            <p className="text-red-600" role="alert">
              {error}
            </p>
          ) : null}
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
    <Dialog
      title={t('del.companyTitle')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t('catalog.cancel')}
          </button>
          <button type="button" className={DANGER} disabled={busy || !matches} onClick={() => void remove()}>
            {t('del.deleteAll')}
          </button>
        </>
      }
    >
      {info.error ? <p className="text-red-600">{t(errorKey(info.error))}</p> : null}
      {info.data ? (
        <>
          <div className="rounded-lg bg-slate-100 px-3 py-2 font-medium dark:bg-slate-800">{info.data.name}</div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
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
            <p className="text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </>
      ) : null}
    </Dialog>
  )
}

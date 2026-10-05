import type { Me } from '@poc-intel/shared'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from './i18n'

/** Initials of a name, for the avatar. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')

/**
 * Avatar button in the header that opens the account menu: who is signed in, the Root
 * Administrator's "Change password" (ADR 0013) and Sign out. Keeps the header to one row.
 */
export function UserMenu({ me, onChangePassword, onSignOut }: { me: Me; onChangePassword: () => void; onSignOut: () => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const item = 'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800'
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="flex cursor-pointer items-center gap-2 rounded-full py-0.5 pr-2 pl-0.5 transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none dark:hover:bg-slate-800"
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${me.name} · ${me.email}`}
        onClick={() => setOpen(!open)}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand dark:bg-brand/25 dark:text-blue-200" aria-hidden="true">
          {initials(me.name)}
        </span>
        <span className="hidden max-w-36 truncate text-slate-700 xl:inline dark:text-slate-200">{me.name.split(/\s+/)[0]}</span>
        <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" className={`opacity-50 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div role="menu" className="select-panel absolute top-full right-0 mt-2 w-64">
          <div className="border-b border-slate-200 px-2.5 pt-1.5 pb-2.5 dark:border-slate-700">
            <div className="truncate font-semibold">{me.name}</div>
            <div className="truncate text-xs text-slate-500 dark:text-slate-400">{me.email}</div>
            <span className="mt-1.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {me.isRoot ? 'Root · ' : ''}
              {t(`role.${me.role}`)}
            </span>
          </div>
          <div className="pt-1">
            {me.isRoot ? (
              <button
                type="button"
                role="menuitem"
                className={item}
                onClick={() => {
                  setOpen(false)
                  onChangePassword()
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="opacity-60">
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                {t('root.changePassword')}
              </button>
            ) : null}
            <button type="button" role="menuitem" className={item} onClick={onSignOut}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="opacity-60">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              {t('nav.signOut')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

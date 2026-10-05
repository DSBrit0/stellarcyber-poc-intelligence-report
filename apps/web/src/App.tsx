import { LOCALES, type Locale } from '@poc-intel/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router'
import { ChangePasswordDialog } from './lib/ChangePasswordDialog'
import { api } from './lib/api'
import { useMe } from './lib/auth'
import { useI18n } from './lib/i18n'
import { AdminPage } from './pages/Admin'
import { AuditPage } from './pages/Audit'
import { CustomersPage } from './pages/Customers'
import { LoginPage } from './pages/Login'
import { PocDetailPage } from './pages/PocDetail'
import { PocListPage } from './pages/PocList'
import { PocNewPage } from './pages/PocNew'
import { TemplatePage } from './pages/admin/TemplatePage'
import { ResetPasswordPage } from './pages/ResetPassword'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/" element={<Shell><PocListPage /></Shell>} />
        <Route path="/pocs/new" element={<Shell><PocNewPage /></Shell>} />
        <Route path="/pocs/:id" element={<Shell><PocDetailPage /></Shell>} />
        <Route path="/admin" element={<Shell adminOnly><AdminPage /></Shell>} />
        <Route path="/admin/template" element={<Shell adminOnly><TemplatePage /></Shell>} />
        <Route path="/audit" element={<Shell adminOnly><AuditPage /></Shell>} />
        <Route path="/customers" element={<Shell staffOnly><CustomersPage /></Shell>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export function LocaleSwitch() {
  const { locale, setLocale } = useI18n()
  return (
    <select
      aria-label="Language"
      className="rounded-md border border-slate-300 bg-transparent px-2 py-1 text-sm dark:border-slate-700"
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
    >
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {l}
        </option>
      ))}
    </select>
  )
}

function Shell({ children, adminOnly, staffOnly }: { children: ReactNode; adminOnly?: boolean; staffOnly?: boolean }) {
  const { data: me, isLoading } = useMe()
  const { t } = useI18n()
  const qc = useQueryClient()
  const [changingPassword, setChangingPassword] = useState(false)

  if (isLoading) return null
  if (!me) return <Navigate to="/login" replace />
  if (adminOnly && me.role !== 'admin') return <Navigate to="/" replace />
  if (staffOnly && me.role === 'customer') return <Navigate to="/" replace />

  const signOut = async () => {
    await api('/auth/logout', { method: 'POST' })
    qc.setQueryData(['me'], null)
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {/* Narrow screens: brand and actions on the first row, the nav scrolls on its own second row. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link to="/" className="min-w-0 truncate font-semibold">
            {t('app.name')}
          </Link>
          <nav className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-4 overflow-x-auto px-4 text-sm whitespace-nowrap sm:order-none sm:mx-0 sm:w-auto sm:px-0">
            {me.role !== 'customer' ? <Link to="/customers">{t('nav.customers')}</Link> : null}
            {me.role === 'admin' ? <Link to="/admin">{t('nav.admin')}</Link> : null}
            {me.role === 'admin' ? <Link to="/audit">{t('nav.audit')}</Link> : null}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-3 text-sm">
            <span className="hidden max-w-48 truncate text-slate-500 sm:inline" title={me.email}>
              {me.name}
            </span>
            <LocaleSwitch />
            {/* Only the Root Administrator changes their password here (ADR 0013); others use the reset link. */}
            {me.isRoot ? (
              <button className="btn-ghost whitespace-nowrap" onClick={() => setChangingPassword(true)}>
                {t('root.changePassword')}
              </button>
            ) : null}
            <button className="btn-ghost whitespace-nowrap" onClick={signOut} title={`${me.name} · ${me.email}`}>
              {t('nav.signOut')}
            </button>
          </div>
        </div>
      </header>
      {changingPassword ? <ChangePasswordDialog onClose={() => setChangingPassword(false)} /> : null}
      {me.mustChangePassword ? <ChangePasswordDialog /> : <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>}
    </div>
  )
}

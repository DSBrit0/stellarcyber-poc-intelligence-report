import { LOCALES, type Locale } from '@poc-intel/shared'
import { useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router'
import { ChangePasswordDialog } from './lib/ChangePasswordDialog'
import { api } from './lib/api'
import { useMe } from './lib/auth'
import { useI18n } from './lib/i18n'
import { AdminPage } from './pages/Admin'
import { CustomersPage } from './pages/Customers'
import { LoginPage } from './pages/Login'
import { PocDetailPage } from './pages/PocDetail'
import { PocListPage } from './pages/PocList'
import { PocNewPage } from './pages/PocNew'
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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/" className="font-semibold">
            {t('app.name')}
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/">{t('nav.pocs')}</Link>
            {me.role !== 'customer' ? <Link to="/customers">{t('nav.customers')}</Link> : null}
            {me.role === 'admin' ? <Link to="/admin">{t('nav.admin')}</Link> : null}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">{me.name}</span>
            <LocaleSwitch />
            <button className="btn-ghost" onClick={signOut}>
              {t('nav.signOut')}
            </button>
          </div>
        </div>
      </header>
      {me.mustChangePassword ? <ChangePasswordDialog /> : <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>}
    </div>
  )
}

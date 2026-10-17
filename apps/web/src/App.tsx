import { useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router'
import { ChangePasswordDialog } from './lib/ChangePasswordDialog'
import { api } from './lib/api'
import { useMe } from './lib/auth'
import { useI18n } from './lib/i18n'
import { LanguageSelect } from './lib/LanguageSelect'
import { UserMenu } from './lib/UserMenu'
import logo from './assets/stellar-cyber-logo.svg'
import logoDark from './assets/stellar-cyber-logo-dark.svg'
import { AdminPage } from './pages/Admin'
import { AuditPage } from './pages/Audit'
import { CustomersPage } from './pages/Customers'
import { LoginPage } from './pages/Login'
import { PocDetailPage } from './pages/PocDetail'
import { PocListPage } from './pages/PocList'
import { PocNewPage } from './pages/PocNew'
import { TemplatePage } from './pages/admin/TemplatePage'
import { HelpPage } from './pages/help/HelpPage'
import { ResetPasswordPage } from './pages/ResetPassword'

// The Stellar Experience carries its own heavy scene: loaded only when someone opens one.
const ExperiencePage = lazy(() => import('./pages/experience/ExperiencePage').then((m) => ({ default: m.ExperiencePage })))
// The visual lab exists only in dev builds: production drops the route and its code.
const ExperienceLab = import.meta.env.DEV ? lazy(() => import('./pages/experience/lab/ExperienceLab').then((m) => ({ default: m.ExperienceLab }))) : null

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/" element={<Shell><PocListPage /></Shell>} />
        <Route path="/pocs/new" element={<Shell><PocNewPage /></Shell>} />
        <Route path="/pocs/:id" element={<Shell><PocDetailPage /></Shell>} />
        <Route path="/pocs/:id/experiences/:expId" element={<FullScreen><ExperiencePage /></FullScreen>} />
        {ExperienceLab ? <Route path="/lab/experience" element={<Suspense fallback={null}><ExperienceLab /></Suspense>} /> : null}
        <Route path="/admin" element={<Shell adminOnly><AdminPage /></Shell>} />
        <Route path="/admin/template" element={<Shell adminOnly><TemplatePage /></Shell>} />
        <Route path="/audit" element={<Shell adminOnly><AuditPage /></Shell>} />
        <Route path="/customers" element={<Shell staffOnly><CustomersPage /></Shell>} />
        <Route path="/help" element={<Shell><HelpPage /></Shell>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export function LocaleSwitch() {
  const { locale, setLocale, t } = useI18n()
  return <LanguageSelect compact className="input w-auto py-1.5" label={t('nav.language')} value={locale} onChange={setLocale} />
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-2.5 py-1.5 transition-colors ${isActive ? 'bg-brand/10 font-medium text-brand dark:bg-brand/20 dark:text-blue-300' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'}`

/** A signed-in page without the app's header: the Stellar Experience fills the screen. */
function FullScreen({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useMe()
  if (isLoading) return null
  if (!me) return <Navigate to="/login" replace />
  if (me.mustChangePassword) return <Navigate to="/" replace />
  return <Suspense fallback={<div className="min-h-dvh bg-sc-midnight" />}>{children}</Suspense>
}

function Shell({ children, adminOnly, staffOnly }: { children: ReactNode; adminOnly?: boolean; staffOnly?: boolean }) {
  const { data: me, isLoading } = useMe()
  const { t } = useI18n()
  const qc = useQueryClient()
  const [changingPassword, setChangingPassword] = useState(false)
  const { pathname } = useLocation()

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
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        {/* Narrow screens: brand and actions on the first row, the nav scrolls on its own second row. */}
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="Stellar Cyber" width={159} height={22} className="h-5 w-auto dark:hidden" />
            <img src={logoDark} alt="Stellar Cyber" width={159} height={22} className="hidden h-5 w-auto dark:block" />
            <span className="hidden truncate border-l border-slate-300 pl-3 text-sm font-semibold md:inline dark:border-slate-700">{t('app.name')}</span>
          </Link>
          <nav className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 text-sm whitespace-nowrap md:order-none md:mx-0 md:w-auto md:px-0">
            <NavLink to="/" className={() => navClass({ isActive: pathname === '/' || pathname.startsWith('/pocs') })}>
              {t('nav.pocs')}
            </NavLink>
            {me.role !== 'customer' ? <NavLink to="/customers" className={navClass}>{t('nav.customers')}</NavLink> : null}
            {me.role === 'admin' ? <NavLink to="/admin" className={navClass}>{t('nav.admin')}</NavLink> : null}
            {me.role === 'admin' ? <NavLink to="/audit" className={navClass}>{t('nav.audit')}</NavLink> : null}
            <NavLink to="/help" className={navClass}>{t('nav.help')}</NavLink>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2 text-sm">
            <LocaleSwitch />
            <UserMenu me={me} onChangePassword={() => setChangingPassword(true)} onSignOut={() => void signOut()} />
          </div>
        </div>
      </header>
      {changingPassword ? <ChangePasswordDialog onClose={() => setChangingPassword(false)} /> : null}
      {me.mustChangePassword ? <ChangePasswordDialog /> : <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>}
    </div>
  )
}

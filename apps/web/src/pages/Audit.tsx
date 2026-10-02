import type { MessageKey } from '@poc-intel/shared/i18n'
import { useSearchParams } from 'react-router'
import { useI18n } from '../lib/i18n'
import { ActivityTab } from './audit/Activity'
import { ApiTab } from './audit/Api'
import { LogsTab } from './audit/Logs'
import { OverviewTab } from './audit/Overview'
import { SyncsTab } from './audit/Syncs'

const TABS = ['overview', 'activity', 'api', 'syncs', 'logs'] as const
type Tab = (typeof TABS)[number]

/** The Admin's Audit page. The tab and its filters live in the URL, so a view can be shared or reloaded. */
export function AuditPage() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'overview'

  /** Opens another tab, optionally with filters (e.g. the API calls of one Sync). */
  const go = (next: Tab, filters: Record<string, string> = {}) => setParams({ tab: next, ...filters })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('audit.title')}</h1>
          <p className="text-sm text-slate-500">{t('audit.subtitle')}</p>
        </div>
      </div>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {TABS.map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap ${tab === id ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            onClick={() => go(id)}
          >
            {t(`audit.tab.${id}` as MessageKey)}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'overview' ? <OverviewTab go={go} /> : null}
        {tab === 'activity' ? <ActivityTab params={params} /> : null}
        {tab === 'api' ? <ApiTab params={params} /> : null}
        {tab === 'syncs' ? <SyncsTab params={params} go={go} /> : null}
        {tab === 'logs' ? <LogsTab params={params} /> : null}
      </div>
    </div>
  )
}

export type Go = (tab: Tab, filters?: Record<string, string>) => void

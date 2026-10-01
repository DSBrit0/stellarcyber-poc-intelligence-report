import type { StellarCredential } from '@poc-intel/shared'
import { useI18n } from './i18n'

/** Stellar Credential inputs. The value lives only in component state and is sent once per request. */
export function CredentialFields({ value, onChange }: { value: StellarCredential; onChange: (c: StellarCredential) => void }) {
  const { t } = useI18n()
  return (
    <fieldset className="space-y-3">
      <div className="flex gap-4 text-sm">
        {(['apiKey', 'basic'] as const).map((m) => (
          <label key={m} className="flex items-center gap-2">
            <input
              type="radio"
              checked={value.method === m}
              onChange={() => onChange(m === 'apiKey' ? { method: 'apiKey', apiKey: '' } : { method: 'basic', username: '', token: '' })}
            />
            {m === 'apiKey' ? t('sync.apiKey') : `${t('sync.username')} + ${t('sync.token')}`}
          </label>
        ))}
      </div>
      {value.method === 'apiKey' ? (
        <input className="input" type="password" autoComplete="off" required placeholder={t('sync.apiKey')} value={value.apiKey} onChange={(e) => onChange({ ...value, apiKey: e.target.value })} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="input" autoComplete="off" required placeholder={t('sync.username')} value={value.username} onChange={(e) => onChange({ ...value, username: e.target.value })} />
          <input className="input" type="password" autoComplete="off" required placeholder={t('sync.token')} value={value.token} onChange={(e) => onChange({ ...value, token: e.target.value })} />
        </div>
      )}
      <p className="text-xs text-slate-500">{t('sync.credentialHelp')}</p>
    </fieldset>
  )
}

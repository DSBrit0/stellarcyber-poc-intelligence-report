import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { useI18n } from './i18n'

export interface CustomerRow {
  id: string
  name: string
  instanceUrl: string | null
  pocs: number
  users: number
  pending: number
}

export const useCustomers = () => useQuery({ queryKey: ['customers'], queryFn: () => api<CustomerRow[]>('/customers') })

/** Links a PoC to a Customer, which gives that Customer's users read access to its Reports. */
export function CustomerSelect({ value, onChange, disabled }: { value: string | null; onChange: (id: string | null) => void; disabled?: boolean }) {
  const { t } = useI18n()
  const { data = [] } = useCustomers()
  return (
    <label className="block">
      <span className="label">{t('form.linkCustomer')}</span>
      <select className="input" disabled={disabled} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{t('form.noCustomer')}</option>
        {data.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  )
}

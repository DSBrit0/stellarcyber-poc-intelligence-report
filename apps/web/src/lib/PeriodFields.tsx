import { DateInput } from './DateInput'
import { useI18n } from './i18n'

// The collection period: up to 30 days, ending yesterday (UTC) at the latest, since only past days
// have complete data. Choosing a start suggests the end (+29 days, at most yesterday).

const DAY = 86_400_000
export const MAX_DAYS = 30
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10)
export const yesterday = () => isoDay(Date.now() - DAY)
const addDays = (iso: string, n: number) => isoDay(Date.parse(`${iso}T00:00:00Z`) + n * DAY)
const minIso = (a: string, b: string) => (a < b ? a : b)

export const periodOk = (start: string, end: string) =>
  Boolean(start && end && start <= end && end <= yesterday() && (Date.parse(end) - Date.parse(start)) / DAY + 1 <= MAX_DAYS)

export function PeriodFields({ start, end, onChange }: { start: string; end: string; onChange: (start: string, end: string) => void }) {
  const { t } = useI18n()
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <DateInput
          label={t('wiz.start')}
          required
          value={start}
          max={yesterday()}
          onChange={(iso) => {
            const keep = end && end >= iso && (Date.parse(end) - Date.parse(iso)) / DAY + 1 <= MAX_DAYS
            onChange(iso, keep ? end : minIso(addDays(iso, MAX_DAYS - 1), yesterday()))
          }}
        />
        <DateInput label={t('wiz.end')} required value={end} min={start || undefined} max={start ? minIso(addDays(start, MAX_DAYS - 1), yesterday()) : yesterday()} onChange={(iso) => onChange(start, iso)} />
      </div>
      {start && !periodOk(start, end) ? <p className="text-sm text-red-600">{t('err.period')}</p> : null}
    </>
  )
}

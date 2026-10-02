import { EFFORT_DEFAULTS, VERDICTS, type PocDetails } from '@poc-intel/shared'
import type { MessageKey } from '@poc-intel/shared/i18n'
import type { ReactNode } from 'react'
import { useI18n } from './i18n'

export const emptyDetails = (customerName = ''): PocDetails => ({
  customerName,
  department: '',
  customerEmail: '',
  analysts: [],
  successCriteria: '',
  salesEngineer: { name: '', email: '', phone: '' },
  partner: { name: '', email: '', site: '' },
  platformVersion: '',
  region: '',
  version: '1.0',
  verdict: null,
  comments: '',
  aiTriageTested: false,
  effort: { ...EFFORT_DEFAULTS },
})

function Fieldset({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="card space-y-3">
      <legend className="px-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{title}</legend>
      {children}
    </fieldset>
  )
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  )
}

/** Every PoC detail of the previous tool's form, plus AI Triage. Controlled: the parent owns the value. */
export function PocForm({ value, onChange, readOnly }: { value: PocDetails; onChange: (v: PocDetails) => void; readOnly?: boolean }) {
  const { t } = useI18n()
  const set = <K extends keyof PocDetails>(k: K, v: PocDetails[K]) => onChange({ ...value, [k]: v })
  const text = (k: 'customerName' | 'department' | 'customerEmail' | 'platformVersion' | 'region', label: MessageKey, max: number, type = 'text') => (
    <Field label={t(label)}>
      <input className="input" type={type} maxLength={max} disabled={readOnly} value={value[k]} onChange={(e) => set(k, e.target.value)} required={k === 'customerName'} />
    </Field>
  )
  const nested = <G extends 'salesEngineer' | 'partner'>(g: G, k: keyof PocDetails[G] & string, label: MessageKey, max: number) => (
    <Field label={t(label)}>
      <input
        className="input"
        maxLength={max}
        disabled={readOnly}
        value={String(value[g][k] ?? '')}
        onChange={(e) => onChange({ ...value, [g]: { ...value[g], [k]: e.target.value } })}
      />
    </Field>
  )
  const effort = (k: keyof PocDetails['effort'], label: MessageKey) => (
    <Field label={t(label)}>
      <input
        className="input"
        type="number"
        min={k === 'monthHours' ? 1 : 0}
        step="any"
        disabled={readOnly}
        value={value.effort[k]}
        onChange={(e) => set('effort', { ...value.effort, [k]: e.target.value === '' ? EFFORT_DEFAULTS[k] : Number(e.target.value) })}
      />
    </Field>
  )

  return (
    <div className="space-y-4">
      <Fieldset title={t('form.sectionCustomer')}>
        <div className="grid gap-3 sm:grid-cols-2">
          {text('customerName', 'form.customerName', 160)}
          {text('department', 'form.department', 160)}
          {text('customerEmail', 'form.customerEmail', 254, 'email')}
          {text('region', 'form.region', 80)}
          <Field label={t('form.analysts')} wide>
            <textarea
              className="input"
              rows={3}
              disabled={readOnly}
              value={value.analysts.join('\n')}
              onChange={(e) => set('analysts', e.target.value.split('\n').map((s) => s.slice(0, 60)).slice(0, 50))}
            />
          </Field>
        </div>
      </Fieldset>

      <Fieldset title={t('form.sectionContacts')}>
        <div className="grid gap-3 sm:grid-cols-3">
          {nested('salesEngineer', 'name', 'form.seName', 120)}
          {nested('salesEngineer', 'email', 'form.seEmail', 254)}
          {nested('salesEngineer', 'phone', 'form.sePhone', 40)}
          {nested('partner', 'name', 'form.partnerName', 120)}
          {nested('partner', 'email', 'form.partnerEmail', 254)}
          {nested('partner', 'site', 'form.partnerSite', 254)}
        </div>
      </Fieldset>

      <Fieldset title={t('form.sectionScope')}>
        <div className="grid gap-3 sm:grid-cols-3">
          {text('platformVersion', 'form.platformVersion', 40)}
          <Field label={t('form.verdict')}>
            <select className="input" disabled={readOnly} value={value.verdict ?? ''} onChange={(e) => set('verdict', (e.target.value || null) as PocDetails['verdict'])}>
              <option value="">{t('form.verdictNone')}</option>
              {VERDICTS.map((v) => (
                <option key={v} value={v}>
                  {t(`form.verdict.${v}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={`${t('form.successCriteria')} (${value.successCriteria.length}/550)`}>
          <textarea className="input" rows={3} maxLength={550} disabled={readOnly} value={value.successCriteria} onChange={(e) => set('successCriteria', e.target.value)} />
        </Field>
        <Field label={`${t('form.comments')} (${value.comments.length}/1500)`}>
          <textarea className="input" rows={4} maxLength={1500} disabled={readOnly} value={value.comments} onChange={(e) => set('comments', e.target.value)} />
        </Field>
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <input type="checkbox" className="mt-1" disabled={readOnly} checked={value.aiTriageTested} onChange={(e) => set('aiTriageTested', e.target.checked)} />
          <span>
            <span className="font-medium">{t('form.aiTriage')}</span>
            <span className="block text-xs text-slate-500">{t('form.aiTriageHelp')}</span>
          </span>
        </label>
      </Fieldset>

      <Fieldset title={t('form.sectionEffort')}>
        <div className="grid gap-3 sm:grid-cols-5">
          {effort('alertMin', 'form.effortAlert')}
          {effort('critHighMin', 'form.effortCritHigh')}
          {effort('mediumMin', 'form.effortMedium')}
          {effort('lowMin', 'form.effortLow')}
          {effort('monthHours', 'form.effortMonth')}
        </div>
      </Fieldset>
    </div>
  )
}

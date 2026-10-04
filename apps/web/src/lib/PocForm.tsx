import { EFFORT_DEFAULTS, VERDICTS, type PocDetails } from '@poc-intel/shared'
import type { MessageKey } from '@poc-intel/shared/i18n'
import type { ReactNode } from 'react'
import { AutoTriageCheckbox } from './AutoTriage'
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

/** A group of the form: a heading with a divider above it, never a card inside the page's card. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-slate-200 pt-4 first:border-t-0 first:pt-0 dark:border-slate-800">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      {children}
    </section>
  )
}

/** Grid of fields; `items-end` lines the inputs up when a label wraps to two lines. */
function Row({ cols, children }: { cols: string; children: ReactNode }) {
  return <div className={`grid items-end gap-3 ${cols}`}>{children}</div>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="label">{label}</span>
      {children}
    </label>
  )
}

/**
 * Every PoC detail, in the order and groups of the previous tool's form, plus Auto Triage.
 * Controlled: the parent owns the value. `autoTriageNote` says when an Auto Triage change applies.
 */
export function PocForm({ value, onChange, readOnly, autoTriageNote }: { value: PocDetails; onChange: (v: PocDetails) => void; readOnly?: boolean; autoTriageNote?: string }) {
  const { t } = useI18n()
  const set = <K extends keyof PocDetails>(k: K, v: PocDetails[K]) => onChange({ ...value, [k]: v })
  const text = (k: 'customerName' | 'department' | 'customerEmail' | 'platformVersion' | 'region', label: MessageKey, max: number, type = 'text') => (
    <Field label={t(label)}>
      <input className="input" type={type} maxLength={max} disabled={readOnly} value={value[k]} onChange={(e) => set(k, e.target.value)} required={k === 'customerName'} />
    </Field>
  )
  const nested = <G extends 'salesEngineer' | 'partner'>(g: G, k: keyof PocDetails[G] & string, label: MessageKey, max: number, type = 'text') => (
    <Field label={t(label)}>
      <input
        className="input"
        type={type}
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
    <div className="space-y-5">
      <Section title={t('form.sectionCustomer')}>
        <Row cols="sm:grid-cols-3">
          {text('customerName', 'form.customerName', 160)}
          {text('department', 'form.department', 160)}
          {text('customerEmail', 'form.customerEmail', 254, 'email')}
        </Row>
        <Field label={t('form.analysts')}>
          <textarea
            className="input"
            rows={3}
            disabled={readOnly}
            value={value.analysts.join('\n')}
            onChange={(e) => set('analysts', e.target.value.split('\n').map((s) => s.slice(0, 60)).slice(0, 50))}
          />
        </Field>
        <Field label={`${t('form.successCriteria')} (${value.successCriteria.length}/550)`}>
          <textarea className="input" rows={3} maxLength={550} disabled={readOnly} value={value.successCriteria} onChange={(e) => set('successCriteria', e.target.value)} />
        </Field>
      </Section>

      <Section title={t('form.sectionSe')}>
        <Row cols="sm:grid-cols-3">
          {nested('salesEngineer', 'name', 'form.seName', 120)}
          {nested('salesEngineer', 'email', 'form.seEmail', 254, 'email')}
          {nested('salesEngineer', 'phone', 'form.sePhone', 40, 'tel')}
        </Row>
      </Section>

      <Section title={t('form.sectionPartner')}>
        <Row cols="sm:grid-cols-3">
          {nested('partner', 'name', 'form.partnerName', 120)}
          {nested('partner', 'email', 'form.partnerEmail', 254, 'email')}
          {nested('partner', 'site', 'form.partnerSite', 254)}
        </Row>
      </Section>

      <Section title={t('form.sectionGeneral')}>
        <Row cols="sm:grid-cols-3">
          {text('platformVersion', 'form.platformVersion', 40)}
          {text('region', 'form.region', 80)}
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
        </Row>
        <Field label={`${t('form.comments')} (${value.comments.length}/1500)`}>
          <textarea className="input" rows={4} maxLength={1500} disabled={readOnly} value={value.comments} onChange={(e) => set('comments', e.target.value)} />
        </Field>
      </Section>

      <Section title={t('form.sectionAutoTriage')}>
        <AutoTriageCheckbox checked={value.aiTriageTested} disabled={readOnly} note={autoTriageNote} onChange={(v) => set('aiTriageTested', v)} />
      </Section>

      <Section title={t('form.sectionEffort')}>
        <Row cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {effort('alertMin', 'form.effortAlert')}
          {effort('critHighMin', 'form.effortCritHigh')}
          {effort('mediumMin', 'form.effortMedium')}
          {effort('lowMin', 'form.effortLow')}
          {effort('monthHours', 'form.effortMonth')}
        </Row>
      </Section>
    </div>
  )
}

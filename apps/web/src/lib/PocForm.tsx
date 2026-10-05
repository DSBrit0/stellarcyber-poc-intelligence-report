import { EFFORT_DEFAULTS, VERDICTS, fieldValid, normalizeField, type PocDetails } from '@poc-intel/shared'
import type { MessageKey } from '@poc-intel/shared/i18n'
import type { ReactNode } from 'react'
import { AutoTriageCheckbox } from './AutoTriage'
import { HelpTip } from './HelpTip'
import { ContactFields, TypedInput, linesOf } from './TypedFields'
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
function Section({ title, tip, children }: { title: string; tip?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-slate-200 pt-4 first:border-t-0 first:pt-0 dark:border-slate-800">
      <h3 className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-200">
        {title}
        {tip}
      </h3>
      {children}
    </section>
  )
}

/** Grid of fields; `items-end` lines the inputs up when a label wraps to two lines. */
function Row({ cols, children }: { cols: string; children: ReactNode }) {
  return <div className={`grid items-end gap-3 ${cols}`}>{children}</div>
}

function Field({ label, tip, children }: { label: string; tip?: ReactNode; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="label flex items-center">
        {label}
        {tip}
      </span>
      {children}
    </label>
  )
}

/** The previous tool's Verdict guide: meaning, detail and best-practice alignment of each Verdict. */
function VerdictGuide() {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      {VERDICTS.map((v) => (
        <div key={v} className="space-y-1">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">{t(`form.verdict.${v}`)}</h3>
          <p>
            <b>{t('help.verdictMeaning')}:</b> {t(`help.verdict.${v}.meaning`)}
          </p>
          <p>{t(`help.verdict.${v}.detail`)}</p>
          <p>
            <b>{t('help.verdictAlign')}:</b> {t(`help.verdict.${v}.align`)}
          </p>
        </div>
      ))}
      <p className="text-slate-500 dark:text-slate-400">{t('help.verdictPending')}</p>
    </div>
  )
}

/** What the effort premises feed, what each one means (with the defaults) and how the saving is computed. */
function EffortHelp() {
  const { t } = useI18n()
  const d = EFFORT_DEFAULTS
  return (
    <div className="space-y-2">
      <p>{t('help.effortGoal')}</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>{t('help.effortAlert', { v: d.alertMin })}</li>
        <li>{t('help.effortInv', { ch: d.critHighMin, m: d.mediumMin, l: d.lowMin })}</li>
        <li>{t('help.effortMonth', { v: d.monthHours })}</li>
      </ul>
      <p>{t('help.effortCalc', { a: d.alertMin })}</p>
      <p className="text-slate-500 dark:text-slate-400">{t('help.effortDefaults')}</p>
    </div>
  )
}

/**
 * Every PoC detail, in the order and groups of the previous tool's form, plus Auto Triage.
 * Controlled: the parent owns the value. `autoTriage={false}` hides the Auto Triage group where the
 * page asks it elsewhere (New PoC); `autoTriageNote` says when an Auto Triage change applies.
 */
export function PocForm({
  value,
  onChange,
  readOnly,
  autoTriage = true,
  autoTriageNote,
  criteriaInNotebook,
}: {
  /** The PoC has a Notebook: its Success Criteria are edited there, one row per criterion. */
  criteriaInNotebook?: boolean
  value: PocDetails
  onChange: (v: PocDetails) => void
  readOnly?: boolean
  autoTriage?: boolean
  autoTriageNote?: string
}) {
  const { t } = useI18n()
  const set = <K extends keyof PocDetails>(k: K, v: PocDetails[K]) => onChange({ ...value, [k]: v })
  const text = (k: 'customerName' | 'department' | 'platformVersion' | 'region', label: MessageKey, max: number, type = 'text') => (
    <Field label={t(label)}>
      <input className="input" type={type} maxLength={max} disabled={readOnly} value={value[k]} onChange={(e) => set(k, e.target.value)} required={k === 'customerName'} />
    </Field>
  )
  const badAnalysts = linesOf(value.analysts).filter((a) => !fieldValid('personName', normalizeField('personName', a)))
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
          <TypedInput kind="email" label={t('form.customerEmail')} maxLength={254} disabled={Boolean(readOnly)} value={value.customerEmail} onChange={(v) => set('customerEmail', v)} />
        </Row>
        <Field label={t('form.analysts')}>
          <textarea
            className="input"
            rows={3}
            disabled={readOnly}
            value={value.analysts.join('\n')}
            onChange={(e) => set('analysts', e.target.value.split('\n').map((s) => s.slice(0, 60)).slice(0, 50))}
            onBlur={() => set('analysts', linesOf(value.analysts).map((a) => normalizeField('personName', a)))}
          />
          {badAnalysts.length ? <span className="mt-1 block text-xs text-red-600">{t('field.invalid.personName')} ({badAnalysts.join(', ')})</span> : null}
        </Field>
        {criteriaInNotebook ? (
          <p className="text-sm text-slate-500">
            <span className="label">{t('form.successCriteria')}</span>
            {t('nb.criteriaInNotebook')}
          </p>
        ) : (
          <Field label={`${t('form.successCriteria')} (${value.successCriteria.length}/550)`}>
            <textarea className="input" rows={3} maxLength={550} disabled={readOnly} value={value.successCriteria} onChange={(e) => set('successCriteria', e.target.value)} />
          </Field>
        )}
      </Section>

      <Section title={t('form.sectionSe')}>
        <ContactFields disabled={Boolean(readOnly)} value={value.salesEngineer} onChange={(v) => set('salesEngineer', v)} />
      </Section>

      <Section title={t('form.sectionPartner')}>
        <div className="grid items-start gap-3 sm:grid-cols-3">
          <TypedInput kind="personName" label={t('form.partnerName')} maxLength={120} disabled={Boolean(readOnly)} value={value.partner.name} onChange={(v) => set('partner', { ...value.partner, name: v })} />
          <TypedInput kind="email" label={t('form.partnerEmail')} maxLength={254} disabled={Boolean(readOnly)} value={value.partner.email} onChange={(v) => set('partner', { ...value.partner, email: v })} />
          <TypedInput kind="url" label={t('form.partnerSite')} maxLength={254} disabled={Boolean(readOnly)} value={value.partner.site} onChange={(v) => set('partner', { ...value.partner, site: v })} />
        </div>
      </Section>

      <Section title={t('form.sectionGeneral')}>
        <Row cols="sm:grid-cols-3">
          {text('platformVersion', 'form.platformVersion', 40)}
          {text('region', 'form.region', 80)}
          <Field label={t('form.verdict')} tip={<HelpTip title={t('help.verdictTitle')}><VerdictGuide /></HelpTip>}>
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
        <Field label={`${t('form.comments')} (${value.comments.length}/1500)`} tip={<HelpTip title={t('help.commentsTitle')}><p>{t('help.comments')}</p></HelpTip>}>
          <textarea className="input" rows={4} maxLength={1500} disabled={readOnly} value={value.comments} onChange={(e) => set('comments', e.target.value)} />
        </Field>
      </Section>

      {autoTriage ? (
        <Section title={t('form.sectionAutoTriage')}>
          <AutoTriageCheckbox checked={value.aiTriageTested} disabled={readOnly} note={autoTriageNote} onChange={(v) => set('aiTriageTested', v)} />
        </Section>
      ) : null}

      <Section title={t('form.sectionEffort')} tip={<HelpTip title={t('help.effortTitle')}><EffortHelp /></HelpTip>}>
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

import { fieldValid, normalizeField, type FieldKind, type PersonContact, type PocDetails } from '@poc-intel/shared'
import { useState } from 'react'
import { useI18n } from './i18n'

const PLACEHOLDER: Partial<Record<FieldKind, string>> = { email: 'nome@empresa.com', phone: '+55 11 91234-5678', url: 'https://' }
const INPUT_TYPE: Record<FieldKind, string> = { personName: 'text', email: 'email', phone: 'tel', url: 'url' }

/**
 * A typed field: normalised when it loses focus (names capitalised, e-mail in lower case, phone in
 * international format, https:// added) and flagged while its value is not valid.
 */
export function TypedInput({ kind, label, value, onChange, disabled, maxLength }: { kind: FieldKind; label: string; value: string; onChange: (v: string) => void; disabled: boolean; maxLength: number }) {
  const { t } = useI18n()
  const [focused, setFocused] = useState(false)
  const invalid = !focused && !fieldValid(kind, value)
  return (
    <label className="block min-w-0">
      <span className="label">{label}</span>
      <input
        className={`input ${invalid ? 'border-red-500 focus:border-red-500' : ''}`}
        type={INPUT_TYPE[kind]}
        inputMode={kind === 'phone' ? 'tel' : undefined}
        placeholder={PLACEHOLDER[kind]}
        maxLength={maxLength}
        disabled={disabled}
        aria-invalid={invalid}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          const normal = normalizeField(kind, value)
          if (normal !== value) onChange(normal)
        }}
        onChange={(e) => onChange(e.target.value)}
      />
      {invalid ? <span className="mt-1 block text-xs text-red-600">{t(`field.invalid.${kind}`)}</span> : null}
    </label>
  )
}

/** Name, e-mail and phone of one person. */
export function ContactFields({ value, onChange, disabled }: { value: PersonContact; onChange: (v: PersonContact) => void; disabled: boolean }) {
  const { t } = useI18n()
  return (
    <div className="grid items-start gap-3 sm:grid-cols-3">
      <TypedInput kind="personName" label={t('form.seName')} maxLength={120} disabled={disabled} value={value.name} onChange={(name) => onChange({ ...value, name })} />
      <TypedInput kind="email" label={t('form.seEmail')} maxLength={254} disabled={disabled} value={value.email} onChange={(email) => onChange({ ...value, email })} />
      <TypedInput kind="phone" label={t('form.sePhone')} maxLength={40} disabled={disabled} value={value.phone} onChange={(phone) => onChange({ ...value, phone })} />
    </div>
  )
}

export const contactOk = (c: PersonContact) => fieldValid('personName', c.name) && fieldValid('email', c.email) && fieldValid('phone', c.phone)
export const linesOf = (text: string[]) => text.map((a) => a.trim()).filter(Boolean)


/** The typed PoC details are valid: e-mails, phones, people's names and web addresses. */
export const typedDetailsValid = (d: PocDetails) =>
  fieldValid('email', d.customerEmail) &&
  contactOk(d.salesEngineer) &&
  fieldValid('personName', d.partner.name) &&
  fieldValid('email', d.partner.email) &&
  fieldValid('url', d.partner.site) &&
  linesOf(d.analysts).every((a) => fieldValid('personName', normalizeField('personName', a)))

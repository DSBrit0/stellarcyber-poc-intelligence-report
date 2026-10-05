import { parsePhoneNumberFromString } from 'libphonenumber-js/min'
import { z } from 'zod'

/**
 * Typed fields: each one is normalised (spaces, case, format) and then validated, the same way in the
 * browser (on blur) and on the server. An empty value is always allowed; required-ness is the form's.
 */

export type FieldKind = 'personName' | 'email' | 'phone' | 'url'

const squash = (s: string) => s.trim().replace(/\s+/g, ' ')

// Lower-case particles inside a name: "Maria da Silva", "Juan de la Cruz".
const PARTICLES = new Set(['da', 'das', 'de', 'del', 'della', 'di', 'do', 'dos', 'du', 'e', 'la', 'las', 'le', 'los', 'van', 'von', 'y'])
/** Letters only (any alphabet, accents included), words separated by one space, hyphen or apostrophe. */
const NAME = /^\p{L}+(?:[ '’-]\p{L}+)*$/u

export function normalizePersonName(raw: string): string {
  return squash(raw)
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .map((word, i) => (i > 0 && PARTICLES.has(word) ? word : word.replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('pt-BR'))))
    .join(' ')
}

export const normalizeEmail = (raw: string) => raw.trim().toLowerCase()

/** International format, e.g. "+55 11 91234 5678". A number without "+" is read as Brazilian. */
export function normalizePhone(raw: string): string {
  const p = parsePhoneNumberFromString(raw.trim(), 'BR')
  return p?.isValid() ? p.formatInternational() : raw.trim()
}

/** https:// is added when no scheme is typed; only http(s) addresses are accepted. */
export function normalizeUrl(raw: string): string {
  const v = raw.trim()
  if (!v) return ''
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function fieldValid(kind: FieldKind, value: string): boolean {
  if (value === '') return true
  switch (kind) {
    case 'personName':
      return value.length <= 120 && NAME.test(value)
    case 'email':
      return value.length <= 254 && EMAIL.test(value)
    case 'phone':
      return parsePhoneNumberFromString(value, 'BR')?.isValid() ?? false
    case 'url':
      try {
        const u = new URL(value)
        return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.') && value.length <= 500
      } catch {
        return false
      }
  }
}

export const normalizeField = (kind: FieldKind, raw: string): string =>
  kind === 'personName' ? normalizePersonName(raw) : kind === 'email' ? normalizeEmail(raw) : kind === 'phone' ? normalizePhone(raw) : normalizeUrl(raw)

/** The Zod form of a field: normalises, then refuses what is still invalid with `invalid_<kind>`. */
export const typedField = (kind: FieldKind) =>
  z
    .string()
    .transform((v) => normalizeField(kind, v))
    .refine((v) => fieldValid(kind, v), { message: `invalid_${kind}` })

export const PersonNameField = typedField('personName')
export const EmailField = typedField('email')
export const PhoneField = typedField('phone')
export const UrlField = typedField('url')
/** Free text on one line: trimmed, repeated spaces collapsed. */
export const LineField = (max: number) => z.string().transform(squash).pipe(z.string().max(max))

/** A person to reach: name, e-mail and phone, each typed. */
export const PersonContact = z.object({
  name: PersonNameField.default(''),
  email: EmailField.default(''),
  phone: PhoneField.default(''),
})
export type PersonContact = z.infer<typeof PersonContact>

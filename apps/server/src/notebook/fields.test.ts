import { NotebookDetails, NotebookOverview, fieldValid, normalizeField } from '@poc-intel/shared'
import { describe, expect, it } from 'vitest'

describe('typed Notebook fields', () => {
  it('capitalises person names and keeps particles in lower case', () => {
    expect(normalizeField('personName', '  rafael   NETTO da silva ')).toBe('Rafael Netto da Silva')
    expect(normalizeField('personName', "maria-josé d'ávila")).toBe("Maria-José D'Ávila")
  })
  it('accepts letters only in a person name', () => {
    expect(fieldValid('personName', 'Ana Maria')).toBe(true)
    expect(fieldValid('personName', 'Ana 2')).toBe(false)
    expect(fieldValid('personName', 'ana@x')).toBe(false)
  })
  it('writes phones in international format, reading numbers without + as Brazilian', () => {
    expect(normalizeField('phone', '(11) 91234-5678')).toBe('+55 11 91234 5678')
    expect(normalizeField('phone', '+1 415 555 2671')).toBe('+1 415 555 2671')
    expect(fieldValid('phone', '12345')).toBe(false)
  })
  it('lower-cases e-mails and adds https:// to web addresses', () => {
    expect(normalizeField('email', ' Rafael@Lenovo.COM ')).toBe('rafael@lenovo.com')
    expect(fieldValid('email', 'rafael@lenovo')).toBe(false)
    expect(normalizeField('url', 'lenovo.com')).toBe('https://lenovo.com')
    expect(fieldValid('url', 'https://nothing')).toBe(false)
  })
  it('normalises a whole Notebook payload and refuses invalid values', () => {
    const o = NotebookOverview.parse({ startDate: '2026-08-24', businessContact: { name: 'rafael netto', email: 'R@Lenovo.com', phone: '11 3333-4444' } })
    expect(o.businessContact).toEqual({ name: 'Rafael Netto', email: 'r@lenovo.com', phone: '+55 11 3333 4444' })
    expect(NotebookDetails.safeParse({ customerName: 'Lenovo', analysts: ['ana', 'Bob 2'] }).success).toBe(false)
    expect(NotebookDetails.parse({ customerName: ' Lenovo  Brasil ', analysts: ['ana', ''] }).analysts).toEqual(['Ana'])
  })
})

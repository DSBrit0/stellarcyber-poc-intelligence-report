import { describe, expect, it } from 'vitest'
import type { AuthContext } from '../auth/session.js'
import type { Poc } from '../db/schema.js'
import { canEdit, canFillNotebook, canJoinExperience, canRunExperience, canShapeNotebook, canView } from './access-rules.js'

const user = (role: string, id = 'u1', customerId: string | null = null) => ({ user: { id, role, customerId } }) as unknown as AuthContext
const poc = (ownerId: string, customerId: string | null = null) => ({ ownerId, customerId, notebook: null }) as Poc
const notebook = (ownerId: string, customerId: string | null = null) => ({ ownerId, customerId, notebook: { startDate: '2026-08-24' } }) as Poc

describe('PoC access', () => {
  it('an Admin views and edits everything', () => {
    expect(canView(user('admin'), poc('x'))).toBe(true)
    expect(canEdit(user('admin'), poc('x'))).toBe(true)
  })
  it('an SE/Partner reaches only the PoCs they own', () => {
    expect(canView(user('sales_engineer', 'u1'), poc('u1'))).toBe(true)
    expect(canView(user('partner', 'u1'), poc('u2'))).toBe(false)
    expect(canEdit(user('sales_engineer', 'u1'), poc('u1'))).toBe(true)
  })
  it('an SE also views, read-only, the PoCs of the Partners of the Partner Companies they registered', () => {
    expect(canView(user('sales_engineer', 'se1'), poc('partner1'), 'se1')).toBe(true)
    expect(canView(user('sales_engineer', 'se2'), poc('partner1'), 'se1')).toBe(false)
    expect(canView(user('sales_engineer', 'se1'), poc('partner1'), null)).toBe(false)
    expect(canEdit(user('sales_engineer', 'se1'), poc('partner1'))).toBe(false)
  })
  it('a Partner whose Company was a Customer still views, read-only, the PoCs it was evaluated in', () => {
    expect(canView(user('partner', 'p1', 'acme'), poc('se', 'acme'))).toBe(true)
    expect(canView(user('partner', 'p1', 'acme'), poc('se', 'other'))).toBe(false)
    expect(canEdit(user('partner', 'p1', 'acme'), poc('se', 'acme'))).toBe(false)
  })
  it('following is only for an SE: a Partner never reaches another Partner through it', () => {
    expect(canView(user('partner', 'p2'), poc('partner1'), 'p2')).toBe(false)
  })
  it('a Customer User views, read-only, only the PoCs linked to their Customer', () => {
    expect(canView(user('customer', 'c-user', 'cust-1'), poc('se', 'cust-1'))).toBe(true)
    expect(canView(user('customer', 'c-user', 'cust-1'), poc('se', 'cust-2'))).toBe(false)
    expect(canView(user('customer', 'c-user', null), poc('se', null))).toBe(false)
    expect(canEdit(user('customer', 'c-user', 'cust-1'), poc('se', 'cust-1'))).toBe(false)
    expect(canEdit(user('customer', 'se', 'cust-1'), poc('se', 'cust-1'))).toBe(false)
  })

  it('a PoC Notebook is filled in by its Owner, its SE, an Admin and the linked Customer Users', () => {
    expect(canFillNotebook(user('partner', 'p1'), notebook('p1', 'cust-1'))).toBe(true)
    expect(canFillNotebook(user('sales_engineer', 'se1'), notebook('p1', 'cust-1'), 'se1')).toBe(true)
    expect(canFillNotebook(user('admin'), notebook('p1', 'cust-1'))).toBe(true)
    expect(canFillNotebook(user('customer', 'c1', 'cust-1'), notebook('p1', 'cust-1'))).toBe(true)
    expect(canFillNotebook(user('customer', 'c2', 'cust-2'), notebook('p1', 'cust-1'))).toBe(false)
    expect(canFillNotebook(user('sales_engineer', 'se2'), notebook('p1', 'cust-1'))).toBe(false)
    // A Partner whose Company was evaluated in this PoC only views it.
    expect(canFillNotebook(user('partner', 'p9', 'cust-1'), notebook('p1', 'cust-1'))).toBe(false)
  })
  it('only its Owner, its SE or an Admin shape a PoC Notebook', () => {
    expect(canShapeNotebook(user('partner', 'p1'), notebook('p1', 'cust-1'))).toBe(true)
    expect(canShapeNotebook(user('sales_engineer', 'se1'), notebook('p1', 'cust-1'), 'se1')).toBe(true)
    expect(canShapeNotebook(user('customer', 'c1', 'cust-1'), notebook('p1', 'cust-1'))).toBe(false)
  })
  it('a PoC without a Notebook has nothing to fill in', () => {
    expect(canFillNotebook(user('admin'), poc('p1'))).toBe(false)
  })

  it('a Stellar Experience is run by the PoC Notebook\'s SE or an Admin, never by a Partner', () => {
    expect(canRunExperience(user('sales_engineer', 'se1'), notebook('se1', 'cust-1'))).toBe(true)
    expect(canRunExperience(user('sales_engineer', 'se1'), notebook('p1', 'cust-1'), 'se1')).toBe(true)
    expect(canRunExperience(user('admin'), notebook('p1', 'cust-1'))).toBe(true)
    expect(canRunExperience(user('partner', 'p1'), notebook('p1', 'cust-1'))).toBe(false)
    expect(canRunExperience(user('sales_engineer', 'se2'), notebook('se1', 'cust-1'))).toBe(false)
    expect(canRunExperience(user('customer', 'c1', 'cust-1'), notebook('se1', 'cust-1'))).toBe(false)
    expect(canRunExperience(user('admin'), poc('se1'))).toBe(false)
  })
  it('the linked Customer Users join a Stellar Experience; a Partner does not', () => {
    expect(canJoinExperience(user('customer', 'c1', 'cust-1'), notebook('se1', 'cust-1'))).toBe(true)
    expect(canJoinExperience(user('customer', 'c2', 'cust-2'), notebook('se1', 'cust-1'))).toBe(false)
    expect(canJoinExperience(user('partner', 'p1'), notebook('p1', 'cust-1'))).toBe(false)
    expect(canJoinExperience(user('sales_engineer', 'se1'), notebook('se1', 'cust-1'))).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import type { AuthContext } from '../auth/session.js'
import type { Poc } from '../db/schema.js'
import { canEdit, canView } from './access-rules.js'

const user = (role: string, id = 'u1', customerId: string | null = null) => ({ user: { id, role, customerId } }) as unknown as AuthContext
const poc = (ownerId: string, customerId: string | null = null) => ({ ownerId, customerId }) as Poc

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
  it('a Customer User views, read-only, only the PoCs linked to their Customer', () => {
    expect(canView(user('customer', 'c-user', 'cust-1'), poc('se', 'cust-1'))).toBe(true)
    expect(canView(user('customer', 'c-user', 'cust-1'), poc('se', 'cust-2'))).toBe(false)
    expect(canView(user('customer', 'c-user', null), poc('se', null))).toBe(false)
    expect(canEdit(user('customer', 'c-user', 'cust-1'), poc('se', 'cust-1'))).toBe(false)
    expect(canEdit(user('customer', 'se', 'cust-1'), poc('se', 'cust-1'))).toBe(false)
  })
})

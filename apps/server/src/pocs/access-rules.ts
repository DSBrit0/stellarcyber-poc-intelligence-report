import type { AuthContext } from '../auth/session.js'
import type { Poc } from '../db/schema.js'

/**
 * Who reaches a PoC: an Admin reaches every PoC; an SE/Partner the PoCs they own; a Customer User,
 * read-only, the PoCs linked to their Customer. Anything else is a 404, never a 403.
 */
export const canView = (auth: AuthContext, poc: Poc) =>
  auth.user.role === 'admin' ||
  (auth.user.role === 'customer' ? auth.user.customerId != null && poc.customerId === auth.user.customerId : poc.ownerId === auth.user.id)

/** Editing, Syncing and deleting: the Owner or an Admin. */
export const canEdit = (auth: AuthContext, poc: Poc) => auth.user.role === 'admin' || (auth.user.role !== 'customer' && poc.ownerId === auth.user.id)

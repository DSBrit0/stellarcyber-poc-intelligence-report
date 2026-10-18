import type { AuthContext } from '../auth/session.js'
import type { Poc } from '../db/schema.js'

/** What the access rules read of a PoC: the full row or the light one (without its architecture image) both fit. */
type PocAccess = Pick<Poc, 'ownerId' | 'customerId' | 'notebook'>

/**
 * Who reaches a PoC: an Admin reaches every PoC; an SE/Partner the PoCs they own; an SE also the PoCs
 * of the Partners of the Partner Companies they registered (`followerId`, ADR 0011); a Customer User,
 * read-only, the PoCs linked to their Customer. A Partner whose Company was a Customer still views,
 * read-only, the PoCs it was evaluated in. Anything else is a 404, never a 403.
 */
export const canView = (auth: AuthContext, poc: PocAccess, followerId: string | null = null) =>
  auth.user.role === 'admin' ||
  (auth.user.role === 'customer'
    ? auth.user.customerId != null && poc.customerId === auth.user.customerId
    : poc.ownerId === auth.user.id ||
      (auth.user.role === 'sales_engineer' && followerId === auth.user.id) ||
      (auth.user.role === 'partner' && auth.user.customerId != null && poc.customerId === auth.user.customerId))

/** Editing, Syncing and deleting: the Owner or an Admin. */
export const canEdit = (auth: AuthContext, poc: PocAccess) => auth.user.role === 'admin' || (auth.user.role !== 'customer' && poc.ownerId === auth.user.id)

/**
 * Filling in a PoC Notebook (statuses, notes, criteria, meetings): its Owner, an Admin, the SE who
 * follows the Owner, and the Customer Users of the linked Customer.
 */
export const canFillNotebook = (auth: AuthContext, poc: PocAccess, followerId: string | null = null) =>
  poc.notebook != null &&
  (auth.user.role === 'customer'
    ? auth.user.customerId != null && poc.customerId === auth.user.customerId
    : canShapeNotebook(auth, poc, followerId))

/** Shaping a PoC Notebook (hiding, removing or adding Process items): its Owner, its SE or an Admin. */
export const canShapeNotebook = (auth: AuthContext, poc: PocAccess, followerId: string | null = null) =>
  poc.notebook != null &&
  (auth.user.role === 'admin' ||
    (auth.user.role !== 'customer' && poc.ownerId === auth.user.id) ||
    (auth.user.role === 'sales_engineer' && followerId === auth.user.id))

/**
 * Running a Stellar Experience (enable, lead, finish): the PoC Notebook's Sales Engineer (its Owner,
 * or the SE who follows its Partner Owner) or an Admin. Never a Partner.
 */
export const canRunExperience = (auth: AuthContext, poc: PocAccess, followerId: string | null = null) =>
  poc.notebook != null &&
  (auth.user.role === 'admin' || (auth.user.role === 'sales_engineer' && (poc.ownerId === auth.user.id || followerId === auth.user.id)))

/** Taking part in a Stellar Experience: whoever runs it, and the Customer Users of the linked Customer. */
export const canJoinExperience = (auth: AuthContext, poc: PocAccess, followerId: string | null = null) =>
  canRunExperience(auth, poc, followerId) ||
  (poc.notebook != null && auth.user.role === 'customer' && auth.user.customerId != null && poc.customerId === auth.user.customerId)

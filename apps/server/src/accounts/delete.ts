import { ACTIVE_SYNC_STATUSES } from '@poc-intel/shared'
import { and, eq, inArray, ne, or, sql as dsql } from 'drizzle-orm'
import type { AuthContext } from '../auth/session.js'
import { db } from '../db/client.js'
import { customers, pocs, reportData, syncs, users, type User } from '../db/schema.js'
import { HttpError, notFound } from '../lib/http.js'
import { deleteRenders } from '../report/render-cache.js'

/**
 * Permanent deletion of User accounts and Companies (LGPD). An Admin deletes anything; a Sales
 * Engineer deletes the Companies they registered and those Companies' Users. Nobody deletes their own
 * account, and the last Admin stays.
 */

/** Everything that goes with a Company: its Users, and what they own, recursively. */
export interface CompanyImpact {
  companyIds: string[]
  userIds: string[]
  pocIds: string[]
  reportIds: string[]
}

export async function companyImpact(companyId: string): Promise<CompanyImpact> {
  const companyIds = new Set([companyId])
  const userIds = new Set<string>()
  // A Partner's Users may have registered their own customers: those go too, with their Users.
  for (let frontier = [companyId]; frontier.length > 0; ) {
    const members = await db.select({ id: users.id }).from(users).where(inArray(users.customerId, frontier))
    const fresh = members.map((m) => m.id).filter((id) => !userIds.has(id))
    fresh.forEach((id) => userIds.add(id))
    const owned = fresh.length ? await db.select({ id: customers.id }).from(customers).where(inArray(customers.ownerId, fresh)) : []
    frontier = owned.map((c) => c.id).filter((id) => !companyIds.has(id))
    frontier.forEach((id) => companyIds.add(id))
  }
  const companyList = [...companyIds]
  const userList = [...userIds]
  const pocRows = await db
    .select({ id: pocs.id })
    .from(pocs)
    .where(userList.length ? or(inArray(pocs.customerId, companyList), inArray(pocs.ownerId, userList)) : inArray(pocs.customerId, companyList))
  const pocIds = pocRows.map((p) => p.id)
  const reports = pocIds.length ? await db.select({ id: reportData.id }).from(reportData).where(inArray(reportData.pocId, pocIds)) : []
  return { companyIds: companyList, userIds: userList, pocIds, reportIds: reports.map((r) => r.id) }
}

async function refuseIfSyncing(pocIds: string[]) {
  if (pocIds.length === 0) return
  const [busy] = await db
    .select({ id: syncs.id })
    .from(syncs)
    .where(and(inArray(syncs.pocId, pocIds), inArray(syncs.status, [...ACTIVE_SYNC_STATUSES])))
    .limit(1)
  if (busy) throw new HttpError(409, 'sync_in_progress')
}

/** Deletes a Company and everything in its impact; cached PDFs are removed from disk. */
export async function deleteCompany(impact: CompanyImpact): Promise<void> {
  await refuseIfSyncing(impact.pocIds)
  await db.transaction(async (tx) => {
    // PoCs first (Notebooks, Syncs, Report Data and comments go by cascade), then the Companies, then
    // their Users (a Company's owner_id must not point to a deleted User).
    if (impact.pocIds.length) await tx.delete(pocs).where(inArray(pocs.id, impact.pocIds))
    await tx.delete(customers).where(inArray(customers.id, impact.companyIds))
    if (impact.userIds.length) await tx.delete(users).where(inArray(users.id, impact.userIds))
  })
  await deleteRenders(impact.reportIds)
}

/** What a User owns: it must be handed to someone else before the account goes. */
export async function userOwnership(userId: string): Promise<{ pocs: number; companies: number }> {
  const [row] = await db
    .select({
      pocs: dsql<number>`(SELECT count(*)::int FROM pocs p WHERE p.owner_id = ${userId})`,
      companies: dsql<number>`(SELECT count(*)::int FROM customers c WHERE c.owner_id = ${userId})`,
    })
    .from(users)
    .where(eq(users.id, userId))
  return row ?? { pocs: 0, companies: 0 }
}

/** The User, if the caller may delete them: an Admin anyone but themselves; an SE the Users of their Companies. */
export async function loadDeletableUser(auth: AuthContext, userId: string): Promise<User> {
  if (userId === auth.user.id) throw new HttpError(400, 'cannot_delete_self')
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!target) throw notFound()
  if (auth.user.role !== 'admin') {
    const [company] = target.customerId ? await db.select({ ownerId: customers.ownerId }).from(customers).where(eq(customers.id, target.customerId)).limit(1) : []
    if (!company || company.ownerId !== auth.user.id) throw notFound()
  }
  if (target.role === 'admin') {
    const [other] = await db.select({ id: users.id }).from(users).where(and(eq(users.role, 'admin'), eq(users.status, 'active'), ne(users.id, target.id))).limit(1)
    if (!other) throw new HttpError(409, 'last_admin')
  }
  return target
}

/** Who may receive a deleted User's PoCs and Companies: an Admin picks any active staff User; an SE, themselves. */
export async function transferCandidates(auth: AuthContext, exceptId: string) {
  if (auth.user.role !== 'admin') return [{ id: auth.user.id, name: auth.user.name, email: auth.user.email }]
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(inArray(users.role, ['admin', 'sales_engineer', 'partner']), eq(users.status, 'active'), ne(users.id, exceptId)))
    .orderBy(users.name)
}

/** Hands the User's PoCs and Companies to `transferTo` (when they own any), then deletes the account. */
export async function deleteUser(auth: AuthContext, target: User, transferTo: string | null): Promise<{ pocs: number; companies: number }> {
  const owned = await userOwnership(target.id)
  if (owned.pocs + owned.companies > 0) {
    if (!transferTo) throw new HttpError(409, 'transfer_required')
    const allowed = (await transferCandidates(auth, target.id)).some((c) => c.id === transferTo)
    if (!allowed) throw new HttpError(400, 'transfer_invalid')
  }
  await db.transaction(async (tx) => {
    if (transferTo && owned.pocs) await tx.update(pocs).set({ ownerId: transferTo, updatedAt: dsql`now()` }).where(eq(pocs.ownerId, target.id))
    if (transferTo && owned.companies) await tx.update(customers).set({ ownerId: transferTo, updatedAt: dsql`now()` }).where(eq(customers.ownerId, target.id))
    await tx.delete(users).where(eq(users.id, target.id))
  })
  return owned
}

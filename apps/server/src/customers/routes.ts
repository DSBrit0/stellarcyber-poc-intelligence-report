import { CreateCustomerInput, UpdateCustomerInput, customerNameKey } from '@poc-intel/shared'
import { and, desc, eq, inArray, or, sql as dsql } from 'drizzle-orm'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requireRole } from '../auth/guards.js'
import { assertNotRoot } from '../auth/root.js'
import { revokeUserSessions } from '../auth/session.js'
import { db } from '../db/client.js'
import { customers, pocs, users, type Customer } from '../db/schema.js'
import { audit } from '../lib/audit.js'
import { sha256 } from '../lib/crypto.js'
import { HttpError, notFound, parse } from '../lib/http.js'
import { newAccessKey, normalizeAccessKey } from './access-key.js'

const IdParam = z.object({ id: z.uuid() })
const staff = (req: FastifyRequest) => requireRole(req, 'admin', 'sales_engineer', 'partner')

/** A Company is managed by its Owner; an Admin manages every Company. */
async function loadOwnCustomer(req: FastifyRequest, id: string): Promise<Customer> {
  const { user } = staff(req)
  const [c] = await db.select().from(customers).where(eq(customers.id, id)).limit(1)
  if (!c || (user.role !== 'admin' && c.ownerId !== user.id)) throw notFound()
  return c
}

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  // An Admin sees every Company; an SE also sees, read-only, the Companies their Partners registered.
  app.get('/customers', async (req) => {
    const { user } = staff(req)
    const followed = dsql`${customers.ownerId} IN (
      SELECT u.id FROM users u JOIN customers c ON c.id = u.customer_id
      WHERE c.owner_id = ${user.id} AND c.profile = 'partner' AND u.role = 'partner')`
    const rows = await db
      .select({
        id: customers.id,
        name: customers.name,
        instanceUrl: customers.instanceUrl,
        profile: customers.profile,
        ownerId: customers.ownerId,
        ownerName: dsql<string>`(SELECT u.name FROM users u WHERE u.id = customers.owner_id)`,
        createdAt: customers.createdAt,
        // Written out with aliases: in a single-table select drizzle leaves columns unqualified, so
        // "id" inside the subquery would resolve to the inner table's own id. Drafts are not counted.
        pocs: dsql<number>`(SELECT count(*)::int FROM pocs p WHERE p.customer_id = customers.id AND NOT p.draft)`,
        users: dsql<number>`(SELECT count(*)::int FROM users u WHERE u.customer_id = customers.id AND u.status = 'active')`,
        pending: dsql<number>`(SELECT count(*)::int FROM users u WHERE u.customer_id = customers.id AND u.status = 'pending')`,
      })
      .from(customers)
      .where(user.role === 'admin' ? undefined : user.role === 'sales_engineer' ? or(eq(customers.ownerId, user.id), followed) : eq(customers.ownerId, user.id))
      .orderBy(customers.name)
    return rows.map((r) => ({ ...r, manageable: user.role === 'admin' || r.ownerId === user.id }))
  })

  // The Access Key is returned once; only its hash is stored.
  app.post('/customers', async (req, reply) => {
    const { user } = staff(req)
    const { name, instanceUrl, profile } = parse(CreateCustomerInput, req.body)
    const accessKey = newAccessKey()
    const [c] = await db
      .insert(customers)
      .values({ name, nameKey: customerNameKey(name), instanceUrl: instanceUrl ?? null, profile, ownerId: user.id, accessKeyHash: sha256(normalizeAccessKey(accessKey)) })
      .onConflictDoNothing({ target: customers.nameKey })
      .returning({ id: customers.id, name: customers.name, instanceUrl: customers.instanceUrl, profile: customers.profile })
    if (!c) throw new HttpError(409, 'customer_exists')
    await audit({ action: 'customer.created', userId: user.id, target: c.id, ip: req.ip, meta: { profile } })
    return reply.code(201).send({ ...c, accessKey })
  })

  app.patch('/customers/:id', async (req) => {
    const c = await loadOwnCustomer(req, parse(IdParam, req.params).id)
    const patch = parse(UpdateCustomerInput, req.body)
    const profileChanges = patch.profile !== undefined && patch.profile !== c.profile
    // A Customer that buys and becomes a Partner keeps the PoCs it was evaluated in. The way back is
    // refused while its Users own PoCs or Companies: a Customer User could neither edit nor manage them.
    if (profileChanges && patch.profile === 'customer') {
      const [owns] = await db.execute<{ one: number }>(dsql`
        SELECT 1 AS one FROM users u WHERE u.customer_id = ${c.id}
          AND (EXISTS (SELECT 1 FROM pocs p WHERE p.owner_id = u.id) OR EXISTS (SELECT 1 FROM customers x WHERE x.owner_id = u.id))
        LIMIT 1`)
      if (owns) throw new HttpError(409, 'company_users_own_records')
    }
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(customers)
        .set({
          ...(patch.name ? { name: patch.name, nameKey: customerNameKey(patch.name) } : {}),
          ...(patch.instanceUrl !== undefined ? { instanceUrl: patch.instanceUrl } : {}),
          ...(profileChanges ? { profile: patch.profile } : {}),
          updatedAt: dsql`now()`,
        })
        .where(eq(customers.id, c.id))
        .returning({ id: customers.id, name: customers.name, instanceUrl: customers.instanceUrl, profile: customers.profile })
      if (!profileChanges) return { row, moved: [] as string[] }
      // Every User of the Company takes the new Profile as their Role.
      const moved = await tx
        .update(users)
        .set({ role: patch.profile!, updatedAt: dsql`now()` })
        .where(and(eq(users.customerId, c.id), inArray(users.role, ['customer', 'partner'])))
        .returning({ id: users.id })
      return { row, moved: moved.map((u) => u.id) }
    })
    if (profileChanges) {
      // A Role change takes effect at the next sign-in, as with an Admin's Role change.
      for (const id of updated.moved) await revokeUserSessions(id)
      await audit({ action: 'customer.profile_changed', userId: req.auth!.user.id, target: c.id, ip: req.ip, meta: { from: c.profile, to: patch.profile, users: updated.moved.length } })
    }
    return updated.row
  })

  app.post('/customers/:id/access-key', async (req) => {
    const c = await loadOwnCustomer(req, parse(IdParam, req.params).id)
    const accessKey = newAccessKey()
    await db.update(customers).set({ accessKeyHash: sha256(normalizeAccessKey(accessKey)), updatedAt: dsql`now()` }).where(eq(customers.id, c.id))
    await audit({ action: 'customer.key_rotated', userId: req.auth!.user.id, target: c.id, ip: req.ip })
    return { accessKey }
  })

  /** Users of the Owner's Companies: pending Registrations first. */
  app.get('/customers/users', async (req) => {
    const { user } = staff(req)
    return db
      .select({ id: users.id, name: users.name, email: users.email, status: users.status, createdAt: users.createdAt, customerId: users.customerId, customerName: customers.name, profile: customers.profile })
      .from(users)
      .innerJoin(customers, eq(customers.id, users.customerId))
      .where(user.role === 'admin' ? undefined : eq(customers.ownerId, user.id))
      .orderBy(desc(dsql`${users.status} = 'pending'`), desc(users.createdAt))
  })

  for (const decision of ['approve', 'reject', 'disable'] as const) {
    app.post(`/customers/users/:id/${decision}`, async (req) => {
      const { user } = staff(req)
      const { id } = parse(IdParam, req.params)
      const [target] = await db
        .select({ id: users.id, isRoot: users.isRoot, ownerId: customers.ownerId, profile: customers.profile })
        .from(users)
        .innerJoin(customers, eq(customers.id, users.customerId))
        .where(eq(users.id, id))
        .limit(1)
      if (!target || (user.role !== 'admin' && target.ownerId !== user.id)) throw notFound()
      assertNotRoot(target)
      const status = decision === 'approve' ? 'active' : decision === 'reject' ? 'rejected' : 'disabled'
      await db
        .update(users)
        .set({ status, role: target.profile, decidedBy: user.id, decidedAt: dsql`now()`, updatedAt: dsql`now()` })
        .where(and(eq(users.id, id)))
      if (status !== 'active') await revokeUserSessions(id)
      await audit({ action: `customer.user_${decision}`, userId: user.id, target: id, ip: req.ip })
      return { ok: true }
    })
  }

}

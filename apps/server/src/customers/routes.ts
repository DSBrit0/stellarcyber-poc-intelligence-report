import { CreateCustomerInput, UpdateCustomerInput, customerNameKey } from '@poc-intel/shared'
import { and, desc, eq, sql as dsql } from 'drizzle-orm'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requireRole } from '../auth/guards.js'
import { revokeUserSessions } from '../auth/session.js'
import { db } from '../db/client.js'
import { customers, pocs, users, type Customer } from '../db/schema.js'
import { audit } from '../lib/audit.js'
import { sha256 } from '../lib/crypto.js'
import { HttpError, notFound, parse } from '../lib/http.js'
import { newAccessKey, normalizeAccessKey } from './access-key.js'

const IdParam = z.object({ id: z.uuid() })
const staff = (req: FastifyRequest) => requireRole(req, 'admin', 'sales_engineer', 'partner')

/** A Customer is managed by its Owner; an Admin manages every Customer. */
async function loadOwnCustomer(req: FastifyRequest, id: string): Promise<Customer> {
  const { user } = staff(req)
  const [c] = await db.select().from(customers).where(eq(customers.id, id)).limit(1)
  if (!c || (user.role !== 'admin' && c.ownerId !== user.id)) throw notFound()
  return c
}

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/customers', async (req) => {
    const { user } = staff(req)
    const rows = await db
      .select({
        id: customers.id,
        name: customers.name,
        instanceUrl: customers.instanceUrl,
        ownerId: customers.ownerId,
        createdAt: customers.createdAt,
        // Written out with aliases: in a single-table select drizzle leaves columns unqualified, so
        // "id" inside the subquery would resolve to the inner table's own id. Drafts are not counted.
        pocs: dsql<number>`(SELECT count(*)::int FROM pocs p WHERE p.customer_id = customers.id AND NOT p.draft)`,
        users: dsql<number>`(SELECT count(*)::int FROM users u WHERE u.customer_id = customers.id AND u.status = 'active')`,
        pending: dsql<number>`(SELECT count(*)::int FROM users u WHERE u.customer_id = customers.id AND u.status = 'pending')`,
      })
      .from(customers)
      .where(user.role === 'admin' ? undefined : eq(customers.ownerId, user.id))
      .orderBy(customers.name)
    return rows
  })

  // The Access Key is returned once; only its hash is stored.
  app.post('/customers', async (req, reply) => {
    const { user } = staff(req)
    const { name, instanceUrl } = parse(CreateCustomerInput, req.body)
    const accessKey = newAccessKey()
    const [c] = await db
      .insert(customers)
      .values({ name, nameKey: customerNameKey(name), instanceUrl: instanceUrl ?? null, ownerId: user.id, accessKeyHash: sha256(normalizeAccessKey(accessKey)) })
      .onConflictDoNothing({ target: customers.nameKey })
      .returning({ id: customers.id, name: customers.name, instanceUrl: customers.instanceUrl })
    if (!c) throw new HttpError(409, 'customer_exists')
    await audit({ action: 'customer.created', userId: user.id, target: c.id, ip: req.ip })
    return reply.code(201).send({ ...c, accessKey })
  })

  app.patch('/customers/:id', async (req) => {
    const c = await loadOwnCustomer(req, parse(IdParam, req.params).id)
    const patch = parse(UpdateCustomerInput, req.body)
    const [updated] = await db
      .update(customers)
      .set({
        ...(patch.name ? { name: patch.name, nameKey: customerNameKey(patch.name) } : {}),
        ...(patch.instanceUrl !== undefined ? { instanceUrl: patch.instanceUrl } : {}),
        updatedAt: dsql`now()`,
      })
      .where(eq(customers.id, c.id))
      .returning({ id: customers.id, name: customers.name, instanceUrl: customers.instanceUrl })
    return updated
  })

  app.post('/customers/:id/access-key', async (req) => {
    const c = await loadOwnCustomer(req, parse(IdParam, req.params).id)
    const accessKey = newAccessKey()
    await db.update(customers).set({ accessKeyHash: sha256(normalizeAccessKey(accessKey)), updatedAt: dsql`now()` }).where(eq(customers.id, c.id))
    await audit({ action: 'customer.key_rotated', userId: req.auth!.user.id, target: c.id, ip: req.ip })
    return { accessKey }
  })

  /** Customer Users of the Owner's Customers: pending Registrations first. */
  app.get('/customers/users', async (req) => {
    const { user } = staff(req)
    return db
      .select({ id: users.id, name: users.name, email: users.email, status: users.status, createdAt: users.createdAt, customerId: users.customerId, customerName: customers.name })
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
        .select({ id: users.id, ownerId: customers.ownerId })
        .from(users)
        .innerJoin(customers, eq(customers.id, users.customerId))
        .where(eq(users.id, id))
        .limit(1)
      if (!target || (user.role !== 'admin' && target.ownerId !== user.id)) throw notFound()
      const status = decision === 'approve' ? 'active' : decision === 'reject' ? 'rejected' : 'disabled'
      await db
        .update(users)
        .set({ status, role: 'customer', decidedBy: user.id, decidedAt: dsql`now()`, updatedAt: dsql`now()` })
        .where(and(eq(users.id, id)))
      if (status !== 'active') await revokeUserSessions(id)
      await audit({ action: `customer.user_${decision}`, userId: user.id, target: id, ip: req.ip })
      return { ok: true }
    })
  }

}

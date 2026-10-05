import { customerNameKey } from '@poc-intel/shared'
import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requireRole } from '../auth/guards.js'
import { db } from '../db/client.js'
import { customers } from '../db/schema.js'
import { audit } from '../lib/audit.js'
import { HttpError, notFound, parse } from '../lib/http.js'
import { companyImpact, deleteCompany, deleteUser, loadDeletableUser, transferCandidates, userOwnership } from './delete.js'

const IdParam = z.object({ id: z.uuid() })
const staff = (req: FastifyRequest) => requireRole(req, 'admin', 'sales_engineer')

/** An Admin reaches every Company; an SE the Companies they registered. */
async function loadOwnCompany(req: FastifyRequest, id: string) {
  const { user } = staff(req)
  const [c] = await db.select().from(customers).where(eq(customers.id, id)).limit(1)
  if (!c || (user.role !== 'admin' && c.ownerId !== user.id)) throw notFound()
  return c
}

/** Permanent deletion of User accounts and Companies (see accounts/delete.ts for who may delete what). */
export async function accountRoutes(app: FastifyInstance): Promise<void> {
  // What deleting this User involves: what they own, and who can receive it.
  app.get('/accounts/users/:id/deletion', async (req) => {
    const auth = staff(req)
    const target = await loadDeletableUser(auth, parse(IdParam, req.params).id)
    return { name: target.name, email: target.email, owns: await userOwnership(target.id), candidates: await transferCandidates(auth, target.id) }
  })

  app.delete('/accounts/users/:id', async (req, reply) => {
    const auth = staff(req)
    const target = await loadDeletableUser(auth, parse(IdParam, req.params).id)
    const { transferTo } = parse(z.object({ transferTo: z.uuid().nullable().default(null) }), req.body ?? {})
    const moved = await deleteUser(auth, target, transferTo)
    await audit({ action: 'user.deleted', userId: auth.user.id, target: target.id, ip: req.ip, meta: { email: target.email, role: target.role, transferTo, ...moved } })
    return reply.code(204).send()
  })

  // What deleting this Company takes with it: shown before the confirmation.
  app.get('/accounts/companies/:id/deletion', async (req) => {
    const c = await loadOwnCompany(req, parse(IdParam, req.params).id)
    const impact = await companyImpact(c.id)
    return { name: c.name, users: impact.userIds.length, pocs: impact.pocIds.length, reports: impact.reportIds.length, companies: impact.companyIds.length }
  })

  // Everything goes with the Company; the caller confirms by typing its name.
  app.delete('/accounts/companies/:id', async (req, reply) => {
    const auth = staff(req)
    const c = await loadOwnCompany(req, parse(IdParam, req.params).id)
    const { confirmName } = parse(z.object({ confirmName: z.string() }), req.body ?? {})
    if (customerNameKey(confirmName) !== c.nameKey) throw new HttpError(400, 'confirm_name')
    const impact = await companyImpact(c.id)
    if (impact.userIds.includes(auth.user.id)) throw new HttpError(400, 'cannot_delete_self')
    await deleteCompany(impact)
    await audit({
      action: 'customer.deleted',
      userId: auth.user.id,
      target: c.id,
      ip: req.ip,
      meta: { name: c.name, profile: c.profile, users: impact.userIds.length, pocs: impact.pocIds.length, reports: impact.reportIds.length, companies: impact.companyIds.length },
    })
    return reply.code(204).send()
  })
}

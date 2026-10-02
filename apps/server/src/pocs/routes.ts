import { ArchImageInput, CreatePocInput, InstanceUrl, StellarCredential, UpdatePocInput } from '@poc-intel/shared'
import { and, desc, eq, inArray, sql as dsql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth, requireRole } from '../auth/guards.js'
import type { AuthContext } from '../auth/session.js'
import { db } from '../db/client.js'
import { customers, pocs, reportData, syncs } from '../db/schema.js'
import { audit } from '../lib/audit.js'
import { HttpError, notFound, parse } from '../lib/http.js'
import { getSettings } from '../settings.js'
import type { StellarDeps } from '../app.js'
import { StellarClient } from '../stellar/client.js'
import { listTenants } from '../stellar/tenants.js'
import { canEdit, loadPoc } from './access.js'

const IdParam = z.object({ id: z.uuid() })
const staff = (req: Parameters<typeof requireAuth>[0]) => requireRole(req, 'admin', 'sales_engineer', 'partner')

/** A PoC can only be linked to a Customer its Owner manages (an Admin may link any). */
async function checkCustomer(auth: AuthContext, customerId: string | null | undefined) {
  if (!customerId) return
  const [c] = await db.select({ ownerId: customers.ownerId }).from(customers).where(eq(customers.id, customerId)).limit(1)
  if (!c || (auth.user.role !== 'admin' && c.ownerId !== auth.user.id)) throw new HttpError(400, 'customer_not_yours')
}

const expiresAt = (createdAt: Date, retentionDays: number) => new Date(createdAt.getTime() + retentionDays * 86_400_000)

export async function pocRoutes(app: FastifyInstance, { dispatcher }: StellarDeps): Promise<void> {
  // Lists the Tenants a Stellar Credential can see, so the User can pick one when creating a PoC.
  // The credential is used for this call only.
  app.post('/stellar/tenants', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req) => {
    staff(req)
    const input = parse(z.object({ instanceUrl: InstanceUrl, credential: StellarCredential }), req.body)
    const client = new StellarClient(input.instanceUrl, input.credential, dispatcher)
    await client.authenticate()
    return listTenants(client)
  })

  app.get('/pocs', async (req) => {
    const auth = requireAuth(req)
    const { all } = parse(z.object({ all: z.stringbool().optional() }), req.query)
    const seeAll = all === true && auth.user.role === 'admin'
    return db
      .select({
        id: pocs.id,
        ownerId: pocs.ownerId,
        customerName: dsql<string>`${pocs.details}->>'customerName'`,
        tenantName: pocs.tenantName,
        periodStart: pocs.periodStart,
        periodEnd: pocs.periodEnd,
        updatedAt: pocs.updatedAt,
      })
      .from(pocs)
      .where(
        seeAll ? undefined : auth.user.role === 'customer' ? eq(pocs.customerId, auth.user.customerId ?? '00000000-0000-0000-0000-000000000000') : eq(pocs.ownerId, auth.user.id),
      )
      .orderBy(desc(pocs.updatedAt))
  })

  app.post('/pocs', async (req, reply) => {
    const auth = staff(req)
    const input = parse(CreatePocInput, req.body)
    await checkCustomer(auth, input.customerId)
    const [poc] = await db
      .insert(pocs)
      .values({
        ownerId: auth.user.id,
        customerId: input.customerId ?? null,
        instanceUrl: input.instanceUrl,
        tenantId: input.tenant.id,
        tenantName: input.tenant.name,
        periodStart: input.period.start,
        periodEnd: input.period.end,
        details: input.details,
      })
      .returning()
    await audit({ action: 'poc.created', userId: auth.user.id, target: poc!.id, ip: req.ip })
    return reply.code(201).send(poc)
  })

  app.get('/pocs/:id', async (req) => {
    const auth = requireAuth(req)
    const poc = await loadPoc(auth, parse(IdParam, req.params).id)
    const [{ retentionDays }, reports, recentSyncs] = await Promise.all([
      getSettings(),
      db
        .select({ id: reportData.id, createdAt: reportData.createdAt, version: reportData.version })
        .from(reportData)
        .where(eq(reportData.pocId, poc.id))
        .orderBy(desc(reportData.createdAt)),
      db
        .select({ id: syncs.id, status: syncs.status, progress: syncs.progress, error: syncs.error, createdAt: syncs.createdAt, finishedAt: syncs.finishedAt, reportDataId: syncs.reportDataId })
        .from(syncs)
        .where(eq(syncs.pocId, poc.id))
        .orderBy(desc(syncs.createdAt))
        .limit(10),
    ])
    const [customer] = poc.customerId ? await db.select({ name: customers.name }).from(customers).where(eq(customers.id, poc.customerId)).limit(1) : []
    return {
      ...poc,
      archImage: undefined,
      hasArchImage: poc.archImage != null,
      customerName: customer?.name ?? null,
      canEdit: canEdit(auth, poc),
      reports: reports.map((r) => ({ ...r, expiresAt: expiresAt(r.createdAt, retentionDays) })),
      syncs: recentSyncs,
    }
  })

  app.patch('/pocs/:id', async (req) => {
    const auth = requireAuth(req)
    const poc = await loadPoc(auth, parse(IdParam, req.params).id, 'edit')
    const input = parse(UpdatePocInput, req.body)
    await checkCustomer(auth, input.customerId)
    const [updated] = await db
      .update(pocs)
      .set({
        ...(input.details ? { details: input.details } : {}),
        ...(input.period ? { periodStart: input.period.start, periodEnd: input.period.end } : {}),
        ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
        updatedAt: dsql`now()`,
      })
      .where(eq(pocs.id, poc.id))
      .returning()
    await audit({ action: 'poc.updated', userId: auth.user.id, target: poc.id, ip: req.ip })
    return updated
  })

  app.delete('/pocs/:id', async (req, reply) => {
    const auth = requireAuth(req)
    const poc = await loadPoc(auth, parse(IdParam, req.params).id, 'edit')
    await db.delete(pocs).where(eq(pocs.id, poc.id))
    await audit({ action: 'poc.deleted', userId: auth.user.id, target: poc.id, ip: req.ip })
    return reply.code(204).send()
  })

  app.post('/pocs/:id/syncs', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const auth = requireAuth(req)
    const poc = await loadPoc(auth, parse(IdParam, req.params).id, 'edit')
    const { credential } = parse(z.object({ credential: StellarCredential }), req.body)

    const [active] = await db
      .select({ id: syncs.id })
      .from(syncs)
      .where(and(eq(syncs.pocId, poc.id), inArray(syncs.status, ['queued', 'running'])))
      .limit(1)
    if (active) return reply.code(409).send({ error: 'sync_in_progress', syncId: active.id })

    const [sync] = await db.insert(syncs).values({ pocId: poc.id, requestedBy: auth.user.id }).returning({ id: syncs.id })
    await app.enqueueSync(sync!.id, credential)
    await audit({ action: 'sync.requested', userId: auth.user.id, target: poc.id, ip: req.ip, meta: { syncId: sync!.id } })
    return reply.code(202).send({ syncId: sync!.id })
  })

  // Architecture image for the Technical Report, resized in the browser and stored as a data: URL.
  app.put('/pocs/:id/arch-image', { bodyLimit: 3_200_000 }, async (req) => {
    const auth = requireAuth(req)
    const poc = await loadPoc(auth, parse(IdParam, req.params).id, 'edit')
    const { dataUrl } = parse(ArchImageInput, req.body)
    await db.update(pocs).set({ archImage: dataUrl, updatedAt: dsql`now()` }).where(eq(pocs.id, poc.id))
    await audit({ action: 'poc.arch_image', userId: auth.user.id, target: poc.id, ip: req.ip })
    return { ok: true }
  })

  app.get('/pocs/:id/arch-image', async (req, reply) => {
    const poc = await loadPoc(requireAuth(req), parse(IdParam, req.params).id)
    if (!poc.archImage) throw notFound()
    const [, mime, b64] = poc.archImage.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/) ?? []
    return reply.type(mime ?? 'application/octet-stream').header('cache-control', 'private, max-age=60').send(Buffer.from(b64 ?? '', 'base64'))
  })

  app.get('/syncs/:id', async (req) => {
    const auth = requireAuth(req)
    const { id } = parse(IdParam, req.params)
    const [sync] = await db.select().from(syncs).where(eq(syncs.id, id)).limit(1)
    if (!sync) throw notFound()
    await loadPoc(auth, sync.pocId)
    return sync
  })
}

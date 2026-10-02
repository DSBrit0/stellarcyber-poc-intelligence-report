import { ArchImageInput, CreatePocInput, InstanceUrl, PocPeriod, StellarCredential, UpdatePocInput } from '@poc-intel/shared'
import { and, desc, eq, inArray, sql as dsql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth, requireRole } from '../auth/guards.js'
import type { AuthContext } from '../auth/session.js'
import { db } from '../db/client.js'
import { customers, pocs, reportData, syncs, users } from '../db/schema.js'
import { audit } from '../lib/audit.js'
import { HttpError, notFound, parse } from '../lib/http.js'
import { getSettings } from '../settings.js'
import { apiCallRecorder, appLog } from '../lib/log-sink.js'
import { deleteRenders } from '../report/render-cache.js'
import { forgetCredential, rememberCredential, rememberedCredential, rememberedInstances } from '../credentials/remembered.js'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { StellarDeps } from '../app.js'
import { StellarClient } from '../stellar/client.js'
import { listTenants } from '../stellar/tenants.js'
import { canEdit, loadPoc } from './access.js'

const IdParam = z.object({ id: z.uuid() })
const staff = (req: Parameters<typeof requireAuth>[0]) => requireRole(req, 'admin', 'sales_engineer', 'partner')

/** A PoC can only be linked to a Customer its Owner manages (an Admin may link any). */
/** The credential typed now, or the one this browser remembers for the Instance (ADR 0009). */
function resolveCredential(
  req: FastifyRequest,
  reply: FastifyReply,
  userId: string,
  instanceUrl: string,
  typed: z.infer<typeof StellarCredential> | undefined,
  remember: boolean | undefined,
) {
  if (typed) {
    if (remember) rememberCredential(reply, userId, instanceUrl, typed)
    return typed
  }
  const remembered = rememberedCredential(req, userId, instanceUrl)
  if (!remembered) throw new HttpError(400, 'credential_required')
  return remembered
}

async function checkCustomer(auth: AuthContext, customerId: string | null | undefined) {
  if (!customerId) return
  const [c] = await db.select({ ownerId: customers.ownerId }).from(customers).where(eq(customers.id, customerId)).limit(1)
  if (!c || (auth.user.role !== 'admin' && c.ownerId !== auth.user.id)) throw new HttpError(400, 'customer_not_yours')
}

const expiresAt = (createdAt: Date, retentionDays: number) => new Date(createdAt.getTime() + retentionDays * 86_400_000)

export async function pocRoutes(app: FastifyInstance, { dispatcher }: StellarDeps): Promise<void> {
  // Lists the Tenants a Stellar Credential can see, so the User can pick one when creating a PoC.
  // The credential is used for this call only.
  app.post('/stellar/tenants', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const auth = staff(req)
    const input = parse(z.object({ instanceUrl: InstanceUrl, credential: StellarCredential.optional(), remember: z.boolean().optional() }), req.body)
    const credential = resolveCredential(req, reply, auth.user.id, input.instanceUrl, input.credential, input.remember)
    const client = new StellarClient(input.instanceUrl, credential, dispatcher, apiCallRecorder({ userId: auth.user.id }))
    await client.authenticate()
    // Remember only a credential the Instance accepted.
    if (input.credential && input.remember) rememberCredential(reply, auth.user.id, input.instanceUrl, input.credential)
    return listTenants(client)
  })

  // Remembered credentials of this User in this browser (ADR 0009): which Instances, never the secret.
  app.get('/stellar/credentials', async (req) => rememberedInstances(req, staff(req).user.id))

  app.delete('/stellar/credentials', async (req, reply) => {
    staff(req)
    const { instanceUrl } = parse(z.object({ instanceUrl: InstanceUrl }), req.query)
    forgetCredential(reply, instanceUrl)
    return reply.code(204).send()
  })

  // An Admin sees every PoC (optionally one Owner's: `owner=me` or a User id); an SE/Partner their own;
  // a Customer User the PoCs linked to their Customer.
  app.get('/pocs', async (req) => {
    const auth = requireAuth(req)
    const { owner } = parse(z.object({ owner: z.union([z.literal('me'), z.uuid()]).optional() }), req.query)
    const scope =
      auth.user.role === 'admin'
        ? owner
          ? eq(pocs.ownerId, owner === 'me' ? auth.user.id : owner)
          : undefined
        : auth.user.role === 'customer'
          ? eq(pocs.customerId, auth.user.customerId ?? '00000000-0000-0000-0000-000000000000')
          : eq(pocs.ownerId, auth.user.id)
    return db
      .select({
        id: pocs.id,
        ownerId: pocs.ownerId,
        ownerName: users.name,
        customerName: dsql<string>`${pocs.details}->>'customerName'`,
        linkedCustomer: customers.name,
        tenantName: pocs.tenantName,
        periodStart: pocs.periodStart,
        periodEnd: pocs.periodEnd,
        draft: pocs.draft,
        updatedAt: pocs.updatedAt,
        reports: dsql<number>`(SELECT count(*)::int FROM report_data r WHERE r.poc_id = ${pocs.id})`,
      })
      .from(pocs)
      .leftJoin(users, eq(users.id, pocs.ownerId))
      .leftJoin(customers, eq(customers.id, pocs.customerId))
      .where(scope)
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
        draft: input.draft ?? false,
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
        .select({
          id: reportData.id,
          createdAt: reportData.createdAt,
          seq: reportData.seq,
          // seq.minor, where minor counts the Report comments (see report/versioning.ts). report_data.id is
          // written out: drizzle leaves columns unqualified in a single-table select.
          version: dsql<string>`${reportData.seq} || '.' || (SELECT count(*) FROM report_comments c WHERE c.report_data_id = report_data.id AND c.kind = 'report')`,
          // Widget figures read straight from the JSONB, without loading the whole Report Data.
          assetsAvg: dsql<number | null>`(${reportData.data}->'assets'->'compliance'->'stats'->>'avg')::float`,
          assetsPeak: dsql<number | null>`(${reportData.data}->'assets'->'compliance'->'stats'->>'max')::float`,
          volumeGb: dsql<number | null>`(SELECT sum((d->>'value')::float) FROM jsonb_array_elements(${reportData.data}->'volume'->'dailyGb') d)`,
          cases: dsql<number | null>`(${reportData.data}->'cases'->>'total')::int`,
          alerts: dsql<number | null>`(${reportData.data}->'caseStats'->>'alerts')::int`,
          tenantName: dsql<string>`${reportData.data}->'tenant'->>'name'`,
          periodStart: dsql<string>`${reportData.data}->'period'->>'start'`,
          periodEnd: dsql<string>`${reportData.data}->'period'->>'end'`,
        })
        .from(reportData)
        .where(eq(reportData.pocId, poc.id))
        .orderBy(desc(reportData.createdAt)),
      db
        .select({
          id: syncs.id,
          status: syncs.status,
          progress: syncs.progress,
          error: syncs.error,
          createdAt: syncs.createdAt,
          finishedAt: syncs.finishedAt,
          reportDataId: syncs.reportDataId,
          periodStart: dsql<string>`coalesce(${syncs.periodStart}, ${pocs.periodStart})`,
          periodEnd: dsql<string>`coalesce(${syncs.periodEnd}, ${pocs.periodEnd})`,
        })
        .from(syncs)
        .innerJoin(pocs, eq(pocs.id, syncs.pocId))
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
        ...(input.finalize ? { draft: false } : {}),
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
    // Permanent: Report Data, Syncs and comments go by cascade; cached PDFs are removed from disk.
    const reports = await db.select({ id: reportData.id }).from(reportData).where(eq(reportData.pocId, poc.id))
    await db.delete(pocs).where(eq(pocs.id, poc.id))
    const renders = await deleteRenders(reports.map((r) => r.id))
    await audit({ action: 'poc.deleted', userId: auth.user.id, target: poc.id, ip: req.ip, meta: { reports: reports.length, renders } })
    return reply.code(204).send()
  })

  app.post('/pocs/:id/syncs', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const auth = requireAuth(req)
    const poc = await loadPoc(auth, parse(IdParam, req.params).id, 'edit')
    const input = parse(z.object({ credential: StellarCredential.optional(), remember: z.boolean().optional(), period: PocPeriod.optional() }), req.body)
    // Data is complete only for past days: the period must end yesterday (UTC) at the latest.
    if (input.period && input.period.end >= new Date().toISOString().slice(0, 10)) throw new HttpError(400, 'period_future')
    const credential = resolveCredential(req, reply, auth.user.id, poc.instanceUrl, input.credential, input.remember)

    const [active] = await db
      .select({ id: syncs.id })
      .from(syncs)
      .where(and(eq(syncs.pocId, poc.id), inArray(syncs.status, ['queued', 'running'])))
      .limit(1)
    if (active) return reply.code(409).send({ error: 'sync_in_progress', syncId: active.id })

    const [sync] = await db
      .insert(syncs)
      .values({ pocId: poc.id, requestedBy: auth.user.id, periodStart: input.period?.start ?? null, periodEnd: input.period?.end ?? null })
      .returning({ id: syncs.id })
    await app.enqueueSync(sync!.id, credential)
    await audit({ action: 'sync.requested', userId: auth.user.id, target: poc.id, ip: req.ip, meta: { syncId: sync!.id, period: input.period ?? null } })
    appLog('info', 'sync', 'Sync requested', { userId: auth.user.id, requestId: req.id, context: { syncId: sync!.id, pocId: poc.id, remembered: !input.credential } })
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

import {
  CreateNotebookStartInput,
  CriterionInput,
  DataSourceInput,
  DataSourcePatch,
  CriterionPatch,
  MeetingInput,
  MeetingPatch,
  MilestoneAdd,
  MilestonePatch,
  type ProcessKind,
  NotebookOverview,
  PocDetails,
  ProcessAdd,
  ProcessFill,
  ProcessShape,
  ReportTargetInput,
  UpdateNotebookInput,
  stagesForProfile,
} from '@poc-intel/shared'
import { and, asc, eq, gt, gte, lt, sql as dsql } from 'drizzle-orm'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requireAuth, requireRole } from '../auth/guards.js'
import type { AuthContext } from '../auth/session.js'
import { db } from '../db/client.js'
import { catalogEntries, customers, experiences, notebookTemplateItems, pocCriteria, pocDataSources, pocMeetings, pocMilestones, pocProcessItems, pocs, reportData } from '../db/schema.js'
import { getCatalogState } from '../catalog/refresh.js'
import { templateForNewNotebook } from './template.js'
import { audit } from '../lib/audit.js'
import { HttpError, notFound, parse } from '../lib/http.js'
import { canFillNotebook, canShapeNotebook, loadPocAccess, reportTarget, type PocRow } from '../pocs/access.js'

const IdParam = z.object({ id: z.uuid() })
const RowParams = z.object({ id: z.uuid(), rowId: z.uuid() })

/** The PoC, if it has a Notebook the caller may fill in (`shape`: may also hide, remove or add items). */
async function loadNotebook(auth: AuthContext, pocId: string, mode: 'view' | 'fill' | 'shape' = 'view'): Promise<{ poc: PocRow; canFill: boolean; canShape: boolean }> {
  const { poc, followerId } = await loadPocAccess(auth, pocId)
  if (poc.notebook == null) throw notFound()
  const canFill = canFillNotebook(auth, poc, followerId)
  const canShape = canShapeNotebook(auth, poc, followerId)
  if ((mode === 'fill' && !canFill) || (mode === 'shape' && !canShape)) throw new HttpError(403, 'forbidden')
  return { poc, canFill, canShape }
}

const touch = (pocId: string) => db.update(pocs).set({ updatedAt: dsql`now()` }).where(eq(pocs.id, pocId))

export async function notebookRoutes(app: FastifyInstance): Promise<void> {
  // "Start a PoC Notebook": always for a Customer the caller manages (ADR 0010); no Tenant yet.
  app.post('/pocs/notebook', async (req: FastifyRequest, reply) => {
    const auth = requireRole(req, 'admin', 'sales_engineer', 'partner')
    const input = parse(CreateNotebookStartInput, req.body)
    // Partners never run a Stellar Experience (canRunExperience); the creator is the Owner, so an SE or Admin may.
    if (input.experience && auth.user.role === 'partner') throw new HttpError(403, 'forbidden')
    const [customer] = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1)
    if (!customer || (auth.user.role !== 'admin' && customer.ownerId !== auth.user.id)) throw new HttpError(400, 'customer_not_yours')
    if (customer.profile !== 'customer') throw new HttpError(400, 'customer_is_partner')

    const poc = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(pocs)
        .values({
          ownerId: auth.user.id,
          customerId: customer.id,
          details: PocDetails.parse({ customerName: input.customerName ?? customer.name }),
          notebook: NotebookOverview.parse({ startDate: input.startDate }),
        })
        .returning()
      // The Notebook starts as a copy of the template's visible items (ADR 0012).
      const { process, schedule } = templateForNewNotebook(await tx.select().from(notebookTemplateItems))
      const phases = new Map<string, string>()
      if (process.length > 0) {
        const rows = await tx
          .insert(pocProcessItems)
          .values(process.map((t, i) => ({ pocId: created!.id, kind: t.kind as ProcessKind, position: i + 1, indent: t.indent, text: t.text, key: t.kind === 'phase' ? t.key : null })))
          .returning({ id: pocProcessItems.id, key: pocProcessItems.key })
        for (const r of rows) if (r.key) phases.set(r.key, r.id)
      }
      // Each milestone points to the phase it stands for.
      if (schedule.length > 0) {
        await tx.insert(pocMilestones).values(
          schedule.map((t, i) => ({ pocId: created!.id, position: i + 1, key: t.key, text: t.text, days: t.days ?? 2, tone: t.tone ?? 'poc', phaseId: t.key ? (phases.get(t.key) ?? null) : null })),
        )
      }
      // Started from "Stellar Experience": the first Experience, Disabled until the Presenter starts it.
      let experienceId: string | null = null
      if (input.experience) {
        const stages = stagesForProfile(input.experience.profile)
        const [exp] = await tx
          .insert(experiences)
          .values({ pocId: created!.id, name: input.experience.name, profile: input.experience.profile, stages, currentStage: stages[0]!, createdBy: auth.user.id })
          .returning({ id: experiences.id })
        experienceId = exp!.id
      }
      return { ...created!, experienceId }
    })
    await audit({ action: 'poc.created', userId: auth.user.id, target: poc.id, ip: req.ip, meta: { notebook: true, experience: poc.experienceId != null } })
    return reply.code(201).send({ id: poc.id, experienceId: poc.experienceId })
  })

  app.get('/pocs/:id/notebook', async (req) => {
    const auth = requireAuth(req)
    const { poc, canFill, canShape } = await loadNotebook(auth, parse(IdParam, req.params).id)
    const [criteria, meetings, process, sources, catalog, milestones] = await Promise.all([
      db.select().from(pocCriteria).where(eq(pocCriteria.pocId, poc.id)).orderBy(asc(pocCriteria.position)),
      db.select().from(pocMeetings).where(eq(pocMeetings.pocId, poc.id)).orderBy(asc(pocMeetings.date), asc(pocMeetings.createdAt)),
      db.select().from(pocProcessItems).where(eq(pocProcessItems.pocId, poc.id)).orderBy(asc(pocProcessItems.position)),
      db
        .select({
          id: pocDataSources.id,
          kind: pocDataSources.kind,
          catalogId: pocDataSources.catalogId,
          name: pocDataSources.name,
          port: pocDataSources.port,
          status: pocDataSources.status,
          notes: pocDataSources.notes,
          category: catalogEntries.category,
          docUrl: catalogEntries.docUrl,
          // The catalog no longer lists it: the Notebook keeps it, flagged.
          removed: dsql<boolean>`${catalogEntries.removedAt} IS NOT NULL`,
        })
        .from(pocDataSources)
        .leftJoin(catalogEntries, eq(catalogEntries.id, pocDataSources.catalogId))
        .where(eq(pocDataSources.pocId, poc.id))
        .orderBy(asc(pocDataSources.position)),
      getCatalogState(),
      db.select().from(pocMilestones).where(eq(pocMilestones.pocId, poc.id)).orderBy(asc(pocMilestones.position)),
    ])
    const d = poc.details
    return {
      overview: poc.notebook,
      details: { customerName: d.customerName, department: d.department, customerEmail: d.customerEmail, analysts: d.analysts, salesEngineer: d.salesEngineer, partner: d.partner },
      criteria,
      meetings,
      sources,
      milestones,
      // The documentation version of the catalog, for the Overview's links.
      docsVersion: catalog.version?.segment ?? null,
      // Hidden items are kept for the people who shape the Notebook, so they can show them again.
      process: canShape ? process : process.filter((p) => !p.hidden),
      canFill,
      canShape,
      hasReportTarget: reportTarget(poc) != null,
    }
  })

  app.patch('/pocs/:id/notebook', async (req) => {
    const auth = requireAuth(req)
    const { poc } = await loadNotebook(auth, parse(IdParam, req.params).id, 'fill')
    const input = parse(UpdateNotebookInput, req.body)
    // Each field is validated on its own and merged in the database, so two people saving different
    // fields at the same moment both keep their change.
    const overview = JSON.stringify(input.overview ?? {})
    const details = JSON.stringify(input.details ?? {})
    await db
      .update(pocs)
      .set({
        notebook: dsql`${pocs.notebook} || ${overview}::jsonb`,
        details: dsql`${pocs.details} || ${details}::jsonb`,
        updatedAt: dsql`now()`,
      })
      .where(eq(pocs.id, poc.id))
    return { ok: true }
  })

  // Success Criteria & Use Cases.
  app.post('/pocs/:id/notebook/criteria', async (req, reply) => {
    const auth = requireAuth(req)
    const { poc } = await loadNotebook(auth, parse(IdParam, req.params).id, 'fill')
    const input = parse(CriterionInput, req.body)
    const [row] = await db
      .insert(pocCriteria)
      .values({ ...input, pocId: poc.id, updatedBy: auth.user.id, position: dsql`coalesce((SELECT max(position) FROM poc_criteria WHERE poc_id = ${poc.id}), 0) + 1` })
      .returning()
    await touch(poc.id)
    return reply.code(201).send(row)
  })

  app.patch('/pocs/:id/notebook/criteria/:rowId', async (req) => {
    const auth = requireAuth(req)
    const { id, rowId } = parse(RowParams, req.params)
    const { poc } = await loadNotebook(auth, id, 'fill')
    const input = parse(CriterionPatch, req.body)
    const [row] = await db
      .update(pocCriteria)
      .set({ ...input, updatedBy: auth.user.id, updatedAt: dsql`now()` })
      .where(and(eq(pocCriteria.id, rowId), eq(pocCriteria.pocId, poc.id)))
      .returning()
    if (!row) throw notFound()
    await touch(poc.id)
    return row
  })

  app.delete('/pocs/:id/notebook/criteria/:rowId', async (req, reply) => {
    const auth = requireAuth(req)
    const { id, rowId } = parse(RowParams, req.params)
    const { poc } = await loadNotebook(auth, id, 'fill')
    await db.delete(pocCriteria).where(and(eq(pocCriteria.id, rowId), eq(pocCriteria.pocId, poc.id)))
    await touch(poc.id)
    return reply.code(204).send()
  })

  // Data Sources and Connectors: picked from the catalog (its port comes along) or typed.
  app.post('/pocs/:id/notebook/sources', async (req, reply) => {
    const auth = requireAuth(req)
    const { poc } = await loadNotebook(auth, parse(IdParam, req.params).id, 'fill')
    const input = parse(DataSourceInput, req.body)
    let { name, port } = input
    if (input.catalogId) {
      const [entry] = await db.select().from(catalogEntries).where(and(eq(catalogEntries.id, input.catalogId), eq(catalogEntries.kind, input.kind))).limit(1)
      if (!entry) throw notFound()
      name = entry.name
      port = entry.port
    }
    const [row] = await db
      .insert(pocDataSources)
      .values({
        pocId: poc.id,
        kind: input.kind,
        catalogId: input.catalogId,
        name,
        port,
        updatedBy: auth.user.id,
        position: dsql`coalesce((SELECT max(position) FROM poc_data_sources WHERE poc_id = ${poc.id}), 0) + 1`,
      })
      .returning()
    await touch(poc.id)
    return reply.code(201).send(row)
  })

  app.patch('/pocs/:id/notebook/sources/:rowId', async (req) => {
    const auth = requireAuth(req)
    const { id, rowId } = parse(RowParams, req.params)
    const { poc } = await loadNotebook(auth, id, 'fill')
    const input = parse(DataSourcePatch, req.body)
    const [row] = await db
      .update(pocDataSources)
      .set({ ...input, updatedBy: auth.user.id, updatedAt: dsql`now()` })
      .where(and(eq(pocDataSources.id, rowId), eq(pocDataSources.pocId, poc.id)))
      .returning()
    if (!row) throw notFound()
    await touch(poc.id)
    return row
  })

  app.delete('/pocs/:id/notebook/sources/:rowId', async (req, reply) => {
    const auth = requireAuth(req)
    const { id, rowId } = parse(RowParams, req.params)
    const { poc } = await loadNotebook(auth, id, 'fill')
    await db.delete(pocDataSources).where(and(eq(pocDataSources.id, rowId), eq(pocDataSources.pocId, poc.id)))
    await touch(poc.id)
    return reply.code(204).send()
  })

  // Meeting Notes.
  app.post('/pocs/:id/notebook/meetings', async (req, reply) => {
    const auth = requireAuth(req)
    const { poc } = await loadNotebook(auth, parse(IdParam, req.params).id, 'fill')
    const input = parse(MeetingInput, req.body)
    const [row] = await db
      .insert(pocMeetings)
      .values({ ...input, pocId: poc.id, updatedBy: auth.user.id })
      .returning()
    await touch(poc.id)
    return reply.code(201).send(row)
  })

  app.patch('/pocs/:id/notebook/meetings/:rowId', async (req) => {
    const auth = requireAuth(req)
    const { id, rowId } = parse(RowParams, req.params)
    const { poc } = await loadNotebook(auth, id, 'fill')
    const input = parse(MeetingPatch, req.body)
    const [row] = await db
      .update(pocMeetings)
      .set({ ...input, updatedBy: auth.user.id, updatedAt: dsql`now()` })
      .where(and(eq(pocMeetings.id, rowId), eq(pocMeetings.pocId, poc.id)))
      .returning()
    if (!row) throw notFound()
    await touch(poc.id)
    return row
  })

  app.delete('/pocs/:id/notebook/meetings/:rowId', async (req, reply) => {
    const auth = requireAuth(req)
    const { id, rowId } = parse(RowParams, req.params)
    const { poc } = await loadNotebook(auth, id, 'fill')
    await db.delete(pocMeetings).where(and(eq(pocMeetings.id, rowId), eq(pocMeetings.pocId, poc.id)))
    await touch(poc.id)
    return reply.code(204).send()
  })

  // PoC Process: everyone who fills the Notebook sets statuses; shaping is for its SE, Owner or an Admin.
  app.patch('/pocs/:id/notebook/process/:rowId', async (req) => {
    const auth = requireAuth(req)
    const { id, rowId } = parse(RowParams, req.params)
    const body = req.body as Record<string, unknown> | undefined
    const shaping = body != null && ['text', 'hidden', 'kind', 'indent'].some((k) => k in body)
    const { poc } = await loadNotebook(auth, id, shaping ? 'shape' : 'fill')
    const input = shaping ? { ...parse(ProcessShape, body), ...('status' in body ? parse(ProcessFill, body) : {}) } : parse(ProcessFill, body)
    const [row] = await db
      .update(pocProcessItems)
      .set({ ...input, updatedBy: auth.user.id, updatedAt: dsql`now()` })
      .where(and(eq(pocProcessItems.id, rowId), eq(pocProcessItems.pocId, poc.id)))
      .returning()
    if (!row) throw notFound()
    await touch(poc.id)
    return row
  })

  app.post('/pocs/:id/notebook/process', async (req, reply) => {
    const auth = requireAuth(req)
    const { poc } = await loadNotebook(auth, parse(IdParam, req.params).id, 'shape')
    const input = parse(ProcessAdd, req.body)
    const position = await positionAfter(poc.id, input.afterId)
    const [row] = await db
      .insert(pocProcessItems)
      .values({ pocId: poc.id, kind: input.kind, indent: input.indent, text: input.text, position, updatedBy: auth.user.id })
      .returning()
    await touch(poc.id)
    return reply.code(201).send(row)
  })

  app.delete('/pocs/:id/notebook/process/:rowId', async (req, reply) => {
    const auth = requireAuth(req)
    const { id, rowId } = parse(RowParams, req.params)
    const { poc } = await loadNotebook(auth, id, 'shape')
    const [row] = await db.select().from(pocProcessItems).where(and(eq(pocProcessItems.id, rowId), eq(pocProcessItems.pocId, poc.id))).limit(1)
    if (!row) throw notFound()
    if (row.kind === 'phase') {
      // A phase goes with its whole section (up to the next phase) and, by cascade, its milestone.
      const [next] = await db
        .select({ p: pocProcessItems.position })
        .from(pocProcessItems)
        .where(and(eq(pocProcessItems.pocId, poc.id), eq(pocProcessItems.kind, 'phase'), gt(pocProcessItems.position, row.position)))
        .orderBy(asc(pocProcessItems.position))
        .limit(1)
      await db
        .delete(pocProcessItems)
        .where(and(eq(pocProcessItems.pocId, poc.id), gte(pocProcessItems.position, row.position), next ? lt(pocProcessItems.position, next.p) : undefined))
    } else {
      await db.delete(pocProcessItems).where(eq(pocProcessItems.id, row.id))
    }
    await touch(poc.id)
    return reply.code(204).send()
  })

  // PoC Schedule: shaped by the Notebook's SE, Owner or an Admin; the dates follow from the start date.
  app.patch('/pocs/:id/notebook/milestones/:rowId', async (req) => {
    const auth = requireAuth(req)
    const { id, rowId } = parse(RowParams, req.params)
    const { poc } = await loadNotebook(auth, id, 'shape')
    const input = parse(MilestonePatch, req.body)
    const [row] = await db
      .update(pocMilestones)
      .set({ ...input, updatedBy: auth.user.id, updatedAt: dsql`now()` })
      .where(and(eq(pocMilestones.id, rowId), eq(pocMilestones.pocId, poc.id)))
      .returning()
    if (!row) throw notFound()
    await touch(poc.id)
    return row
  })

  app.post('/pocs/:id/notebook/milestones', async (req, reply) => {
    const auth = requireAuth(req)
    const { poc } = await loadNotebook(auth, parse(IdParam, req.params).id, 'shape')
    const input = parse(MilestoneAdd, req.body)
    const position = await milestonePositionAfter(poc.id, input.afterId)
    const [row] = await db
      .insert(pocMilestones)
      .values({ pocId: poc.id, position, text: input.text, days: input.days, tone: input.tone, updatedBy: auth.user.id })
      .returning()
    await touch(poc.id)
    return reply.code(201).send(row)
  })

  app.delete('/pocs/:id/notebook/milestones/:rowId', async (req, reply) => {
    const auth = requireAuth(req)
    const { id, rowId } = parse(RowParams, req.params)
    const { poc } = await loadNotebook(auth, id, 'shape')
    await db.delete(pocMilestones).where(and(eq(pocMilestones.id, rowId), eq(pocMilestones.pocId, poc.id)))
    await touch(poc.id)
    return reply.code(204).send()
  })

  // "Create the Final Report" on a Notebook: sets the Report target; the Sync then runs as usual. It can
  // be set again until a Report exists (e.g. the first Sync failed on a wrong Tenant).
  app.post('/pocs/:id/report-target', async (req) => {
    const auth = requireAuth(req)
    const { poc } = await loadPocAccess(auth, parse(IdParam, req.params).id, 'edit')
    const [report] = await db.select({ id: reportData.id }).from(reportData).where(eq(reportData.pocId, poc.id)).limit(1)
    if (report) throw new HttpError(409, 'report_target_set')
    const input = parse(ReportTargetInput, req.body)
    await db
      .update(pocs)
      .set({
        instanceUrl: input.instanceUrl,
        tenantId: input.tenant.id,
        tenantName: input.tenant.name,
        periodStart: input.period.start,
        periodEnd: input.period.end,
        updatedAt: dsql`now()`,
      })
      .where(eq(pocs.id, poc.id))
    await audit({ action: 'poc.updated', userId: auth.user.id, target: poc.id, ip: req.ip, meta: { reportTarget: true } })
    return { ok: true }
  })
}

/** A position between the item `afterId` and the next one; at the top when `afterId` is null. */
async function positionAfter(pocId: string, afterId: string | null): Promise<number> {
  if (afterId == null) {
    const [first] = await db.select({ p: pocProcessItems.position }).from(pocProcessItems).where(eq(pocProcessItems.pocId, pocId)).orderBy(asc(pocProcessItems.position)).limit(1)
    return (first?.p ?? 1) - 1
  }
  const [after] = await db.select({ p: pocProcessItems.position }).from(pocProcessItems).where(and(eq(pocProcessItems.id, afterId), eq(pocProcessItems.pocId, pocId))).limit(1)
  if (!after) throw notFound()
  const [next] = await db
    .select({ p: pocProcessItems.position })
    .from(pocProcessItems)
    .where(and(eq(pocProcessItems.pocId, pocId), gt(pocProcessItems.position, after.p)))
    .orderBy(asc(pocProcessItems.position))
    .limit(1)
  return next ? (after.p + next.p) / 2 : after.p + 1
}

async function milestonePositionAfter(pocId: string, afterId: string | null): Promise<number> {
  const rows = await db.select({ id: pocMilestones.id, p: pocMilestones.position }).from(pocMilestones).where(eq(pocMilestones.pocId, pocId)).orderBy(asc(pocMilestones.position))
  if (afterId == null) return (rows[0]?.p ?? 1) - 1
  const i = rows.findIndex((r) => r.id === afterId)
  if (i < 0) throw notFound()
  const next = rows[i + 1]
  return next ? (rows[i]!.p + next.p) / 2 : rows[i]!.p + 1
}

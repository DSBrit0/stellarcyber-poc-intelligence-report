import { TemplateAdd, TemplateMove, TemplatePatch } from '@poc-intel/shared'
import { and, asc, eq, sql as dsql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { requireRole } from '../auth/guards.js'
import { db } from '../db/client.js'
import { notebookTemplateItems, type NotebookTemplateItem } from '../db/schema.js'
import { audit } from '../lib/audit.js'
import { HttpError, notFound, parse } from '../lib/http.js'
import { reorder, sectionEnd } from './template.js'

const IdParam = z.object({ id: z.uuid() })
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const sectionRows = (tx: Tx | typeof db, section: NotebookTemplateItem['section']) =>
  tx.select().from(notebookTemplateItems).where(eq(notebookTemplateItems.section, section)).orderBy(asc(notebookTemplateItems.position))

/** A position right after `afterId` (or first), between it and the next row of the same section. */
function positionAfter(rows: NotebookTemplateItem[], afterId: string | null): number {
  if (afterId == null) return (rows[0]?.position ?? 1) - 1
  const i = rows.findIndex((r) => r.id === afterId)
  if (i < 0) throw notFound()
  const next = rows[i + 1]
  return next ? (rows[i]!.position + next.position) / 2 : rows[i]!.position + 1
}

/**
 * Admin: the Notebook Template (ADR 0012). Edits reach only the PoC Notebooks started afterwards;
 * existing Notebooks keep their own copy.
 */
export async function templateRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (req) => {
    requireRole(req, 'admin')
  })

  app.get('/template', async () => {
    const rows = await db.select().from(notebookTemplateItems).orderBy(asc(notebookTemplateItems.section), asc(notebookTemplateItems.position))
    return { process: rows.filter((r) => r.section === 'process'), schedule: rows.filter((r) => r.section === 'schedule') }
  })

  app.patch('/template/:id', async (req) => {
    const { id } = parse(IdParam, req.params)
    const input = parse(TemplatePatch, req.body)
    const row = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(notebookTemplateItems).where(eq(notebookTemplateItems.id, id)).limit(1)
      if (!before) throw notFound()
      const [updated] = await tx
        .update(notebookTemplateItems)
        .set({ ...input, updatedAt: dsql`now()` })
        .where(eq(notebookTemplateItems.id, id))
        .returning()
      // Renaming a phase renames its milestone too, unless the milestone was given a name of its own.
      if (before.section === 'process' && before.kind === 'phase' && before.key && input.text) {
        await tx
          .update(notebookTemplateItems)
          .set({ text: input.text, updatedAt: dsql`now()` })
          .where(and(eq(notebookTemplateItems.section, 'schedule'), eq(notebookTemplateItems.key, before.key), dsql`${notebookTemplateItems.text} = ${JSON.stringify(before.text)}::jsonb`))
      }
      return updated!
    })
    await audit({ action: 'template.updated', userId: req.auth!.user.id, target: id, ip: req.ip, meta: { change: Object.keys(input) } })
    return row
  })

  app.post('/template', async (req, reply) => {
    const input = parse(TemplateAdd, req.body)
    if ((input.section === 'schedule') !== (input.kind === 'milestone')) throw new HttpError(400, 'validation')
    const created = await db.transaction(async (tx) => {
      const rows = await sectionRows(tx, input.section)
      const key = input.kind === 'phase' ? `phase_${randomUUID().slice(0, 8)}` : null
      // A new phase starts after the whole section it is added from, never inside it: otherwise it
      // would take over the rest of that section's items.
      const afterId = input.kind === 'phase' ? sectionEnd(rows, input.afterId) : input.afterId
      const [row] = await tx
        .insert(notebookTemplateItems)
        .values({
          section: input.section,
          kind: input.kind,
          position: positionAfter(rows, afterId),
          indent: input.kind === 'phase' ? 0 : input.indent,
          text: input.text,
          days: input.kind === 'milestone' ? input.days : null,
          tone: input.kind === 'milestone' ? input.tone : null,
          key,
        })
        .returning()
      // A new phase: its milestone goes right after the milestone of the phase before it.
      if (key && input.withMilestone) {
        const process = await sectionRows(tx, 'process')
        const before = process.filter((r) => r.kind === 'phase' && r.position < row!.position && r.key).pop()
        const schedule = await sectionRows(tx, 'schedule')
        const anchor = schedule.find((m) => m.key === before?.key) ?? schedule[schedule.length - 1]
        await tx.insert(notebookTemplateItems).values({
          section: 'schedule',
          kind: 'milestone',
          position: positionAfter(schedule, anchor?.id ?? null),
          indent: 0,
          text: input.text,
          days: 2,
          tone: 'poc',
          key,
        })
      }
      return row!
    })
    await audit({ action: 'template.updated', userId: req.auth!.user.id, target: created.id, ip: req.ip, meta: { change: ['added'] } })
    return reply.code(201).send(created)
  })

  // A phase goes with its whole section and its milestone; any other row goes alone.
  app.delete('/template/:id', async (req, reply) => {
    const { id } = parse(IdParam, req.params)
    await db.transaction(async (tx) => {
      const [row] = await tx.select().from(notebookTemplateItems).where(eq(notebookTemplateItems.id, id)).limit(1)
      if (!row) throw notFound()
      if (row.section === 'process' && row.kind === 'phase') {
        const rows = await sectionRows(tx, 'process')
        const i = rows.findIndex((r) => r.id === row.id)
        const end = rows.findIndex((r, j) => j > i && r.kind === 'phase')
        const section = rows.slice(i, end < 0 ? undefined : end)
        for (const r of section) await tx.delete(notebookTemplateItems).where(eq(notebookTemplateItems.id, r.id))
        if (row.key) await tx.delete(notebookTemplateItems).where(and(eq(notebookTemplateItems.section, 'schedule'), eq(notebookTemplateItems.key, row.key)))
      } else {
        await tx.delete(notebookTemplateItems).where(eq(notebookTemplateItems.id, row.id))
      }
    })
    await audit({ action: 'template.updated', userId: req.auth!.user.id, target: id, ip: req.ip, meta: { change: ['deleted'] } })
    return reply.code(204).send()
  })

  // One step up or down: a phase moves with its whole section, any other row swaps with its neighbour.
  app.post('/template/:id/move', async (req) => {
    const { id } = parse(IdParam, req.params)
    const { direction } = parse(TemplateMove, req.body)
    await db.transaction(async (tx) => {
      const [row] = await tx.select().from(notebookTemplateItems).where(eq(notebookTemplateItems.id, id)).limit(1)
      if (!row) throw notFound()
      const ordered = reorder(await sectionRows(tx, row.section), id, direction)
      if (!ordered) return
      for (const [i, r] of ordered.entries()) {
        await tx.update(notebookTemplateItems).set({ position: i + 1 }).where(eq(notebookTemplateItems.id, r.id))
      }
    })
    return { ok: true }
  })
}

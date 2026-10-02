import { Locale, Template } from '@poc-intel/shared'
import { access } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../auth/guards.js'
import { audit } from '../lib/audit.js'
import { randomToken, sha256 } from '../lib/crypto.js'
import { HttpError, parse } from '../lib/http.js'
import { canEdit, loadReportData } from '../pocs/access.js'
import { db } from '../db/client.js'
import { reportData, syncs } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { renderReportHtml, reportCsp } from './render-html.js'
import { deleteRenders, renderPath } from './render-cache.js'
import { loadVersioning } from './versioning.js'

const Params = z.object({ id: z.uuid() })
const Query = z.object({ template: Template.default('technical'), locale: Locale.optional() })
const PDF_WAIT_MS = 60_000

const exists = (path: string) => access(path).then(() => true, () => false)

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  // The Report page is always the interactive version (hover insights, legends, keyboard navigation,
  // print); its one script runs only with this response's CSP nonce.
  app.get('/report-data/:id/html', async (req, reply) => {
    const auth = requireAuth(req)
    const { id } = parse(Params, req.params)
    const q = parse(Query, req.query)
    const { report, poc } = await loadReportData(auth, id)
    const nonce = randomToken(16)
    const html = renderReportHtml(report.data, poc.details, q.template, q.locale ?? auth.user.locale, {
      archImage: poc.archImage,
      interactiveNonce: nonce,
      versioning: await loadVersioning(report.id),
    })
    return reply.header('content-security-policy', reportCsp(nonce)).type('text/html; charset=utf-8').send(html)
  })

  // Permanent deletion of one Report: its Report Data, comments (cascade), the Sync that produced it
  // and every cached PDF. Only the Owner or an Admin. The audit log keeps only that it happened.
  app.delete('/report-data/:id', async (req, reply) => {
    const auth = requireAuth(req)
    const { report, poc } = await loadReportData(auth, parse(Params, req.params).id, { anyVersion: true })
    if (!canEdit(auth, poc)) throw new HttpError(403, 'forbidden')
    await db.transaction(async (tx) => {
      await tx.delete(syncs).where(eq(syncs.reportDataId, report.id))
      await tx.delete(reportData).where(eq(reportData.id, report.id))
    })
    const renders = await deleteRenders([report.id])
    await audit({ action: 'report.deleted', userId: auth.user.id, target: report.id, ip: req.ip, meta: { pocId: poc.id, renders } })
    return reply.code(204).send()
  })

  app.get('/report-data/:id/pdf', async (req, reply) => {
    const auth = requireAuth(req)
    const { id } = parse(Params, req.params)
    const q = parse(Query, req.query)
    const locale = q.locale ?? auth.user.locale
    const { report, poc } = await loadReportData(auth, id)

    // Cache key covers everything the PDF depends on: editing PoC details or adding a Report comment
    // (a new version) yields a fresh render.
    const versioning = await loadVersioning(report.id)
    const key = sha256(`${report.id}|${q.template}|${locale}|${poc.updatedAt.toISOString()}|${versioning?.version ?? ''}`).slice(0, 32)
    const outputPath = renderPath(report.id, key)
    if (!(await exists(outputPath))) {
      await app.enqueuePdf({ reportDataId: report.id, template: q.template, locale, outputPath })
      const deadline = Date.now() + PDF_WAIT_MS
      while (!(await exists(outputPath))) {
        if (Date.now() > deadline) throw new HttpError(504, 'render_timeout')
        await new Promise((r) => setTimeout(r, 400))
      }
    }
    await audit({ action: 'report.rendered', userId: auth.user.id, target: report.id, ip: req.ip, meta: { template: q.template, locale } })
    const safeName = poc.details.customerName.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60) || 'PoC'
    const filename = `StellarCyber_PoC_${q.template}_${safeName}_v${versioning?.version ?? '1.0'}_${report.createdAt.toISOString().slice(0, 10)}.pdf`
    return reply
      .type('application/pdf')
      .header('content-disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`)
      .send(createReadStream(outputPath))
  })
}

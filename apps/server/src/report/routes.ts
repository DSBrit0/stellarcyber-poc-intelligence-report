import { Locale, Template } from '@poc-intel/shared'
import { access } from 'node:fs/promises'
import { createReadStream, readFileSync } from 'node:fs'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../auth/guards.js'
import { audit } from '../lib/audit.js'
import { randomToken, sha256 } from '../lib/crypto.js'
import { HttpError, parse } from '../lib/http.js'
import { archImageOf, canEdit, loadReportData, loadReportMeta } from '../pocs/access.js'
import { detailsForReport } from './poc-details.js'
import { db } from '../db/client.js'
import { reportData, syncs } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { renderReportHtml, reportCsp } from './render-html.js'
import { deleteRenders, renderPath } from './render-cache.js'
import { loadVersioning } from './versioning.js'
import { cachedReportHtml, NONCE_SLOT, storeReportHtml, withNonce } from './html-cache.js'

const Params = z.object({ id: z.uuid() })
const Query = z.object({ template: Template.default('technical'), locale: Locale.optional() })
const PDF_WAIT_MS = 60_000

const exists = (path: string) => access(path).then(() => true, () => false)
// The running code (the bundle in production): a deploy that changes the Reports' layout must not
// serve PDFs rendered by the previous one from the disk cache.
const BUILD = sha256(readFileSync(new URL(import.meta.url), 'utf8')).slice(0, 12)

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  // The Report page is always the interactive version (hover insights, legends, keyboard navigation,
  // print); its one script runs only with this response's CSP nonce.
  app.get('/report-data/:id/html', async (req, reply) => {
    const auth = requireAuth(req)
    const { id } = parse(Params, req.params)
    const q = parse(Query, req.query)
    const locale = q.locale ?? auth.user.locale
    // Access first, without the Report itself; the page is rendered only when it is not cached.
    const { report, poc } = await loadReportMeta(auth, id)
    const versioning = await loadVersioning(report.id)
    // Everything the page depends on: editing the PoC (details, criteria, image) moves updatedAt; a
    // Report comment is a new version.
    const key = sha256(`${report.id}|${q.template}|${locale}|${poc.updatedAt.toISOString()}|${versioning?.version ?? ''}`)
    let page = cachedReportHtml(key)
    if (!page) {
      const { report: full } = await loadReportData(auth, id)
      const html = renderReportHtml(full.data, await detailsForReport(poc), q.template, locale, {
        // Only the Technical Report shows the architecture image: the others never read it.
        archImage: q.template === 'technical' && poc.hasArchImage ? await archImageOf(poc.id) : null,
        interactiveNonce: NONCE_SLOT,
        versioning,
      })
      storeReportHtml(key, html)
      page = cachedReportHtml(key)!
    }
    const nonce = randomToken(16)
    return reply.header('content-security-policy', reportCsp(nonce)).type('text/html; charset=utf-8').send(withNonce(page, nonce))
  })

  // Permanent deletion of one Report: its Report Data, comments (cascade), the Sync that produced it
  // and every cached PDF. Only the Owner or an Admin. The audit log keeps only that it happened.
  app.delete('/report-data/:id', async (req, reply) => {
    const auth = requireAuth(req)
    const { report, poc } = await loadReportMeta(auth, parse(Params, req.params).id, { anyVersion: true })
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
    const { report, poc } = await loadReportMeta(auth, id)

    // Cache key covers everything the PDF depends on: editing PoC details, adding a Report comment
    // (a new version) or deploying new code yields a fresh render.
    const versioning = await loadVersioning(report.id)
    const key = sha256(`${report.id}|${q.template}|${locale}|${poc.updatedAt.toISOString()}|${versioning?.version ?? ''}|${BUILD}`).slice(0, 32)
    const outputPath = renderPath(report.id, key)
    if (!(await exists(outputPath))) {
      const jobId = await app.enqueuePdf({ reportDataId: report.id, template: q.template, locale, outputPath })
      const deadline = Date.now() + PDF_WAIT_MS
      // The file appearing means done; a render that failed for good is reported at once (it used to
      // hold the request for the whole minute and answer 504). Its state is read every 2 s.
      for (let tick = 1; !(await exists(outputPath)); tick++) {
        if (Date.now() > deadline) throw new HttpError(504, 'render_timeout')
        if (jobId && tick % 5 === 0 && (await app.pdfFailed(jobId))) throw new HttpError(502, 'render_failed')
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

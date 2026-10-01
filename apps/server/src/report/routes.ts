import { Locale, Template } from '@poc-intel/shared'
import { access } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../auth/guards.js'
import { config } from '../config.js'
import { audit } from '../lib/audit.js'
import { sha256 } from '../lib/crypto.js'
import { HttpError, parse } from '../lib/http.js'
import { loadReportData } from '../pocs/access.js'
import { REPORT_CSP, renderReportHtml } from './render-html.js'

const Params = z.object({ id: z.uuid() })
const Query = z.object({ template: Template.default('technical'), locale: Locale.optional() })
const PDF_WAIT_MS = 60_000

const exists = (path: string) => access(path).then(() => true, () => false)

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.get('/report-data/:id/html', async (req, reply) => {
    const auth = requireAuth(req)
    const { id } = parse(Params, req.params)
    const q = parse(Query, req.query)
    const { report, poc } = await loadReportData(auth, id)
    const html = renderReportHtml(report.data, poc.details, q.template, q.locale ?? auth.user.locale)
    return reply.header('content-security-policy', REPORT_CSP).type('text/html; charset=utf-8').send(html)
  })

  app.get('/report-data/:id/pdf', async (req, reply) => {
    const auth = requireAuth(req)
    const { id } = parse(Params, req.params)
    const q = parse(Query, req.query)
    const locale = q.locale ?? auth.user.locale
    const { report, poc } = await loadReportData(auth, id)

    // Cache key covers everything the PDF depends on, so editing PoC details yields a fresh render.
    const key = sha256(`${report.id}|${q.template}|${locale}|${poc.updatedAt.toISOString()}`).slice(0, 32)
    const outputPath = join(config().DATA_DIR, 'renders', `${key}.pdf`)
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
    const filename = `StellarCyber_PoC_${q.template}_${safeName}_${report.createdAt.toISOString().slice(0, 10)}.pdf`
    return reply
      .type('application/pdf')
      .header('content-disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`)
      .send(createReadStream(outputPath))
  })
}

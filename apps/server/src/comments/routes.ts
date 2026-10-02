import { CommentInput } from '@poc-intel/shared'
import { and, asc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../auth/guards.js'
import { db } from '../db/client.js'
import { reportComments, users } from '../db/schema.js'
import { audit } from '../lib/audit.js'
import { HttpError, parse } from '../lib/http.js'
import { loadReportData } from '../pocs/access.js'

const Params = z.object({ id: z.uuid() })

/**
 * Comments on a Report: anyone who can open the Report can read and add them. An internal comment
 * stays in the app; a Report comment is a change note that becomes a new minor version of the Report
 * and is printed in its version history (Appendix B). Staff can mark an internal comment private:
 * Customer Users do not see it.
 */
export async function commentRoutes(app: FastifyInstance): Promise<void> {
  app.get('/report-data/:id/comments', async (req) => {
    const auth = requireAuth(req)
    const { report } = await loadReportData(auth, parse(Params, req.params).id, { anyVersion: true })
    return db
      .select({
        id: reportComments.id,
        body: reportComments.body,
        kind: reportComments.kind,
        private: reportComments.isPrivate,
        createdAt: reportComments.createdAt,
        author: users.name,
        authorRole: users.role,
      })
      .from(reportComments)
      .leftJoin(users, eq(users.id, reportComments.userId))
      // Customer Users never receive private comments.
      .where(and(eq(reportComments.reportDataId, report.id), auth.user.role === 'customer' ? eq(reportComments.isPrivate, false) : undefined))
      .orderBy(asc(reportComments.createdAt))
  })

  app.post('/report-data/:id/comments', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const auth = requireAuth(req)
    const { report } = await loadReportData(auth, parse(Params, req.params).id, { anyVersion: true })
    const { body, kind, private: isPrivate } = parse(CommentInput, req.body)
    if (isPrivate && auth.user.role === 'customer') throw new HttpError(403, 'forbidden')
    const [c] = await db.insert(reportComments).values({ reportDataId: report.id, userId: auth.user.id, body, kind, isPrivate }).returning({ id: reportComments.id })
    await audit({ action: 'report.commented', userId: auth.user.id, target: report.id, ip: req.ip, meta: { kind, private: isPrivate } })
    return reply.code(201).send({ id: c!.id })
  })
}

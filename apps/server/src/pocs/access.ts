import { eq } from 'drizzle-orm'
import type { AuthContext } from '../auth/session.js'
import { db } from '../db/client.js'
import { pocs, reportData, type Poc } from '../db/schema.js'
import { REPORT_DATA_VERSION } from '@poc-intel/shared'
import { HttpError, notFound } from '../lib/http.js'

/** A User reaches a PoC they own; an Admin reaches every PoC. Anything else is a 404, never a 403. */
export const canAccess = (auth: AuthContext, poc: Poc) => auth.user.role === 'admin' || poc.ownerId === auth.user.id

export async function loadPoc(auth: AuthContext, pocId: string): Promise<Poc> {
  const [poc] = await db.select().from(pocs).where(eq(pocs.id, pocId)).limit(1)
  if (!poc || !canAccess(auth, poc)) throw notFound()
  return poc
}

export async function loadReportData(auth: AuthContext, reportDataId: string) {
  const [row] = await db
    .select({ report: reportData, poc: pocs })
    .from(reportData)
    .innerJoin(pocs, eq(pocs.id, reportData.pocId))
    .where(eq(reportData.id, reportDataId))
    .limit(1)
  if (!row || !canAccess(auth, row.poc)) throw notFound()
  // Report Data from an older collector cannot feed the current Templates; a new Sync replaces it.
  if (row.report.version !== REPORT_DATA_VERSION) throw new HttpError(409, 'report_data_outdated')
  return row
}

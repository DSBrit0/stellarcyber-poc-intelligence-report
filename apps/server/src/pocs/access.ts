import { REPORT_DATA_VERSION } from '@poc-intel/shared'
import { eq } from 'drizzle-orm'
import type { AuthContext } from '../auth/session.js'
import { db } from '../db/client.js'
import { pocs, reportData, type Poc } from '../db/schema.js'
import { HttpError, notFound } from '../lib/http.js'
import { canEdit, canView } from './access-rules.js'

export { canEdit, canView }

export async function loadPoc(auth: AuthContext, pocId: string, mode: 'view' | 'edit' = 'view'): Promise<Poc> {
  const [poc] = await db.select().from(pocs).where(eq(pocs.id, pocId)).limit(1)
  if (!poc || !canView(auth, poc)) throw notFound()
  if (mode === 'edit' && !canEdit(auth, poc)) throw new HttpError(403, 'forbidden')
  return poc
}

export async function loadReportData(auth: AuthContext, reportDataId: string, opts: { anyVersion?: boolean } = {}) {
  const [row] = await db
    .select({ report: reportData, poc: pocs })
    .from(reportData)
    .innerJoin(pocs, eq(pocs.id, reportData.pocId))
    .where(eq(reportData.id, reportDataId))
    .limit(1)
  if (!row || !canView(auth, row.poc)) throw notFound()
  // Report Data from an older collector cannot feed the current Templates; a new Sync replaces it.
  if (!opts.anyVersion && row.report.version !== REPORT_DATA_VERSION) throw new HttpError(409, 'report_data_outdated')
  return row
}

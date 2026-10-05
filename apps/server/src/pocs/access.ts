import { REPORT_DATA_VERSION } from '@poc-intel/shared'
import { and, eq, sql as dsql, type SQL } from 'drizzle-orm'
import type { AuthContext } from '../auth/session.js'
import { db } from '../db/client.js'
import { customers, pocs, reportData, users, type Poc } from '../db/schema.js'
import { HttpError, notFound } from '../lib/http.js'
import { canEdit, canFillNotebook, canShapeNotebook, canView } from './access-rules.js'

export { canEdit, canFillNotebook, canShapeNotebook, canView }

/** The Sales Engineer who registered the Partner Company of this Owner, if the Owner is one of its Partners. */
export async function followerOf(ownerId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: customers.ownerId })
    .from(users)
    .innerJoin(customers, eq(customers.id, users.customerId))
    .where(and(eq(users.id, ownerId), eq(users.role, 'partner'), eq(customers.profile, 'partner')))
    .limit(1)
  return row?.id ?? null
}

/** The Report target of a PoC, or null while it is only a PoC Notebook (ADR 0010). */
export function reportTarget(poc: Poc) {
  const { instanceUrl, tenantId, periodStart, periodEnd } = poc
  return instanceUrl && tenantId && periodStart && periodEnd ? { instanceUrl, tenantId, tenantName: poc.tenantName, periodStart, periodEnd } : null
}

/** Only an SE who does not own the PoC needs the lookup. */
const followerFor = (auth: AuthContext, poc: Poc) =>
  auth.user.role === 'sales_engineer' && poc.ownerId !== auth.user.id ? followerOf(poc.ownerId) : Promise.resolve(null)

/** The PoCs an SE owns or follows, as a WHERE condition on `pocs`. */
export const ownedOrFollowedBy = (userId: string): SQL =>
  dsql`(${pocs.ownerId} = ${userId} OR ${pocs.ownerId} IN (
    SELECT u.id FROM users u JOIN customers c ON c.id = u.customer_id
    WHERE c.owner_id = ${userId} AND c.profile = 'partner' AND u.role = 'partner'))`

export async function loadPoc(auth: AuthContext, pocId: string, mode: 'view' | 'edit' = 'view'): Promise<Poc> {
  return (await loadPocAccess(auth, pocId, mode)).poc
}

/** The PoC together with the SE who follows its Owner, when the caller is that SE. */
export async function loadPocAccess(auth: AuthContext, pocId: string, mode: 'view' | 'edit' = 'view'): Promise<{ poc: Poc; followerId: string | null }> {
  const [poc] = await db.select().from(pocs).where(eq(pocs.id, pocId)).limit(1)
  if (!poc) throw notFound()
  const followerId = await followerFor(auth, poc)
  if (!canView(auth, poc, followerId)) throw notFound()
  if (mode === 'edit' && !canEdit(auth, poc)) throw new HttpError(403, 'forbidden')
  return { poc, followerId }
}

export async function loadReportData(auth: AuthContext, reportDataId: string, opts: { anyVersion?: boolean } = {}) {
  const [row] = await db
    .select({ report: reportData, poc: pocs })
    .from(reportData)
    .innerJoin(pocs, eq(pocs.id, reportData.pocId))
    .where(eq(reportData.id, reportDataId))
    .limit(1)
  if (!row || !canView(auth, row.poc, await followerFor(auth, row.poc))) throw notFound()
  // Report Data from an older collector cannot feed the current Templates; a new Sync replaces it.
  if (!opts.anyVersion && row.report.version !== REPORT_DATA_VERSION) throw new HttpError(409, 'report_data_outdated')
  return row
}

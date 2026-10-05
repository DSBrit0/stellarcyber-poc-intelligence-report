import type { PocDetails } from '@poc-intel/shared'
import { asc, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { pocCriteria } from '../db/schema.js'

/**
 * The PoC details a Report renders. With a PoC Notebook, the Success Criteria are its rows, one per
 * line, not the free-text field (ADR 0010).
 */
export async function detailsForReport(poc: { id: string; details: PocDetails; notebook: unknown }): Promise<PocDetails> {
  if (poc.notebook == null) return poc.details
  const rows = await db.select({ text: pocCriteria.text }).from(pocCriteria).where(eq(pocCriteria.pocId, poc.id)).orderBy(asc(pocCriteria.position))
  // The Report splits criteria on ";" and new lines: each row must stay one criterion.
  return { ...poc.details, successCriteria: rows.map((r) => r.text.replace(/[;\n]+/g, ',')).join('\n') }
}

import type { NotebookTemplateItem } from '../db/schema.js'
import { notFound } from '../lib/http.js'

/**
 * What a new PoC Notebook copies from the Notebook Template (ADR 0012): visible process rows, where a
 * hidden phase hides its whole section, and the visible milestones whose phase is copied (plus the
 * start day and milestones that stand for no phase).
 */
export function templateForNewNotebook(rows: NotebookTemplateItem[]): { process: NotebookTemplateItem[]; schedule: NotebookTemplateItem[] } {
  const sorted = [...rows].sort((a, b) => a.position - b.position)
  const process: NotebookTemplateItem[] = []
  let phaseHidden = false
  for (const r of sorted.filter((t) => t.section === 'process')) {
    if (r.kind === 'phase') phaseHidden = r.hidden
    if (!r.hidden && !phaseHidden) process.push(r)
  }
  const phaseKeys = new Set(process.filter((r) => r.kind === 'phase' && r.key).map((r) => r.key!))
  const schedule = sorted.filter((t) => t.section === 'schedule' && !t.hidden && (!t.key || t.key === 'start' || phaseKeys.has(t.key)))
  return { process, schedule }
}

/** The last row of the phase section that `afterId` belongs to (null: before everything). */
export function sectionEnd(rows: Pick<NotebookTemplateItem, 'id' | 'kind'>[], afterId: string | null): string | null {
  if (afterId == null) return null
  const i = rows.findIndex((r) => r.id === afterId)
  if (i < 0) throw notFound()
  let end = i
  while (rows[end + 1] && rows[end + 1]!.kind !== 'phase') end++
  return rows[end]!.id
}

/**
 * The rows of a section in their new order after moving `id` one step. A phase moves with its whole
 * section past the neighbouring section; any other row swaps with its neighbour. Null: no move.
 */
export function reorder<R extends Pick<NotebookTemplateItem, 'id' | 'kind'>>(rows: R[], id: string, direction: 'up' | 'down'): R[] | null {
  const i = rows.findIndex((r) => r.id === id)
  if (i < 0) throw notFound()
  if (rows[i]!.kind !== 'phase') {
    const j = direction === 'up' ? i - 1 : i + 1
    if (j < 0 || j >= rows.length) return null
    const next = [...rows]
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    return next
  }
  // Sections: the rows before the first phase, then one block per phase.
  const blocks: R[][] = []
  for (const r of rows) {
    if (r.kind === 'phase' || blocks.length === 0) blocks.push([])
    blocks[blocks.length - 1]!.push(r)
  }
  const b = blocks.findIndex((block) => block[0]!.id === id)
  const c = direction === 'up' ? b - 1 : b + 1
  // Never past the rows before the first phase.
  if (c < 0 || c >= blocks.length || blocks[c]![0]!.kind !== 'phase') return null
  ;[blocks[b], blocks[c]] = [blocks[c]!, blocks[b]!]
  return blocks.flat()
}

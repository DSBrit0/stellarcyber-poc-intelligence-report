/**
 * Rendered Report pages, kept in this process for a few minutes: rendering is synchronous React work in
 * the API's event loop, and the same Report is opened again and again (presentation, print, review).
 * The key holds everything the page depends on (see the HTML route), so an edit, a new comment (a new
 * version) or another Template or locale is a different entry. The page is stored with a placeholder
 * where each response puts its own CSP nonce.
 */
export const NONCE_SLOT = 'report-nonce-slot-7f3a'

const TTL_MS = 10 * 60_000
const MAX_ENTRIES = 30
const MAX_BYTES = 40 * 1024 * 1024

/** The page split around its nonce slot, so each response joins the parts instead of searching the page. */
const entries = new Map<string, { parts: string[]; size: number; at: number }>()
let bytes = 0

export function cachedReportHtml(key: string): string[] | null {
  const hit = entries.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > TTL_MS) {
    drop(key)
    return null
  }
  // Most recently used last.
  entries.delete(key)
  entries.set(key, hit)
  return hit.parts
}

export function storeReportHtml(key: string, html: string): void {
  drop(key)
  entries.set(key, { parts: html.split(NONCE_SLOT), size: html.length, at: Date.now() })
  bytes += html.length
  for (const oldest of entries.keys()) {
    if (entries.size <= MAX_ENTRIES && bytes <= MAX_BYTES) break
    drop(oldest)
  }
}

/** The page for one response, with its own nonce. */
export const withNonce = (parts: string[], nonce: string) => parts.join(nonce)

function drop(key: string) {
  const old = entries.get(key)
  if (!old) return
  bytes -= old.size
  entries.delete(key)
}

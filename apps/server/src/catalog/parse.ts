import { load, type CheerioAPI } from 'cheerio'

/**
 * Readers for the two official Stellar Cyber documentation pages behind the Data Source Catalog:
 * "Firewall Ports for Parsers" (log parsers and their ports) and "Connector Types & Functions".
 * Both are static MadCap Flare pages; the readers rely only on table classes and header names.
 */

export interface CatalogEntry {
  kind: 'parser' | 'connector'
  /** Stable identity across refreshes: the normalised name. */
  key: string
  name: string
  /** As documented, e.g. "5143 or 5870", "5200 (TCP only)". */
  port: string
  category: string
  /** Parsers: msg_origin.source. */
  source: string
  /** Parsers: log format. Connectors: the functions, e.g. "Collect, Respond". */
  detail: string
  docUrl: string
}

const clean = (s: string) =>
  s
    .replace(/ /g, ' ')
    .replace(/Click here to configure log ingestion/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * A name cell's name: its text without the text of its links, which point to the configuration guide
 * ("See how to configure … log ingestion.") and change wording from one documentation build to the next.
 * A cell whose only text is its link keeps it: there the link is the name.
 */
function nameOf(cell: ReturnType<CheerioAPI>): string {
  const withoutLinks = clean(cell.clone().find('a').remove().end().text())
  return withoutLinks || clean(cell.text())
}

/** A documentation link resolved against its page; anything but http(s) falls back to the page itself. */
function docLink(href: string | undefined, pageUrl: string): string {
  if (!href) return pageUrl
  try {
    const url = new URL(href, pageUrl)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : pageUrl
  } catch {
    return pageUrl
  }
}

export const entryKey = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** Port cells carry explanations after the number(s): keep the numbers and the "TCP only" hint. */
function portOf(cell: string): string {
  const ports = [...new Set(cell.match(/\b\d{3,5}\b/g) ?? [])]
  if (ports.length === 0) return ''
  return `${ports.join(' / ')}${/tcp only/i.test(cell) ? ' (TCP only)' : ''}`
}

function headers($: CheerioAPI, table: ReturnType<CheerioAPI>): string[] {
  return table
    .find('thead th, thead td')
    .toArray()
    .map((th) => clean($(th).text()).toLowerCase())
}

export function parseParsers(html: string, pageUrl: string): CatalogEntry[] {
  const $ = load(html)
  const out = new Map<string, CatalogEntry>()
  for (const t of $('table').toArray()) {
    const table = $(t)
    const head = headers($, table)
    const col = (name: string) => head.findIndex((h) => h.includes(name))
    const nameCol = col('parser name') >= 0 ? col('parser name') : col('standard')
    const portCol = col('port')
    if (nameCol < 0 || portCol < 0) continue
    const sourceCol = col('msg_origin.source')
    const categoryCol = col('msg_origin.category')
    const formatCol = col('log format')
    for (const tr of table.find('tbody tr').toArray()) {
      const cells = $(tr).find('td').toArray()
      const text = (i: number) => (i >= 0 && cells[i] ? clean($(cells[i]).text()) : '')
      const name = cells[nameCol] ? nameOf($(cells[nameCol])) : ''
      const port = portOf(text(portCol))
      if (!name || !port) continue
      // The name identifies a parser; the rare name listed twice with other ports keeps both rows.
      const key = out.has(entryKey(name)) ? entryKey(`${name} ${port}`) : entryKey(name)
      if (out.has(key)) continue
      const link = $(cells[nameCol]).find('a[href]').attr('href')
      out.set(key, {
        kind: 'parser',
        key,
        name,
        port,
        category: text(categoryCol).split(/[\s(,]/)[0] ?? '',
        source: text(sourceCol).split(/\s/)[0] ?? '',
        detail: text(formatCol),
        docUrl: docLink(link, pageUrl),
      })
    }
  }
  return [...out.values()]
}

export function parseConnectors(html: string, pageUrl: string): CatalogEntry[] {
  const $ = load(html)
  const out = new Map<string, CatalogEntry>()
  for (const t of $('table').toArray()) {
    const table = $(t)
    const head = headers($, table)
    const col = (name: string) => head.findIndex((h) => h.startsWith(name))
    if (col('connector') !== 0 || col('collect') < 0) continue
    const fns: [string, number][] = [
      ['Collect', col('collect')],
      ['Respond', col('respond')],
      ['Alert Integration', col('alert integration')],
    ]
    let category = ''
    for (const tr of table.find('tbody tr').toArray()) {
      const cells = $(tr).find('td').toArray()
      if (cells.length === 0) continue
      const first = $(cells[0])
      if (first.find('.tablesubhead').length > 0) {
        category = clean(first.text())
        continue
      }
      const name = nameOf(first)
      if (!name) continue
      const key = entryKey(name)
      const functions = fns.filter(([, i]) => i >= 0 && cells[i] && $(cells[i]).find('.fa-check, i[class*="check"]').length > 0).map(([f]) => f)
      const existing = out.get(key)
      // A connector listed in two categories keeps the first one.
      if (existing) continue
      const link = first.find('a[href]').attr('href')
      out.set(key, { kind: 'connector', key, name, port: '', category, source: '', detail: functions.join(', '), docUrl: docLink(link, pageUrl) })
    }
  }
  return [...out.values()]
}

export interface DocsVersion {
  /** The version segment of the URL, e.g. "7.0.xs". */
  segment: string | null
  /** Its label in the page's version list, e.g. "7.0.0s"; null when the page does not list it. */
  label: string | null
  /** The newest version the page offers (first in its list). */
  latest: { segment: string; label: string } | null
  /** The documentation root of that version, for the Notebook's links. */
  base: string | null
}

export function docsVersion(html: string, pageUrl: string): DocsVersion {
  const $ = load(html)
  const options = $('#versionlist option')
    .toArray()
    .map((o) => ({ segment: $(o).attr('value') ?? '', label: clean($(o).text()) }))
    .filter((o) => o.segment)
  const m = new URL(pageUrl).pathname.match(/^(.*?\/)(\d+\.\d+\.x[a-z]*)\//)
  const segment = m?.[2] ?? null
  return {
    segment,
    label: options.find((o) => o.segment === segment)?.label ?? null,
    latest: options[0] ?? null,
    base: m ? new URL(`${m[1]}${m[2]}`, pageUrl).href : null,
  }
}

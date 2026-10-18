import { CatalogSources, type CatalogKind } from '@poc-intel/shared'
import { and, eq, isNull, notInArray, sql as dsql } from 'drizzle-orm'
import { EnvHttpProxyAgent, fetch, type Dispatcher } from 'undici'
import { db } from '../db/client.js'
import { catalogEntries, catalogUpdates, settings } from '../db/schema.js'
import { HttpError } from '../lib/http.js'
import { appLog } from '../lib/log-sink.js'
import { docsVersion, parseConnectors, parseParsers, type CatalogEntry, type DocsVersion } from './parse.js'

/** Only the official documentation site is ever fetched: the URLs are typed by an Admin. */
const DOCS_HOST = 'docs.stellarcyber.ai'
const FETCH_TIMEOUT_MS = 30_000
// Direct in production; through the proxy when one is configured (as the CLI tools do).
const dispatcher: Dispatcher | undefined = process.env.HTTPS_PROXY || process.env.https_proxy ? new EnvHttpProxyAgent() : undefined

export interface CatalogState {
  version: { segment: string; label: string } | null
  /** The documentation build the catalog was read from; a weekly run skips an unchanged build. */
  buildTime: string | null
  lastRunAt: string | null
  lastResult: { ok: true; parsers: number; connectors: number; added: number; removed: number } | { ok: false; error: string } | null
}

/** A parser or Connector an update brings in or removes. */
export interface CatalogChange {
  kind: CatalogKind
  name: string
}

export interface CatalogPreview {
  version: DocsVersion
  buildTime: string | null
  parsers: number
  connectors: number
  added: CatalogChange[]
  removed: CatalogChange[]
  entries: CatalogEntry[]
}

export async function getCatalogSources(): Promise<CatalogSources> {
  const [row] = await db.select().from(settings).where(eq(settings.key, 'catalog_sources')).limit(1)
  return CatalogSources.parse(row?.value)
}

export async function getCatalogState(): Promise<CatalogState> {
  const [row] = await db.select().from(settings).where(eq(settings.key, 'catalog_state')).limit(1)
  return (row?.value as CatalogState | undefined) ?? { version: null, buildTime: null, lastRunAt: null, lastResult: null }
}

const putSetting = (key: string, value: unknown, userId: string | null) =>
  db
    .insert(settings)
    .values({ key, value, updatedBy: userId })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy: userId, updatedAt: dsql`now()` } })

function checkUrl(raw: string): URL {
  const url = new URL(raw)
  if (url.protocol !== 'https:' || url.hostname !== DOCS_HOST) throw new HttpError(400, 'catalog_host')
  return url
}

async function fetchText(url: URL): Promise<string> {
  let res: Awaited<ReturnType<typeof fetch>>
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: 'follow', dispatcher })
  } catch (err) {
    const cause = err instanceof Error ? ((err.cause as { code?: string } | undefined)?.code ?? err.message) : String(err)
    appLog('warn', 'catalog', 'Documentation page unreachable', { context: { url: url.href, cause } })
    throw new HttpError(502, 'catalog_unreachable')
  }
  if (!res.ok) throw new HttpError(502, 'catalog_unreachable', `HTTP ${res.status} for ${url.href}`)
  // A redirect must not leave the documentation site.
  if (new URL(res.url).hostname !== DOCS_HOST) throw new HttpError(400, 'catalog_host')
  return res.text()
}

/** MadCap's build stamp of a documentation version, e.g. "10/3/2026 3:11:02 AM"; null when unknown. */
async function buildTimeOf(base: string | null): Promise<string | null> {
  if (!base) return null
  try {
    const xml = await fetchText(new URL(`${base}/Data/HelpSystem.xml`))
    return xml.match(/BuildTime="([^"]+)"/)?.[1] ?? null
  } catch {
    return null
  }
}

/**
 * Reads both pages and checks them: same documentation version on both, a version the page lists,
 * and tables that still have rows. Nothing is written.
 */
export async function previewCatalog(sources: CatalogSources): Promise<CatalogPreview> {
  const parsersUrl = checkUrl(sources.parsersUrl)
  const connectorsUrl = checkUrl(sources.connectorsUrl)
  const [parsersHtml, connectorsHtml] = await Promise.all([fetchText(parsersUrl), fetchText(connectorsUrl)])
  const version = docsVersion(parsersHtml, parsersUrl.href)
  const other = docsVersion(connectorsHtml, connectorsUrl.href)
  if (!version.segment || !version.label) throw new HttpError(422, 'catalog_version_unknown')
  if (other.segment !== version.segment) throw new HttpError(422, 'catalog_version_mismatch')
  const entries = [...parseParsers(parsersHtml, parsersUrl.href), ...parseConnectors(connectorsHtml, connectorsUrl.href)]
  const parsers = entries.filter((e) => e.kind === 'parser').length
  const connectors = entries.length - parsers
  if (parsers === 0) throw new HttpError(422, 'catalog_no_parsers')
  if (connectors === 0) throw new HttpError(422, 'catalog_no_connectors')

  const current = await db.select({ kind: catalogEntries.kind, key: catalogEntries.key, name: catalogEntries.name }).from(catalogEntries).where(isNull(catalogEntries.removedAt))
  const id = (e: { kind: string; key: string }) => `${e.kind}|${e.key}`
  const now = new Set(entries.map(id))
  const before = new Set(current.map(id))
  return {
    version,
    buildTime: await buildTimeOf(version.base),
    parsers,
    connectors,
    added: entries.filter((e) => !before.has(id(e))).map((e) => ({ kind: e.kind, name: e.name })),
    removed: current.filter((e) => !now.has(id(e))).map((e) => ({ kind: e.kind, name: e.name })),
    entries,
  }
}

const byName = (a: CatalogChange, b: CatalogChange) => a.name.localeCompare(b.name)

/**
 * Writes a preview: upserts every entry, marks the missing ones as removed, records the update in the
 * catalog's history (what came in, what went out), and saves the sources and state.
 */
export async function applyCatalog(sources: CatalogSources, preview: CatalogPreview, userId: string | null, trigger: 'manual' | 'scheduled'): Promise<CatalogState> {
  await db.transaction(async (tx) => {
    for (const kind of ['parser', 'connector'] as const) {
      const rows = preview.entries.filter((e) => e.kind === kind)
      for (let i = 0; i < rows.length; i += 200) {
        await tx
          .insert(catalogEntries)
          .values(rows.slice(i, i + 200).map((e) => ({ kind: e.kind, key: e.key, name: e.name, port: e.port, category: e.category, source: e.source, detail: e.detail, docUrl: e.docUrl })))
          .onConflictDoUpdate({
            target: [catalogEntries.kind, catalogEntries.key],
            set: {
              name: dsql`excluded.name`,
              port: dsql`excluded.port`,
              category: dsql`excluded.category`,
              source: dsql`excluded.source`,
              detail: dsql`excluded.detail`,
              docUrl: dsql`excluded.doc_url`,
              removedAt: null,
              updatedAt: dsql`now()`,
            },
          })
      }
      await tx
        .update(catalogEntries)
        .set({ removedAt: dsql`now()` })
        .where(and(eq(catalogEntries.kind, kind), isNull(catalogEntries.removedAt), notInArray(catalogEntries.key, rows.map((e) => e.key))))
    }
    await tx.insert(catalogUpdates).values({
      trigger,
      userId,
      versionSegment: preview.version.segment,
      versionLabel: preview.version.label,
      parsers: preview.parsers,
      connectors: preview.connectors,
      added: [...preview.added].sort(byName),
      removed: [...preview.removed].sort(byName),
    })
  })
  const state: CatalogState = {
    version: { segment: preview.version.segment!, label: preview.version.label! },
    buildTime: preview.buildTime,
    lastRunAt: new Date().toISOString(),
    lastResult: { ok: true, parsers: preview.parsers, connectors: preview.connectors, added: preview.added.length, removed: preview.removed.length },
  }
  await putSetting('catalog_sources', sources, userId)
  await putSetting('catalog_state', state, userId)
  return state
}

/** The weekly run: re-reads the saved sources unless the documentation build is unchanged. */
export async function scheduledCatalogRefresh(): Promise<'skipped' | 'updated'> {
  const [sources, state] = await Promise.all([getCatalogSources(), getCatalogState()])
  try {
    const base = docsVersionBase(sources.parsersUrl)
    const build = await buildTimeOf(base)
    if (build && state.lastResult?.ok && build === state.buildTime) {
      await putSetting('catalog_state', { ...state, lastRunAt: new Date().toISOString() }, null)
      return 'skipped'
    }
    await applyCatalog(sources, await previewCatalog(sources), null, 'scheduled')
    return 'updated'
  } catch (err) {
    const error = err instanceof HttpError ? err.code : 'catalog_unreachable'
    await putSetting('catalog_state', { ...state, lastRunAt: new Date().toISOString(), lastResult: { ok: false, error } }, null)
    throw err
  }
}

function docsVersionBase(pageUrl: string): string | null {
  const url = new URL(pageUrl)
  const m = url.pathname.match(/^(.*?\/)(\d+\.\d+\.x[a-z]*)\//)
  return m ? new URL(`${m[1]}${m[2]}`, url).href : null
}

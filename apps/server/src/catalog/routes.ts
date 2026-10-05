import { CatalogSources } from '@poc-intel/shared'
import { asc, isNull, sql as dsql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { requireAuth, requireRole } from '../auth/guards.js'
import { db } from '../db/client.js'
import { catalogEntries } from '../db/schema.js'
import { audit } from '../lib/audit.js'
import { parse } from '../lib/http.js'
import { applyCatalog, getCatalogSources, getCatalogState, previewCatalog, type CatalogPreview } from './refresh.js'

const summary = ({ entries: _entries, ...p }: CatalogPreview) => p

/** Admin: where the catalog comes from, how it went last time, and "Update now" (validate, then apply). */
export async function catalogAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (req) => {
    requireRole(req, 'admin')
  })

  app.get('/catalog', async () => {
    const [sources, state, [counts]] = await Promise.all([
      getCatalogSources(),
      getCatalogState(),
      db
        .select({
          parsers: dsql<number>`count(*) FILTER (WHERE kind = 'parser' AND removed_at IS NULL)::int`,
          connectors: dsql<number>`count(*) FILTER (WHERE kind = 'connector' AND removed_at IS NULL)::int`,
          removed: dsql<number>`count(*) FILTER (WHERE removed_at IS NOT NULL)::int`,
        })
        .from(catalogEntries),
    ])
    return { sources, state, counts }
  })

  // Reads and checks the pages without writing anything: the Admin sees the version and the changes first.
  app.post('/catalog/validate', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    return summary(await previewCatalog(parse(CatalogSources, req.body)))
  })

  app.post('/catalog/apply', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req) => {
    const sources = parse(CatalogSources, req.body)
    const preview = await previewCatalog(sources)
    const state = await applyCatalog(sources, preview, req.auth!.user.id)
    await audit({ action: 'catalog.updated', userId: req.auth!.user.id, ip: req.ip, meta: { version: state.version?.segment, added: preview.added.length, removed: preview.removed.length } })
    return { state, preview: summary(preview) }
  })
}

/** The catalog for the Notebook's pickers, and the documentation root of its version for the links. */
export async function catalogRoutes(app: FastifyInstance): Promise<void> {
  app.get('/catalog', async (req) => {
    requireAuth(req)
    const [entries, state] = await Promise.all([
      db
        .select({ id: catalogEntries.id, kind: catalogEntries.kind, name: catalogEntries.name, port: catalogEntries.port, category: catalogEntries.category, detail: catalogEntries.detail, docUrl: catalogEntries.docUrl })
        .from(catalogEntries)
        .where(isNull(catalogEntries.removedAt))
        .orderBy(asc(catalogEntries.name)),
      getCatalogState(),
    ])
    return { version: state.version, entries }
  })
}

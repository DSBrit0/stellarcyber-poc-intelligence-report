import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Fragment } from 'postgres'
import { SyncStatus } from '@poc-intel/shared'
import { z } from 'zod'
import { requireRole } from '../auth/guards.js'
import { sql } from '../db/client.js'
import { notFound, parse } from '../lib/http.js'

// The Admin's Audit page: User activity (audit_log), communication with the Instances (api_calls),
// Syncs, and the application logs (app_logs). Read-only; every list is filtered and paginated in SQL.

const LEVELS = ['debug', 'info', 'warn', 'error'] as const
const EXPORT_LIMIT = 50_000

const Range = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})
const EventsQuery = Range.extend({ userId: z.uuid().optional(), action: z.string().max(60).optional(), q: z.string().max(200).optional() })
const CallsQuery = Range.extend({
  syncId: z.uuid().optional(),
  userId: z.uuid().optional(),
  outcome: z.enum(['ok', 'http_error', 'network']).optional(),
  endpoint: z.string().max(200).optional(),
  instance: z.string().max(300).optional(),
  slowMs: z.coerce.number().int().min(0).optional(),
})
const LogsQuery = Range.extend({
  level: z.enum(LEVELS).default('info'),
  source: z.enum(['api', 'worker']).optional(),
  category: z.string().max(40).optional(),
  userId: z.uuid().optional(),
  q: z.string().max(200).optional(),
})
const SyncsQuery = Range.extend({ status: SyncStatus.optional(), q: z.string().max(200).optional() })
const ExportQuery = z.object({ kind: z.enum(['events', 'api-calls', 'logs']), format: z.enum(['csv', 'json', 'txt']).default('csv') })

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

/** Joins optional conditions with AND; an empty list matches everything. */
// Entries are fragments or falsy values from `cond && sql`…``.
function where(conds: unknown[]): Fragment {
  const list = conds.filter((c): c is Fragment => Boolean(c))
  if (!list.length) return sql`true`
  return list.slice(1).reduce((acc, c) => sql`${acc} and ${c}`, list[0]!)
}

const rangeConds = (col: string, r: { from?: string; to?: string }) => [r.from && sql`${sql(col)} >= ${r.from}`, r.to && sql`${sql(col)} < ${r.to}`]

function eventsWhere(f: z.infer<typeof EventsQuery>) {
  return where([
    ...rangeConds('a.at', f),
    f.userId && sql`a.user_id = ${f.userId}`,
    f.action && (f.action.endsWith('.') ? sql`a.action like ${f.action + '%'}` : sql`a.action = ${f.action}`),
    f.q && sql`(a.target ilike ${like(f.q)} or a.ip ilike ${like(f.q)} or u.email ilike ${like(f.q)} or a.meta::text ilike ${like(f.q)})`,
  ])
}

function callsWhere(f: z.infer<typeof CallsQuery>) {
  return where([
    ...rangeConds('c.at', f),
    f.syncId && sql`c.sync_id = ${f.syncId}`,
    f.userId && sql`c.user_id = ${f.userId}`,
    f.outcome && sql`c.outcome = ${f.outcome}`,
    f.endpoint && sql`c.endpoint = ${f.endpoint}`,
    f.instance && sql`c.instance = ${f.instance}`,
    f.slowMs != null && sql`c.ms >= ${f.slowMs}`,
  ])
}

function logsWhere(f: z.infer<typeof LogsQuery>, withLevel = true) {
  const levels = LEVELS.slice(LEVELS.indexOf(f.level))
  return where([
    ...rangeConds('l.at', f),
    withLevel && sql`l.level in ${sql(levels)}`,
    f.source && sql`l.source = ${f.source}`,
    f.category && sql`l.category = ${f.category}`,
    f.userId && sql`l.user_id = ${f.userId}`,
    f.q && sql`(l.message ilike ${like(f.q)} or l.request_id = ${f.q} or l.context::text ilike ${like(f.q)})`,
  ])
}

const page = <T extends { total?: unknown }>(rows: T[]) => ({ total: Number(rows[0]?.total ?? 0), rows: rows.map(({ total: _t, ...r }) => r) })

async function queryEvents(f: z.infer<typeof EventsQuery>, limit = f.limit, offset = f.offset) {
  return sql`
    select a.id, a.at, a.action, a.target, a.ip, a.meta, a.user_id as "userId", u.email, u.name, u.role,
           count(*) over() as total
    from audit_log a left join users u on u.id = a.user_id
    where ${eventsWhere(f)}
    order by a.at desc, a.id desc limit ${limit} offset ${offset}`
}

async function queryCalls(f: z.infer<typeof CallsQuery>, limit = f.limit, offset = f.offset) {
  return sql`
    select c.id, c.at, c.sync_id as "syncId", c.user_id as "userId", u.email, c.instance, c.method, c.endpoint, c.path, c.query,
           c.status, c.outcome, c.ms, c.bytes, c.retry, c.error, count(*) over() as total
    from api_calls c left join users u on u.id = c.user_id
    where ${callsWhere(f)}
    order by c.at desc, c.id desc limit ${limit} offset ${offset}`
}

async function queryLogs(f: z.infer<typeof LogsQuery>, limit = f.limit, offset = f.offset) {
  return sql`
    select l.id, l.at, l.level, l.source, l.category, l.message, l.user_id as "userId", u.email, l.request_id as "requestId", l.context,
           count(*) over() as total
    from app_logs l left join users u on u.id = l.user_id
    where ${logsWhere(f)}
    order by l.at desc, l.id desc limit ${limit} offset ${offset}`
}

function csv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0]!)
  const cell = (v: unknown) => {
    const s = v == null ? '' : v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v)
    // A leading = + - @ would be run as a formula by spreadsheet apps.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n')
}

/** The old app's text log format: [LEVEL] time [source/category] message, then the context. */
const txtLine = (r: Record<string, unknown>) => {
  const head = `[${String(r.level ?? '').toUpperCase()}] ${new Date(r.at as string).toISOString().replace('T', ' ').slice(0, 19)} [${r.source ?? ''}/${r.category ?? ''}] ${r.message ?? ''}`
  return r.context == null ? head : `${head}\n${JSON.stringify(r.context, null, 2)}`
}

function download(reply: FastifyReply, name: string, format: 'csv' | 'json' | 'txt', rows: Record<string, unknown>[]) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  reply.header('content-disposition', `attachment; filename="${name}-${stamp}.${format}"`)
  reply.header('cache-control', 'no-store')
  if (format === 'json') return reply.type('application/json').send(JSON.stringify(rows, null, 2))
  if (format === 'txt') return reply.type('text/plain; charset=utf-8').send(rows.map(txtLine).join('\n'))
  return reply.type('text/csv; charset=utf-8').send('﻿' + csv(rows))
}

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (req) => {
    requireRole(req, 'admin')
  })

  // Headline figures for the last 24 h and 7 days, plus an hourly series for the charts.
  app.get('/summary', async () => {
    const [counts] = await sql`
      select
        (select count(*) from audit_log where action = 'auth.login' and at > now() - interval '24 hours')::int as "logins24h",
        (select count(*) from audit_log where action = 'auth.login_failed' and at > now() - interval '24 hours')::int as "failedLogins24h",
        (select count(*) from audit_log where action = 'auth.login_failed' and at > now() - interval '7 days')::int as "failedLogins7d",
        (select count(distinct user_id) from audit_log where at > now() - interval '7 days')::int as "activeUsers7d",
        (select count(*) from users where status = 'pending')::int as "pendingUsers",
        (select count(*) from syncs where created_at > now() - interval '7 days')::int as "syncs7d",
        (select count(*) from syncs where status = 'failed' and created_at > now() - interval '7 days')::int as "syncsFailed7d",
        (select count(*) from syncs where status in ('queued', 'running'))::int as "syncsRunning",
        (select coalesce(round(avg(extract(epoch from finished_at - started_at))), 0) from syncs
           where status = 'succeeded' and created_at > now() - interval '7 days')::int as "avgSyncSeconds7d",
        (select count(*) from api_calls where at > now() - interval '24 hours')::int as "apiCalls24h",
        (select count(*) from api_calls where outcome <> 'ok' and at > now() - interval '24 hours')::int as "apiErrors24h",
        (select coalesce(round(percentile_cont(0.95) within group (order by ms)), 0) from api_calls where at > now() - interval '24 hours')::int as "apiP95Ms24h",
        (select count(*) from app_logs where level = 'error' and at > now() - interval '24 hours')::int as "errors24h",
        (select count(*) from app_logs where level = 'warn' and at > now() - interval '24 hours')::int as "warnings24h"`
    const hourly = await sql`
      with h as (select generate_series(date_trunc('hour', now()) - interval '23 hours', date_trunc('hour', now()), interval '1 hour') as hour)
      select h.hour,
        (select count(*) from api_calls c where c.at >= h.hour and c.at < h.hour + interval '1 hour')::int as calls,
        (select count(*) from api_calls c where c.outcome <> 'ok' and c.at >= h.hour and c.at < h.hour + interval '1 hour')::int as "callErrors",
        (select count(*) from app_logs l where l.level = 'error' and l.at >= h.hour and l.at < h.hour + interval '1 hour')::int as errors,
        (select count(*) from app_logs l where l.level = 'warn' and l.at >= h.hour and l.at < h.hour + interval '1 hour')::int as warnings,
        (select count(*) from audit_log a where a.at >= h.hour and a.at < h.hour + interval '1 hour')::int as events
      from h order by h.hour`
    const recentFailures = await sql`
      select a.at, a.ip, a.meta, u.email from audit_log a left join users u on u.id = a.user_id
      where a.action = 'auth.login_failed' order by a.at desc limit 5`
    const recentErrors = await sql`
      select id, at, source, category, message from app_logs where level = 'error' order by at desc limit 5`
    const topUsers = await sql`
      select u.id, u.email, u.name, u.role, count(*)::int as events, max(a.at) as "lastAt"
      from audit_log a join users u on u.id = a.user_id
      where a.at > now() - interval '7 days' group by u.id order by events desc limit 8`
    return { counts, hourly, recentFailures, recentErrors, topUsers }
  })

  app.get('/events', async (req) => page(await queryEvents(parse(EventsQuery, req.query))))

  app.get('/actions', async () => (await sql`select distinct action from audit_log order by action`).map((r) => r.action as string))

  app.get('/syncs', async (req) => {
    const f = parse(SyncsQuery, req.query)
    const rows = await sql`
      select s.id, s.status, s.error, s.created_at as "createdAt", s.started_at as "startedAt", s.finished_at as "finishedAt",
             s.report_data_id as "reportDataId", s.metrics->'totalMs' as "totalMs", s.metrics->'counts' as counts,
             p.id as "pocId", p.tenant_name as "tenantName", p.instance_url as "instanceUrl", p.details->>'company' as company,
             u.email,
             (select count(*) from api_calls c where c.sync_id = s.id)::int as calls,
             (select count(*) from api_calls c where c.sync_id = s.id and c.outcome <> 'ok')::int as "callErrors",
             count(*) over() as total
      from syncs s left join pocs p on p.id = s.poc_id left join users u on u.id = s.requested_by
      where ${where([
        ...rangeConds('s.created_at', f),
        f.status && sql`s.status = ${f.status}`,
        f.q && sql`(p.tenant_name ilike ${like(f.q)} or p.instance_url ilike ${like(f.q)} or p.details->>'company' ilike ${like(f.q)} or u.email ilike ${like(f.q)})`,
      ])}
      order by s.created_at desc limit ${f.limit} offset ${f.offset}`
    return page(rows)
  })

  // One Sync: its metrics, the per-endpoint breakdown measured from the recorded calls, and its logs.
  app.get('/syncs/:id', async (req) => {
    const { id } = parse(z.object({ id: z.uuid() }), req.params)
    const [sync] = await sql`
      select s.*, p.tenant_name as "tenantName", p.instance_url as "instanceUrl", p.period_start as "periodStart", p.period_end as "periodEnd",
             p.details->>'company' as company, u.email
      from syncs s left join pocs p on p.id = s.poc_id left join users u on u.id = s.requested_by where s.id = ${id}`
    if (!sync) throw notFound()
    const endpoints = await sql`
      select endpoint, method, count(*)::int as requests,
             count(*) filter (where outcome <> 'ok')::int as errors, count(*) filter (where retry)::int as retries,
             round(percentile_cont(0.5) within group (order by ms))::int as p50, round(percentile_cont(0.95) within group (order by ms))::int as p95,
             max(ms)::int as max, sum(bytes)::bigint as bytes
      from api_calls where sync_id = ${id} group by endpoint, method order by requests desc`
    const statuses = await sql`
      select endpoint, coalesce(status::text, 'network') as status, count(*)::int as n from api_calls where sync_id = ${id} group by 1, 2`
    const byEndpoint = new Map<string, Record<string, number>>()
    for (const s of statuses) byEndpoint.set(s.endpoint, { ...byEndpoint.get(s.endpoint), [s.status]: s.n })
    const logs = await sql`
      select id, at, level, category, message, context from app_logs where context->>'syncId' = ${id} order by at`
    return { sync, endpoints: endpoints.map((e) => ({ ...e, bytes: Number(e.bytes), statuses: byEndpoint.get(e.endpoint) ?? {} })), logs }
  })

  app.get('/api-calls', async (req) => page(await queryCalls(parse(CallsQuery, req.query))))

  // Aggregates per Instance and endpoint over the chosen range (24 h by default).
  app.get('/api-stats', async (req) => {
    const f = parse(Range, req.query)
    const range = where([f.from ? sql`at >= ${f.from}` : sql`at > now() - interval '24 hours'`, f.to && sql`at < ${f.to}`])
    const instances = await sql`
      select instance, count(*)::int as requests, count(*) filter (where outcome <> 'ok')::int as errors,
             round(percentile_cont(0.95) within group (order by ms))::int as p95, sum(bytes)::bigint as bytes, max(at) as "lastAt"
      from api_calls where ${range} group by instance order by requests desc`
    const endpoints = await sql`
      select endpoint, count(*)::int as requests, count(*) filter (where outcome <> 'ok')::int as errors,
             count(*) filter (where retry)::int as retries,
             round(percentile_cont(0.5) within group (order by ms))::int as p50, round(percentile_cont(0.95) within group (order by ms))::int as p95,
             max(ms)::int as max, sum(bytes)::bigint as bytes
      from api_calls where ${range} group by endpoint order by requests desc limit 50`
    const statuses = await sql`
      select coalesce(status::text, 'network') as status, count(*)::int as n from api_calls where ${range} group by 1 order by n desc`
    return {
      instances: instances.map((r) => ({ ...r, bytes: Number(r.bytes) })),
      endpoints: endpoints.map((r) => ({ ...r, bytes: Number(r.bytes) })),
      statuses,
    }
  })

  app.get('/logs', async (req) => {
    const f = parse(LogsQuery, req.query)
    const rows = await queryLogs(f)
    // Counts per level ignore the level filter, so the chips show what each one would reveal.
    const levels = await sql`select l.level, count(*)::int as n from app_logs l where ${logsWhere(f, false)} group by l.level`
    const categories = await sql`select distinct category from app_logs where at > now() - interval '30 days' order by category`
    return { ...page(rows), levels: Object.fromEntries(levels.map((l) => [l.level, l.n])), categories: categories.map((c) => c.category as string) }
  })

  app.get('/export', async (req, reply) => {
    const { kind, format } = parse(ExportQuery, req.query)
    const rows =
      kind === 'events'
        ? await queryEvents(parse(EventsQuery, req.query), EXPORT_LIMIT, 0)
        : kind === 'api-calls'
          ? await queryCalls(parse(CallsQuery, req.query), EXPORT_LIMIT, 0)
          : await queryLogs(parse(LogsQuery, req.query), EXPORT_LIMIT, 0)
    return download(reply, `audit-${kind}`, format, page(rows).rows as Record<string, unknown>[])
  })
}

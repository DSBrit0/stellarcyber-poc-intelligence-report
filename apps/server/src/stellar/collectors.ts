import type { ReportData } from '@poc-intel/shared'
import { licenseCompliance } from '../metrics/license-compliance.js'
import { StellarApiError, type StellarClient } from './client.js'
import { ENDPOINTS, PAGING } from './endpoints.js'
import { CasesResponse, ConnectorsResponse, DataSensorsResponse, EntityUsageResponse, StorageUsagesResponse, type DataSensor } from './schemas.js'

/** What every collector needs: one Instance, one Tenant, one period (UTC epoch ms bounds). */
export interface CollectContext {
  client: StellarClient
  tenantId: string
  period: { start: string; end: string }
}

const dayStart = (d: string) => Date.parse(`${d}T00:00:00.000Z`)
const dayEnd = (d: string) => Date.parse(`${d}T23:59:59.999Z`)
const inPeriod = (date: string, p: CollectContext['period']) => date >= p.start && date <= p.end

/** The API sends timestamps as epoch ms or ISO strings. */
function toEpochMs(v: number | string | null | undefined): number | null {
  if (typeof v === 'number') return v > 0 ? v : null
  if (typeof v === 'string' && v) {
    const ms = Date.parse(v)
    return Number.isNaN(ms) ? null : ms
  }
  return null
}

const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const

/** Case totals per Severity: one limit=1 call each, `total` carries the count. */
export async function collectCaseCounts(ctx: CollectContext): Promise<ReportData['cases']> {
  const totals = await Promise.all(
    SEVERITIES.map((severity) =>
      ctx.client
        .get(
          ENDPOINTS.cases,
          {
            tenantid: ctx.tenantId,
            severity,
            'FROM~created_at': dayStart(ctx.period.start),
            'TO~created_at': dayEnd(ctx.period.end),
            limit: 1,
            skip: 0,
          },
          CasesResponse,
          90_000,
        )
        .then((r) => r.data.total),
    ),
  )
  const [critical = 0, high = 0, medium = 0, low = 0] = totals
  return { total: critical + high + medium + low, bySeverity: { critical, high, medium, low } }
}

/**
 * Pages every Case created in [from, to]. Splits the window in halves while it holds more than
 * PAGING.casesSafeSkip Cases (deep skips fail on some tenants). Newest window first.
 */
export async function casesInRange(
  ctx: CollectContext,
  params: Record<string, string>,
  from: number,
  to: number,
  cap = Infinity,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  const page = (a: number, b: number, from: { skip: number } | { cursor: string }) =>
    ctx.client
      .get(
        ENDPOINTS.cases,
        { tenantid: ctx.tenantId, ...params, 'FROM~created_at': a, 'TO~created_at': b, limit: PAGING.casesPage, ...from },
        CasesResponse,
        90_000,
      )
      .then((r) => r.data)

  async function walk(a: number, b: number): Promise<void> {
    if (out.length >= cap) return
    const first = await page(a, b, { skip: 0 })
    // Instances that return a cursor page by cursor, with no deep skips and no window splitting.
    if (typeof first.has_more === 'boolean') {
      out.push(...first.cases)
      for (let cur = first; cur.has_more && cur.cursor && out.length < cap; ) {
        cur = await page(a, b, { cursor: cur.cursor })
        if (cur.cases.length === 0) break
        out.push(...cur.cases)
      }
      return
    }
    if (first.total > PAGING.casesSafeSkip && b - a > 60_000) {
      const mid = Math.floor((a + b) / 2)
      await walk(mid + 1, b)
      await walk(a, mid)
      return
    }
    out.push(...first.cases)
    // Advance by what the page returned: an Instance may cap `limit` below PAGING.casesPage.
    for (let skip = first.cases.length; skip < first.total && out.length < cap; ) {
      const next = await page(a, b, { skip })
      if (next.cases.length === 0) break
      out.push(...next.cases)
      skip += next.cases.length
    }
  }
  await walk(from, to)
  const seen = new Set<unknown>()
  return out.filter((c) => {
    const id = c._id ?? c.id
    if (seen.has(id)) return false
    seen.add(id)
    return true
  }).slice(0, cap)
}

export async function collectAssets(ctx: CollectContext): Promise<ReportData['assets']> {
  const res = await ctx.client.get(ENDPOINTS.entityUsageDaily, { days: 31, cust_id: ctx.tenantId }, EntityUsageResponse)
  const daily = res.data
    .map((d) => ({ date: d.date.slice(0, 10), value: d.entity_count }))
    .filter((d) => inPeriod(d.date, ctx.period))
    .sort((a, b) => a.date.localeCompare(b.date))
  return { daily, compliance: licenseCompliance(daily, { integer: true }) }
}

/**
 * Licensing Volume per day. aggr_type=tenant_index returns the same daily total_usage as aggr_type=tenant,
 * with usages[] split per index (Syslog, Windows Events, Traffic…) instead of one row for the Tenant.
 */
export async function collectVolume(ctx: CollectContext): Promise<ReportData['volume']> {
  // An Instance that rejects tenant_index still gets the daily totals, without the split.
  const res = await ctx.client
    .get(ENDPOINTS.storageUsages, { aggr_type: 'tenant_index', cust_id: ctx.tenantId }, StorageUsagesResponse)
    .catch((err: unknown) => {
      if (err instanceof StellarApiError && err.code !== 'auth_failed' && err.code !== 'network') {
        return ctx.client.get(ENDPOINTS.storageUsages, { aggr_type: 'tenant', cust_id: ctx.tenantId }, StorageUsagesResponse)
      }
      throw err
    })
  const today = new Date().toISOString().slice(0, 10)
  const days = res.data
    .map((d) => ({ date: (typeof d.time === 'number' ? new Date(d.time).toISOString() : d.time).slice(0, 10), row: d }))
    .filter((d) => d.date < today && inPeriod(d.date, ctx.period))
    .sort((a, b) => a.date.localeCompare(b.date))
  const dailyGb = days.map(({ date, row }) => ({ date, value: row.total_usage ?? row.usages.reduce((sum, u) => sum + u.usage, 0) }))
  const perIndex = new Map<string, number>()
  for (const { row } of days) for (const u of row.usages) if (u.index) perIndex.set(u.index, (perIndex.get(u.index) ?? 0) + u.usage)
  const indexTotal = [...perIndex.values()].reduce((sum, v) => sum + v, 0)
  const byIndex = [...perIndex]
    .map(([index, gb]) => ({ index, gb, share: indexTotal > 0 ? gb / indexTotal : 0 }))
    .sort((a, b) => b.gb - a.gb)
  return { dailyGb, compliance: licenseCompliance(dailyGb, { integer: false }), byIndex }
}

export async function collectConnectors(ctx: CollectContext): Promise<ReportData['connectors']> {
  const list = await ctx.client.get(ENDPOINTS.connectors, { cust_id: ctx.tenantId }, ConnectorsResponse)
  return list.map((c, i) => ({
    id: c._id ?? c.id ?? `connector-${i}`,
    name: c.name || `Connector ${i + 1}`,
    type: c.type ?? c.category ?? 'unknown',
    category: c.category ?? '',
    active: c.active,
    lastActivity: toEpochMs(c.last_activity),
    lastDataReceived: toEpochMs(c.last_data_received),
    healthCode: c.status?.code ?? null,
    healthMessage: c.status?.message ?? '',
    ...(c.is_collect != null ? { collect: c.is_collect } : {}),
    ...(c.is_respond != null ? { respond: c.is_respond } : {}),
  }))
}

const DEVICE_LABELS: Record<string, string> = {
  ds: 'Data Sensor',
  sds: 'Security Data Sensor',
  wds: 'Windows Data Sensor',
  dds: 'Deception Data Sensor',
}

function sensorKind(s: DataSensor): string {
  if (s.feature === 'modular') return 'Modular Sensor'
  if (s.mode === 'device') return DEVICE_LABELS[s.feature ?? ''] ?? 'Data Sensor'
  return (s.os ?? '').toLowerCase().includes('windows') ? 'Windows Server Sensor' : 'Linux Server Sensor'
}

export async function collectDataSensors(ctx: CollectContext): Promise<ReportData['dataSensors']> {
  const list = await ctx.client.get(ENDPOINTS.dataSensors, { cust_id: ctx.tenantId }, DataSensorsResponse)
  return list.map((s, i) => ({
    id: s.sensor_id ?? s.internal_sensor_id ?? `sensor-${i}`,
    name: s.hostname || `Sensor ${i + 1}`,
    kind: sensorKind(s),
    version: s.sw_version.match(/\d+\.\d+\.\d+/)?.[0] ?? s.sw_version,
    status: s.connection_status,
    online: s.connection_status === 'connected',
    message: s.message ?? '',
    ...(s.need_upgrade != null ? { needUpgrade: s.need_upgrade } : {}),
    lastSeen: toEpochMs(s.last_stats_time),
    cpuPct: s.cpu_usage ?? null,
    diskPct: s.disk_usage ?? null,
    ...(s.local_ip_address ? { localIp: s.local_ip_address } : {}),
    ...(s.nat_ip_address ? { natIp: s.nat_ip_address } : {}),
    ...(s.sensor_profile_name ? { profile: s.sensor_profile_name } : {}),
  }))
}

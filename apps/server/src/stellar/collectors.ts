import type { ReportData } from '@poc-intel/shared'
import { licenseCompliance } from '../metrics/license-compliance.js'
import type { StellarClient } from './client.js'
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
  const page = (a: number, b: number, skip: number) =>
    ctx.client
      .get(
        ENDPOINTS.cases,
        { tenantid: ctx.tenantId, ...params, 'FROM~created_at': a, 'TO~created_at': b, limit: PAGING.casesPage, skip },
        CasesResponse,
        90_000,
      )
      .then((r) => r.data)

  async function walk(a: number, b: number): Promise<void> {
    if (out.length >= cap) return
    const first = await page(a, b, 0)
    if (first.total > PAGING.casesSafeSkip && b - a > 60_000) {
      const mid = Math.floor((a + b) / 2)
      await walk(mid + 1, b)
      await walk(a, mid)
      return
    }
    out.push(...first.cases)
    for (let skip = first.cases.length; skip < first.total && out.length < cap; skip += PAGING.casesPage) {
      const next = await page(a, b, skip)
      if (next.cases.length === 0) break
      out.push(...next.cases)
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

export async function collectVolume(ctx: CollectContext): Promise<ReportData['volume']> {
  const res = await ctx.client.get(ENDPOINTS.storageUsages, { aggr_type: 'tenant', cust_id: ctx.tenantId }, StorageUsagesResponse)
  const today = new Date().toISOString().slice(0, 10)
  const dailyGb = res.data
    .map((d) => ({
      date: (typeof d.time === 'number' ? new Date(d.time).toISOString() : d.time).slice(0, 10),
      value: d.usages.reduce((sum, u) => sum + u.usage, 0),
    }))
    .filter((d) => d.date < today && inPeriod(d.date, ctx.period))
    .sort((a, b) => a.date.localeCompare(b.date))
  return { dailyGb, compliance: licenseCompliance(dailyGb, { integer: false }) }
}

export async function collectConnectors(ctx: CollectContext): Promise<ReportData['connectors']> {
  const list = await ctx.client.get(ENDPOINTS.connectors, { cust_id: ctx.tenantId }, ConnectorsResponse)
  return list.map((c, i) => ({
    id: c._id ?? c.id ?? `connector-${i}`,
    name: c.name || `Connector ${i + 1}`,
    type: c.type ?? c.category ?? 'unknown',
    active: c.active,
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
    online: s.connection_status === 'connected',
  }))
}

import { z } from 'zod'

// Lenient on purpose: only the fields the Sync uses are declared; unknown fields are dropped.
const num = z.coerce.number().catch(0)

export const TenantsResponse = z.object({
  data: z.array(
    z.object({ cust_id: z.string(), cust_name: z.string().nullish(), tgrp_name: z.string().nullish() }),
  ),
})

export const CasesResponse = z.object({
  data: z.object({
    total: num,
    cases: z.array(z.record(z.string(), z.unknown())).default([]),
    /** Cursor pagination (documented in 7.0; not every Instance returns it yet). */
    cursor: z.string().nullish(),
    has_more: z.boolean().nullish(),
  }),
})

export const EntityUsageResponse = z.object({
  data: z.array(z.object({ date: z.string(), entity_count: num })).default([]),
})

export const StorageUsagesResponse = z.object({
  data: z
    .array(
      z.object({
        time: z.union([z.string(), z.number()]),
        total_usage: z.number().nullish(),
        /** One row per index with aggr_type=tenant_index (`index`), per Tenant with aggr_type=tenant. */
        usages: z.array(z.object({ usage: num, index: z.string().nullish().catch(null) })).default([]),
      }),
    )
    .default([]),
})

const Connector = z.object({
  _id: z.string().optional(),
  id: z.string().optional(),
  name: z.string().default(''),
  type: z.string().optional(),
  category: z.string().optional(),
  active: z.boolean().default(true),
  last_activity: z.union([z.number(), z.string()]).nullish(),
  last_data_received: z.union([z.number(), z.string()]).nullish(),
  status: z.object({ code: z.number().nullish(), message: z.string().nullish() }).nullish().catch(null),
  /** Collector (sends data) and/or Responder (receives actions: webhooks, JIRA…). */
  is_collect: z.boolean().nullish().catch(null),
  is_respond: z.boolean().nullish().catch(null),
})
export const ConnectorsResponse = z.union([
  z.object({ connectors: z.array(Connector) }).transform((r) => r.connectors),
  z.object({ data: z.array(Connector) }).transform((r) => r.data),
  z.array(Connector),
])

const DataSensor = z.object({
  sensor_id: z.string().optional(),
  internal_sensor_id: z.string().optional(),
  hostname: z.string().default(''),
  feature: z.string().optional(),
  mode: z.string().optional(),
  os: z.string().optional(),
  sw_version: z.string().default(''),
  connection_status: z.string().default(''),
  /** Why the sensor is unhealthy, e.g. "Disconnected, No activity in 16 days…"; empty when healthy. */
  message: z.string().nullish().catch(null),
  need_upgrade: z.boolean().nullish().catch(null),
  last_stats_time: z.union([z.number(), z.string()]).nullish().catch(null),
  cpu_usage: z.number().nullish().catch(null),
  disk_usage: z.number().nullish().catch(null),
  local_ip_address: z.string().nullish().catch(null),
  nat_ip_address: z.string().nullish().catch(null),
  sensor_profile_name: z.string().nullish().catch(null),
})
export type DataSensor = z.infer<typeof DataSensor>
export const DataSensorsResponse = z.union([
  z.object({ sensors: z.array(DataSensor) }).transform((r) => r.sensors),
  z.object({ data: z.array(DataSensor) }).transform((r) => r.data),
  z.array(DataSensor),
])

export const CaseAlertsResponse = z.object({
  data: z.object({
    docs: z.array(z.object({ found: z.boolean().optional(), _source: z.record(z.string(), z.unknown()).optional() })).default([]),
  }),
})

const IngestionRow = z.record(z.string(), z.unknown())
export const IngestionResponse = z.union([
  z.object({ data: z.array(IngestionRow) }).transform((r) => r.data),
  z.array(IngestionRow),
])

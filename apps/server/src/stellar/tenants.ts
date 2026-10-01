import type { StellarClient } from './client.js'
import { ENDPOINTS } from './endpoints.js'
import { TenantsResponse } from './schemas.js'

export interface TenantSummary {
  id: string
  name: string
  group: string
}

export async function listTenants(client: StellarClient): Promise<TenantSummary[]> {
  const res = await client.get(ENDPOINTS.tenants, { fields: 'cust_id,cust_name,tgrp_name' }, TenantsResponse)
  return res.data
    .map((t) => ({ id: t.cust_id, name: t.cust_name || t.cust_id, group: t.tgrp_name ?? '' }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

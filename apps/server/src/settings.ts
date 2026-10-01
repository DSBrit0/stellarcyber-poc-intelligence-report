import { DEFAULT_RETENTION_DAYS } from '@poc-intel/shared'
import { sql as drizzleSql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from './db/client.js'
import { settings } from './db/schema.js'

export const AppSettings = z.object({
  retentionDays: z.number().int().min(1).max(3650),
  registrationAllowedDomains: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/)).max(100),
})
export type AppSettings = z.infer<typeof AppSettings>

const KEYS = { retentionDays: 'retention_days', registrationAllowedDomains: 'registration_allowed_domains' } as const

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.select().from(settings)
  const byKey = new Map(rows.map((r) => [r.key, r.value]))
  return AppSettings.parse({
    retentionDays: byKey.get(KEYS.retentionDays) ?? DEFAULT_RETENTION_DAYS,
    registrationAllowedDomains: byKey.get(KEYS.registrationAllowedDomains) ?? [],
  })
}

export async function updateSettings(patch: Partial<AppSettings>, userId: string): Promise<AppSettings> {
  for (const [field, value] of Object.entries(patch) as [keyof AppSettings, unknown][]) {
    if (value === undefined) continue
    await db
      .insert(settings)
      .values({ key: KEYS[field], value, updatedBy: userId })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy: userId, updatedAt: drizzleSql`now()` } })
  }
  return getSettings()
}

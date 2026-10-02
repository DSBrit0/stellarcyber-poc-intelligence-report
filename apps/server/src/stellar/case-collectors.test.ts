import type { CaseSummary } from '@poc-intel/shared'
import { describe, expect, it } from 'vitest'
import { countAlertsInPeriod } from './case-collectors.js'
import type { StellarClient } from './client.js'
import type { CollectContext } from './collectors.js'

const FROM = Date.parse('2026-09-01T00:00:00Z')
const TO = Date.parse('2026-09-30T23:59:59.999Z')
const SEPT = Date.parse('2026-09-30T22:00:00Z')
const OCT = Date.parse('2026-10-02T10:00:00Z')

/** Fake /cases/{id}/alerts: alert times per Case, served 50 per page. */
function fakeClient(alertTimes: Record<string, (number | null)[]>, failing = new Set<string>()) {
  const paths: string[] = []
  const client = {
    get: async (path: string, query: { skip: number; limit: number }, schema: { parse: (v: unknown) => unknown }) => {
      paths.push(path)
      const id = decodeURIComponent(path.split('/').at(-2)!)
      if (failing.has(id)) throw new Error('page failed')
      const docs = (alertTimes[id] ?? []).slice(query.skip, query.skip + query.limit).map((t) => ({ _source: t == null ? {} : { receive_time: t, timestamp: t - 30 * 86_400_000 } }))
      return schema.parse({ data: { docs } })
    },
  } as unknown as StellarClient
  return { paths, ctx: { client, tenantId: 't', period: { start: '2026-09-01', end: '2026-09-30' } } satisfies CollectContext }
}

const kase = (id: string, alerts: number, startedAt: number, endedAt: number): CaseSummary => ({
  id, name: id, severity: 'medium', status: 'New', resolution: '', score: null, alerts, createdAt: startedAt, startedAt, endedAt, acknowledgedAt: null, closedAt: null,
})

describe('countAlertsInPeriod', () => {
  it('counts only the Alerts dated inside the period, for Cases that cross it', async () => {
    const open = kase('open', 60, SEPT, OCT) // 55 in September, 5 in October
    const inside = kase('inside', 7, SEPT, SEPT)
    const { paths, ctx } = fakeClient({ open: [...Array(55).fill(SEPT), ...Array(5).fill(OCT)] })
    const r = await countAlertsInPeriod(ctx, [open, inside], FROM, TO)
    expect(open.alerts).toBe(55)
    expect(open.alertsAll).toBe(60)
    expect(inside.alerts).toBe(7)
    expect(inside.alertsAll).toBeUndefined()
    expect(r).toEqual({ outside: 5, unverified: 0 })
    // Only the crossing Case is paged: 60 Alerts = 2 pages.
    expect(paths.length).toBe(2)
  })

  it('keeps Alerts without a time and the full size when a page fails', async () => {
    const noTime = kase('noTime', 3, SEPT, OCT)
    const broken = kase('broken', 10, SEPT, OCT)
    const { ctx } = fakeClient({ noTime: [OCT, null, SEPT] }, new Set(['broken']))
    const r = await countAlertsInPeriod(ctx, [noTime, broken], FROM, TO)
    expect(noTime.alerts).toBe(2)
    expect(broken.alerts).toBe(10)
    expect(r).toEqual({ outside: 1, unverified: 1 })
  })
})

import type { CaseSummary } from '@poc-intel/shared'
import { describe, expect, it } from 'vitest'
import { alertInPeriod, collectAiTriage, countAlertsInPeriod } from './case-collectors.js'
import { StellarApiError, type StellarClient } from './client.js'
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
      const docs = (alertTimes[id] ?? []).slice(query.skip, query.skip + query.limit).map((t) => ({ _source: t == null ? {} : { receive_time: t, timestamp: t - 60_000 } }))
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

describe('alertInPeriod', () => {
  it('is in the period when any of its times falls inside', () => {
    // Replayed demo data: received "in 2023", written and dated inside the period.
    expect(alertInPeriod({ receive_time: Date.parse('2023-07-13T00:00:00Z'), write_time: SEPT, timestamp: SEPT }, FROM, TO)).toBe(true)
    // CylancePROTECT: the source's event time is weeks before Stellar Cyber received it.
    expect(alertInPeriod({ receive_time: SEPT, timestamp: Date.parse('2026-08-01T00:00:00Z') }, FROM, TO)).toBe(true)
  })
  it('is outside when every time is outside, and unknown without a time', () => {
    expect(alertInPeriod({ receive_time: OCT, write_time: OCT, timestamp: OCT }, FROM, TO)).toBe(false)
    expect(alertInPeriod({ receive_time: 'x' }, FROM, TO)).toBeNull()
  })
})

describe('collectAiTriage', () => {
  const ctxWith = (post: (body: { case_ids: string[] }) => unknown) => {
    const batches: number[] = []
    const client = {
      post: async (_path: string, body: { case_ids: string[] }, schema: { parse: (v: unknown) => unknown }) => {
        batches.push(body.case_ids.length)
        return schema.parse(post(body))
      },
    } as unknown as StellarClient
    return { batches, ctx: { client, tenantId: 't', period: { start: '2026-09-01', end: '2026-09-30' } } satisfies CollectContext }
  }
  const many = (n: number) => Array.from({ length: n }, (_, i) => ({ ...kase(`c${i}`, 1, SEPT, SEPT), severity: i % 2 ? ('high' as const) : ('low' as const) }))

  it('asks for every Case in batches of 500 and counts verdicts per Severity', async () => {
    const { batches, ctx } = ctxWith(({ case_ids }) =>
      Object.fromEntries(case_ids.map((id) => [id, id === 'c1' ? { verdict: 'True Positive' } : id === 'c2' ? { verdict: 'False Positive' } : null])),
    )
    const r = await collectAiTriage(ctx, many(1_200))
    expect(batches).toEqual([500, 500, 200])
    expect(r).toMatchObject({ available: true, status: 'ok', requested: 1_200, verdicts: { c1: 'True Positive', c2: 'False Positive' } })
    expect(r.bySeverity).toEqual({ critical: {}, high: { 'True Positive': 1 }, medium: {}, low: { 'False Positive': 1 } })
  })
  it('reports not_exposed on 404/403 and no_cases without Cases', async () => {
    const { ctx } = ctxWith(() => {
      throw new StellarApiError('not_found', 'nope', 404)
    })
    expect(await collectAiTriage(ctx, many(3))).toEqual({ available: false, status: 'not_exposed', verdicts: {} })
    expect(await collectAiTriage(ctx, [])).toEqual({ available: false, status: 'no_cases', verdicts: {} })
  })
  it('rejects on any other failure, so the caller records a gap', async () => {
    const { ctx } = ctxWith(() => {
      throw new StellarApiError('unavailable', 'HTTP 500', 500)
    })
    await expect(collectAiTriage(ctx, many(3))).rejects.toBeInstanceOf(StellarApiError)
  })
})

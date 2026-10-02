import { describe, expect, it } from 'vitest'
import type { StellarClient } from './client.js'
import { casesInRange, type CollectContext } from './collectors.js'

/** Fake /cases endpoint: `pages` are returned in order; every call's query is recorded. */
function fakeClient(pages: object[]) {
  const calls: Record<string, unknown>[] = []
  const client = {
    get: async (_path: string, query: Record<string, unknown>, schema: { parse: (v: unknown) => unknown }) => {
      calls.push(query)
      return schema.parse({ data: pages[calls.length - 1] })
    },
  } as unknown as StellarClient
  return { calls, ctx: { client, tenantId: 't', period: { start: '2026-09-01', end: '2026-09-30' } } satisfies CollectContext }
}

const c = (id: string) => ({ _id: id })

describe('casesInRange', () => {
  it('follows the cursor when the Instance returns one', async () => {
    const { calls, ctx } = fakeClient([
      { total: 3, cases: [c('a')], cursor: 'k1', has_more: true },
      { total: 3, cases: [c('b')], cursor: 'k2', has_more: true },
      { total: 3, cases: [c('c')], cursor: null, has_more: false },
    ])
    const out = await casesInRange(ctx, {}, 0, 1_000_000)
    expect(out.map((x) => x._id)).toEqual(['a', 'b', 'c'])
    expect(calls.map((q) => q.cursor ?? `skip=${q.skip}`)).toEqual(['skip=0', 'k1', 'k2'])
  })

  it('pages by skip on Instances without cursor', async () => {
    const { calls, ctx } = fakeClient([
      { total: 2, cases: [c('a')] },
      { total: 2, cases: [c('b')] },
    ])
    const out = await casesInRange(ctx, {}, 0, 1_000_000)
    expect(out.map((x) => x._id)).toEqual(['a', 'b'])
    expect(calls.map((q) => q.skip)).toEqual([0, 1])
  })
})

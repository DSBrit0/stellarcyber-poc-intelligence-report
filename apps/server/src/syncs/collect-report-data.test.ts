import { describe, expect, it } from 'vitest'
import { StellarApiError, type StellarClient } from '../stellar/client.js'
import { collectReportData } from './collect-report-data.js'

class Cancelled extends Error {}

/** Every call hangs until the signal aborts, then rejects with its reason (as StellarClient does). */
function hangingClient(signal: AbortSignal) {
  return {
    get: () => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
    post: () => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
  } as unknown as StellarClient
}

describe('collectReportData cancellation', () => {
  it('rejects with the cancel reason instead of turning aborted collectors into gaps', async () => {
    const abort = new AbortController()
    const failed: string[] = []
    const run = collectReportData(
      hangingClient(abort.signal),
      { instanceUrl: 'https://x', tenant: { id: 't', name: 'T' }, period: { start: '2026-09-01', end: '2026-09-07' } },
      { log: { warn: () => {} }, onProgress: () => {}, onCollectorFailed: (name) => failed.push(name), signal: abort.signal },
    )
    setTimeout(() => abort.abort(new Cancelled()), 20)
    await expect(run).rejects.toBeInstanceOf(Cancelled)
    expect(failed).toEqual([])
  })
})

describe('collectReportData Auto Triage status', () => {
  /** /cases answers `cases` (or fails) and /connectors an empty list; every other endpoint fails. */
  function client(cases: object[] | null) {
    const posts: unknown[] = []
    const fail = () => Promise.reject(new StellarApiError('unavailable', 'HTTP 500', 500))
    const c = {
      get: (path: string, _q: unknown, schema: { parse: (v: unknown) => unknown }) =>
        path.endsWith('/cases') && cases
          ? Promise.resolve(schema.parse({ data: { total: cases.length, cases } }))
          : path.endsWith('/connectors')
            ? Promise.resolve(schema.parse([]))
            : fail(),
      post: (_path: string, body: unknown, schema: { parse: (v: unknown) => unknown }) => {
        posts.push(body)
        return Promise.resolve(schema.parse({ k1: { verdict: 'True Positive' }, l1: null }))
      },
    } as unknown as StellarClient
    return { posts, c }
  }
  const run = (c: StellarClient) =>
    collectReportData(
      c,
      { instanceUrl: 'https://x', tenant: { id: 't', name: 'T' }, period: { start: '2026-09-01', end: '2026-09-07' }, aiTriage: true },
      { log: { warn: () => {} }, onProgress: () => {} },
    )
  const kase = (id: string, severity: string) => ({ _id: id, severity, size: 0, created_at: Date.parse('2026-09-02T00:00:00Z') })

  it('is no_cases when the period has no Case', async () => {
    expect((await run(client([]).c)).aiTriage).toEqual({ available: false, status: 'no_cases', verdicts: {} })
  })
  it('asks for every Case, not only the Key Cases', async () => {
    const { posts, c } = client([kase('k1', 'Critical'), kase('l1', 'Low')])
    const data = await run(c)
    expect(posts).toEqual([{ case_ids: ['k1', 'l1'] }])
    expect(data.aiTriage).toMatchObject({ available: true, status: 'ok', requested: 2, verdicts: { k1: 'True Positive' } })
  })
  it('is failed when the Cases could not be collected', async () => {
    expect((await run(client(null).c)).aiTriage).toEqual({ available: false, status: 'failed', verdicts: {} })
  })
})

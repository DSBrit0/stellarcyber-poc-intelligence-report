import { describe, expect, it } from 'vitest'
import type { StellarClient } from '../stellar/client.js'
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

import { MockAgent } from 'undici'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { StellarClient } from './client.js'

const BASE = 'https://stellar.example.com'
// A JWT whose payload carries only an expiry an hour ahead.
const jwt = `x.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.y`

function setup(delayMs = 0) {
  const agent = new MockAgent()
  agent.disableNetConnect()
  const pool = agent.get(BASE)
  pool.intercept({ path: /access_token/, method: 'POST' }).reply(200, { access_token: jwt }).persist()
  const cases = pool.intercept({ path: /cases/, method: 'GET' }).reply(200, { ok: true })
  if (delayMs) cases.delay(delayMs)
  cases.persist()
  const calls: string[] = []
  const abort = new AbortController()
  const client = new StellarClient(BASE, { method: 'apiKey', apiKey: 'k' }, agent, (c) => calls.push(c.path), abort.signal)
  return { client, abort, calls }
}

class Cancelled extends Error {}

describe('StellarClient cancellation', () => {
  it('refuses new calls once the signal is aborted, without contacting the Instance', async () => {
    const { client, abort, calls } = setup()
    abort.abort(new Cancelled())
    await expect(client.get('/connect/api/v1/cases', {}, z.unknown())).rejects.toBeInstanceOf(Cancelled)
    expect(calls).toEqual([])
  })

  it('aborts a call in flight with the signal reason, not a network error', async () => {
    const { client, abort } = setup(5_000)
    const pending = client.get('/connect/api/v1/cases', {}, z.unknown())
    setTimeout(() => abort.abort(new Cancelled()), 50)
    const t0 = Date.now()
    await expect(pending).rejects.toBeInstanceOf(Cancelled)
    expect(Date.now() - t0).toBeLessThan(2_000)
  })
})

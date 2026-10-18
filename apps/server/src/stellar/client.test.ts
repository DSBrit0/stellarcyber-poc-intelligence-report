import { MockAgent } from 'undici'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { retryAfterMs, StellarApiError, StellarClient } from './client.js'

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

describe('StellarClient retries', () => {
  function flaky(failures: number) {
    const agent = new MockAgent()
    agent.disableNetConnect()
    const pool = agent.get(BASE)
    pool.intercept({ path: /access_token/, method: 'POST' }).reply(200, { access_token: jwt }).persist()
    if (failures) pool.intercept({ path: /cases/, method: 'GET' }).replyWithError(new Error('socket hang up')).times(failures)
    pool.intercept({ path: /cases/, method: 'GET' }).reply(200, { ok: true }).persist()
    return new StellarClient(BASE, { method: 'apiKey', apiKey: 'k' }, agent)
  }

  it('retries a network error and returns the next answer', async () => {
    await expect(flaky(1).get('/connect/api/v1/cases', {}, z.object({ ok: z.boolean() }))).resolves.toEqual({ ok: true })
  }, 15_000)

  it('gives up with a network error after the retries', async () => {
    const err = await flaky(4).get('/connect/api/v1/cases', {}, z.unknown()).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(StellarApiError)
    expect((err as StellarApiError).code).toBe('network')
  }, 15_000)
})

describe('Retry-After', () => {
  it('reads seconds or an HTTP date, capped at 30 s; nothing usable is null', () => {
    const now = Date.parse('2026-10-18T12:00:00Z')
    expect(retryAfterMs('2', now)).toBe(2000)
    expect(retryAfterMs('Sun, 18 Oct 2026 12:00:05 GMT', now)).toBe(5000)
    expect(retryAfterMs('120', now)).toBe(30_000)
    expect(retryAfterMs(undefined, now)).toBeNull()
    expect(retryAfterMs('soon', now)).toBeNull()
    expect(retryAfterMs('Sun, 18 Oct 2026 11:59:00 GMT', now)).toBeNull()
  })

  it('waits what a throttling Instance asks before retrying', async () => {
    const agent = new MockAgent()
    agent.disableNetConnect()
    const pool = agent.get(BASE)
    pool.intercept({ path: /access_token/, method: 'POST' }).reply(200, { access_token: jwt }).persist()
    pool.intercept({ path: /cases/, method: 'GET' }).reply(429, {}, { headers: { 'retry-after': '2' } })
    pool.intercept({ path: /cases/, method: 'GET' }).reply(200, { ok: true })
    const client = new StellarClient(BASE, { method: 'apiKey', apiKey: 'k' }, agent)
    const t0 = Date.now()
    await expect(client.get('/connect/api/v1/cases', {}, z.object({ ok: z.boolean() }))).resolves.toEqual({ ok: true })
    // 2 s asked, against the 0.8 s fixed backoff of a first retry.
    expect(Date.now() - t0).toBeGreaterThanOrEqual(1_900)
  }, 15_000)
})

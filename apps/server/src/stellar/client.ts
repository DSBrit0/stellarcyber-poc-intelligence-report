import { setTimeout as sleep } from 'node:timers/promises'
import type { StellarCredential } from '@poc-intel/shared'
import { request, type Dispatcher } from 'undici'
import type { z } from 'zod'
import { ENDPOINTS } from './endpoints.js'
import type { ApiCallRecord } from '../lib/log-sink.js'
import { RequestStats, endpointGroup } from './request-stats.js'

const RETRYABLE = new Set([429, 502, 503, 504])
const MAX_RETRIES = 3
/** Backoff before retry n (0-based): RETRY_BASE_MS × 2ⁿ. */
const RETRY_BASE_MS = 800
const RENEW_BEFORE_MS = 60_000
const DEFAULT_TOKEN_TTL_MS = 10 * 60_000

export type Query = Record<string, string | number | boolean | undefined>

/** A failure talking to an Instance, with a stable code the web app can translate. */
export class StellarApiError extends Error {
  constructor(
    readonly code: 'auth_failed' | 'forbidden' | 'not_found' | 'bad_response' | 'unavailable' | 'network',
    message: string,
    readonly status?: number,
  ) {
    super(message)
  }
}

function jwtExpiryMs(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { exp?: number }
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}


/**
 * Client for one Instance with one Stellar Credential. Exchanges the credential for a
 * short-lived JWT (~10 min) and renews it transparently; the credential lives only in this object.
 */
export class StellarClient {
  #token: string | null = null
  #tokenExpiresAt = 0
  #renewing: Promise<void> | null = null
  /** Request statistics for this client's lifetime (one Sync). */
  readonly stats = new RequestStats()

  constructor(
    readonly instanceUrl: string,
    readonly credential: StellarCredential,
    readonly dispatcher: Dispatcher,
    /** Receives every call for the Audit log (no headers, no bodies). */
    private readonly recorder?: (call: ApiCallRecord) => void,
    /** Aborts every call in flight and refuses new ones; calls then reject with `signal.reason`. */
    private readonly signal?: AbortSignal,
  ) {}

  async authenticate(): Promise<void> {
    const headers: Record<string, string> =
      this.credential.method === 'apiKey'
        ? { authorization: `Bearer ${this.credential.apiKey}` }
        : {
            authorization: `Basic ${Buffer.from(`${this.credential.username}:${this.credential.token}`).toString('base64')}`,
          }
    const res = await this.#send('POST', ENDPOINTS.accessToken, undefined, headers, 15_000)
    if (res.status === 401 || res.status === 403) throw new StellarApiError('auth_failed', 'Instance rejected the credential', res.status)
    if (res.status !== 200) throw new StellarApiError('unavailable', `access_token answered HTTP ${res.status}`, res.status)
    const token = (res.body as { access_token?: unknown } | null)?.access_token
    if (typeof token !== 'string' || token.split('.').length !== 3) {
      throw new StellarApiError('bad_response', 'access_token response has no JWT')
    }
    this.#token = token
    this.#tokenExpiresAt = jwtExpiryMs(token) ?? Date.now() + DEFAULT_TOKEN_TTL_MS
  }

  get<S extends z.ZodType>(path: string, query: Query, schema: S, timeoutMs = 60_000): Promise<z.output<S>> {
    return this.#call('GET', path, query, undefined, schema, timeoutMs)
  }

  post<S extends z.ZodType>(path: string, body: unknown, schema: S, timeoutMs = 60_000): Promise<z.output<S>> {
    return this.#call('POST', path, undefined, body, schema, timeoutMs)
  }

  async #call<S extends z.ZodType>(method: 'GET' | 'POST', path: string, query: Query | undefined, body: unknown, schema: S, timeoutMs: number): Promise<z.output<S>> {
    for (let attempt = 0, reauthed = false; ; attempt++) {
      this.signal?.throwIfAborted()
      await this.#ensureToken()
      let res: { status: number; body: unknown }
      try {
        res = await this.#send(method, path, query, { authorization: `Bearer ${this.#token}` }, timeoutMs, body, attempt > 0)
      } catch (err) {
        // A dropped connection or a timeout is retried like a 5xx; a cancelled Sync is not (#send rethrows its reason).
        if (err instanceof StellarApiError && err.code === 'network' && attempt < MAX_RETRIES && !this.signal?.aborted) {
          await sleep(RETRY_BASE_MS * 2 ** attempt, undefined, { signal: this.signal })
          continue
        }
        throw err
      }
      if (res.status === 401 && !reauthed) {
        reauthed = true
        this.#token = null
        continue
      }
      if (RETRYABLE.has(res.status) && attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_MS * 2 ** attempt, undefined, { signal: this.signal })
        continue
      }
      if (res.status === 401) throw new StellarApiError('auth_failed', `${path}: unauthorized`, 401)
      if (res.status === 403) throw new StellarApiError('forbidden', `${path}: the credential lacks permission`, 403)
      if (res.status === 404) throw new StellarApiError('not_found', `${path}: not found`, 404)
      if (res.status !== 200) throw new StellarApiError('unavailable', `${path}: HTTP ${res.status}`, res.status)
      const parsed = schema.safeParse(res.body)
      if (!parsed.success) throw new StellarApiError('bad_response', `${path}: unexpected response shape`)
      return parsed.data
    }
  }

  #audit(method: string, url: URL, status: number | null, ms: number, bytes: number, retry: boolean, error: string | null) {
    this.recorder?.({
      instance: url.origin,
      method,
      endpoint: endpointGroup(url.pathname),
      path: url.pathname,
      query: url.searchParams.size ? Object.fromEntries(url.searchParams) : null,
      status,
      outcome: status == null ? 'network' : status >= 400 ? 'http_error' : 'ok',
      ms: Math.round(ms),
      bytes,
      retry,
      error,
    })
  }

  async #ensureToken(): Promise<void> {
    if (this.#token && Date.now() < this.#tokenExpiresAt - RENEW_BEFORE_MS) return
    // Concurrent workers share a single renewal.
    this.#renewing ??= this.authenticate().finally(() => {
      this.#renewing = null
    })
    await this.#renewing
  }

  async #send(
    method: 'GET' | 'POST',
    path: string,
    query: Query | undefined,
    headers: Record<string, string>,
    timeoutMs: number,
    payload?: unknown,
    retry = false,
  ): Promise<{ status: number; body: unknown }> {
    const url = new URL(path, this.instanceUrl)
    const t0 = performance.now()
    const done = this.stats.start()
    for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v))
    try {
      const res = await request(url, {
        method,
        headers: { accept: 'application/json', ...(payload !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
        ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
        dispatcher: this.dispatcher,
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
        signal: this.signal,
      })
      const text = await res.body.text()
      let body: unknown = null
      try {
        body = text ? JSON.parse(text) : null
      } catch {
        body = null
      }
      const ms = performance.now() - t0
      this.stats.record(url.pathname, res.statusCode, ms, text.length, retry)
      this.#audit(method, url, res.statusCode, ms, text.length, retry, res.statusCode >= 400 ? errorText(body) : null)
      return { status: res.statusCode, body }
    } catch (err) {
      if (this.signal?.aborted) throw this.signal.reason
      this.stats.record(url.pathname, 'network', performance.now() - t0, 0, retry)
      this.#audit(method, url, null, performance.now() - t0, 0, retry, (err as Error).message)
      // Never include headers here: they carry the credential.
      throw new StellarApiError('network', `${method} ${url.pathname}: ${(err as Error).message}`)
    } finally {
      done()
    }
  }
}

/** The Instance's own error message, if its JSON body has one (e.g. "security_exception"). */
function errorText(body: unknown): string | null {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    const m = b.message ?? b.error ?? b.detail
    if (typeof m === 'string') return m.slice(0, 300)
  }
  return null
}

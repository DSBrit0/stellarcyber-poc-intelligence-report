import type { StellarCredential } from '@poc-intel/shared'
import { request, type Dispatcher } from 'undici'
import type { z } from 'zod'
import { ENDPOINTS } from './endpoints.js'

const RETRYABLE = new Set([429, 502, 503, 504])
const MAX_RETRIES = 3
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Client for one Instance with one Stellar Credential. Exchanges the credential for a
 * short-lived JWT (~10 min) and renews it transparently; the credential lives only in this object.
 */
export class StellarClient {
  #token: string | null = null
  #tokenExpiresAt = 0
  #renewing: Promise<void> | null = null

  constructor(
    readonly instanceUrl: string,
    readonly credential: StellarCredential,
    readonly dispatcher: Dispatcher,
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
      await this.#ensureToken()
      const res = await this.#send(method, path, query, { authorization: `Bearer ${this.#token}` }, timeoutMs, body)
      if (res.status === 401 && !reauthed) {
        reauthed = true
        this.#token = null
        continue
      }
      if (RETRYABLE.has(res.status) && attempt < MAX_RETRIES) {
        await sleep(800 * 2 ** attempt)
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
  ): Promise<{ status: number; body: unknown }> {
    const url = new URL(path, this.instanceUrl)
    for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v))
    try {
      const res = await request(url, {
        method,
        headers: { accept: 'application/json', ...(payload !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
        ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
        dispatcher: this.dispatcher,
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
      })
      const text = await res.body.text()
      let body: unknown = null
      try {
        body = text ? JSON.parse(text) : null
      } catch {
        body = null
      }
      return { status: res.statusCode, body }
    } catch (err) {
      // Never include headers here: they carry the credential.
      throw new StellarApiError('network', `${method} ${url.pathname}: ${(err as Error).message}`)
    }
  }
}

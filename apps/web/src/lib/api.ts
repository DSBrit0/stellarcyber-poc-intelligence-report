/** Error from the API with the stable `error` code the server sends; pages translate known codes. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code)
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const body = init.body !== undefined ? JSON.stringify(init.body) : null
  const res = await fetch(`/api${path}`, {
    method: init.method ?? 'GET',
    credentials: 'same-origin',
    headers: init.body !== undefined ? { 'content-type': 'application/json' } : {},
    body,
    // A small change sent while the page closes still reaches the server (the browser caps keepalive at 64 KB).
    keepalive: init.method !== undefined && init.method !== 'GET' && (body?.length ?? 0) < 60_000,
  })
  if (res.status === 204) return undefined as T
  const payload = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new ApiError(res.status, payload?.error ?? 'internal')
  return payload as T
}

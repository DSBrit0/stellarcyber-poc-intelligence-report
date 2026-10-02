// Per-Sync request statistics: the baseline for performance work. Every call to the Instance is
// recorded by endpoint group (path with ids collapsed), so runs can be compared before/after a change.

export interface EndpointStats {
  requests: number
  retries: number
  status: Record<string, number>
  bytes: number
  ms: { total: number; p50: number; p95: number; max: number }
}

export interface SyncMetrics {
  /** Wall-clock milliseconds of the whole collection. */
  totalMs: number
  /** Milliseconds per collector / phase. */
  phases: Record<string, number>
  endpoints: Record<string, EndpointStats>
  /** Requests in flight allowed for alert paging. */
  concurrency: number
  /** Highest number of requests actually in flight at once. */
  peakInFlight: number
  counts: Record<string, number>
}

const quantile = (sorted: number[], q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]! : 0)

/** /connect/api/v1/cases/6abd…/alerts → cases/:id/alerts */
export function endpointGroup(path: string): string {
  return path
    .replace(/^\/connect\/api\/v1\//, '')
    .split('/')
    .map((seg) => (/^[0-9a-f]{16,}$/i.test(seg) ? ':id' : seg))
    .join('/')
}

export class RequestStats {
  #latencies = new Map<string, number[]>()
  #stats = new Map<string, Omit<EndpointStats, 'ms'>>()
  #inFlight = 0
  peakInFlight = 0

  start(): () => void {
    this.#inFlight++
    this.peakInFlight = Math.max(this.peakInFlight, this.#inFlight)
    return () => {
      this.#inFlight--
    }
  }

  record(path: string, status: number | 'network', ms: number, bytes: number, retry: boolean): void {
    const group = endpointGroup(path)
    const s = this.#stats.get(group) ?? { requests: 0, retries: 0, status: {}, bytes: 0 }
    s.requests++
    if (retry) s.retries++
    s.status[String(status)] = (s.status[String(status)] ?? 0) + 1
    s.bytes += bytes
    this.#stats.set(group, s)
    const l = this.#latencies.get(group) ?? []
    l.push(ms)
    this.#latencies.set(group, l)
  }

  endpoints(): Record<string, EndpointStats> {
    return Object.fromEntries(
      [...this.#stats].map(([group, s]) => {
        const l = [...(this.#latencies.get(group) ?? [])].sort((a, b) => a - b)
        return [group, { ...s, status: { ...s.status }, ms: { total: Math.round(l.reduce((a, b) => a + b, 0)), p50: Math.round(quantile(l, 0.5)), p95: Math.round(quantile(l, 0.95)), max: Math.round(l[l.length - 1] ?? 0) } }]
      }),
    )
  }
}

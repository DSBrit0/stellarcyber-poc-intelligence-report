import { db } from '../db/client.js'
import { apiCalls, appLogs, type LogLevel } from '../db/schema.js'
import { redact } from './redact.js'

// Persists the application log and the Instance API calls for the Admin Audit view. Writes are
// buffered and flushed in batches (every second, or every 500 entries), so logging never adds a
// database round-trip to a request, and a database hiccup loses log lines rather than failing work.

type AppLogRow = typeof appLogs.$inferInsert
type ApiCallRow = typeof apiCalls.$inferInsert

let source = 'api'
export const setLogSource = (s: string) => {
  source = s
}

const logs: AppLogRow[] = []
const calls: ApiCallRow[] = []
let timer: NodeJS.Timeout | null = null

function schedule() {
  if (logs.length >= 500 || calls.length >= 500) void flush()
  else timer ??= setTimeout(() => void flush(), 1000)
}

export async function flush(): Promise<void> {
  if (timer) clearTimeout(timer)
  timer = null
  const l = logs.splice(0)
  const c = calls.splice(0)
  try {
    for (let i = 0; i < l.length; i += 500) await db.insert(appLogs).values(l.slice(i, i + 500))
    for (let i = 0; i < c.length; i += 500) await db.insert(apiCalls).values(c.slice(i, i + 500))
  } catch (err) {
    console.error('[log-sink] could not persist', l.length, 'log lines and', c.length, 'API calls:', (err as Error).message)
  }
}

export function appLog(
  level: LogLevel,
  category: string,
  message: string,
  extra: { userId?: string | null; requestId?: string; context?: Record<string, unknown> } = {},
): void {
  logs.push({
    level,
    source,
    category,
    message: message.slice(0, 1000),
    userId: extra.userId ?? null,
    requestId: extra.requestId ?? null,
    context: extra.context ? (redact(extra.context) as Record<string, unknown>) : null,
  })
  schedule()
}

export interface ApiCallRecord {
  instance: string
  method: string
  endpoint: string
  path: string
  query: Record<string, string> | null
  status: number | null
  outcome: 'ok' | 'http_error' | 'network'
  ms: number
  bytes: number
  retry: boolean
  error: string | null
}

/** A recorder bound to who/what made the calls (a Sync, or a User looking up Tenants). */
export function apiCallRecorder(owner: { syncId?: string | null; userId?: string | null }) {
  return (call: ApiCallRecord) => {
    calls.push({
      ...call,
      query: call.query ? (redact(call.query) as Record<string, string>) : null,
      syncId: owner.syncId ?? null,
      userId: owner.userId ?? null,
      error: call.error ? String(redact(call.error)) : null,
    })
    schedule()
  }
}

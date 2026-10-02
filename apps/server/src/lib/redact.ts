// Kept apart from the log sink so it can be tested without a database.

const SECRET = /pass(word)?|token|api[-_]?key|authori[sz]ation|cookie|secret|credential|session|mfa/i

/** Removes anything that looks like a secret, at any depth, before it is stored. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1))
  if (typeof value === 'object') {
    // Numbers and booleans under a secret-like key (e.g. a count of sessions) are harmless and kept.
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SECRET.test(k) && (typeof v === 'string' || typeof v === 'object') && v !== null ? '[redacted]' : redact(v, depth + 1)]),
    )
  }
  if (typeof value === 'string') {
    const clean = value.replace(/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]+/g, '[jwt]')
    return clean.length > 2000 ? `${clean.slice(0, 2000)}…` : clean
  }
  return value
}

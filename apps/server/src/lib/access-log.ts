/**
 * The level of a request in the access log. Failures are warnings or errors; the screens' own polling
 * (and the Presenter's hover and scroll, sent several times a second) is debug, kept 7 days only, so it
 * does not drown everything else in the Audit page.
 */
const POLLED_GETS = /^\/api\/(auth\/me|stellar\/credentials|syncs\/[^/]+|pocs\/[^/]+(\/notebook|\/experiences(\/[^/]+)?)?|admin\/audit\/.+)$/
const FREQUENT_POSTS = /^\/api\/pocs\/[^/]+\/experiences\/[^/]+\/view$/

export type AccessLevel = 'error' | 'warn' | 'debug' | 'info'

export function accessLogLevel(method: string, path: string, status: number): AccessLevel {
  if (status >= 500) return 'error'
  if (status >= 400) return 'warn'
  if (method === 'GET' && POLLED_GETS.test(path)) return 'debug'
  if (method === 'POST' && FREQUENT_POSTS.test(path)) return 'debug'
  return 'info'
}

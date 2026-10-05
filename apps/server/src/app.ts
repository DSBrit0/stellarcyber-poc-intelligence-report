import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import type { StellarCredential } from '@poc-intel/shared'
import Fastify, { type FastifyInstance } from 'fastify'
import type { Dispatcher } from 'undici'
import { adminRoutes } from './admin/routes.js'
import { auditRoutes } from './admin/audit-routes.js'
import { authRoutes } from './auth/routes.js'
import { SESSION_COOKIE, loadSession } from './auth/session.js'
import { config } from './config.js'
import { HttpError } from './lib/http.js'
import { commentRoutes } from './comments/routes.js'
import { customerRoutes } from './customers/routes.js'
import { notebookRoutes } from './notebook/routes.js'
import { catalogAdminRoutes, catalogRoutes } from './catalog/routes.js'
import { pocRoutes } from './pocs/routes.js'
import type { RenderPdfJob } from './queue.js'
import { reportRoutes } from './report/routes.js'
import { StellarApiError } from './stellar/client.js'
import { appLog } from './lib/log-sink.js'

export interface StellarDeps {
  dispatcher: Dispatcher
}

export interface AppDeps extends StellarDeps {
  enqueueSync: (syncId: string, credential: StellarCredential) => Promise<void>
  enqueuePdf: (job: RenderPdfJob) => Promise<void>
}

declare module 'fastify' {
  interface FastifyInstance {
    enqueueSync: AppDeps['enqueueSync']
    enqueuePdf: AppDeps['enqueuePdf']
  }
}

const STELLAR_ERROR_STATUS: Record<StellarApiError['code'], number> = {
  auth_failed: 422,
  forbidden: 422,
  not_found: 422,
  bad_response: 502,
  unavailable: 502,
  network: 502,
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const cfg = config()
  const app = Fastify({
    logger: {
      level: cfg.LOG_LEVEL,
      redact: { paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'], remove: true },
    },
    // Only Caddy reaches the API (internal Docker network), so its X-Forwarded-For is trusted.
    trustProxy: true,
    bodyLimit: 1_048_576,
  })

  app.decorate('enqueueSync', deps.enqueueSync)
  app.decorate('enqueuePdf', deps.enqueuePdf)
  app.decorateRequest('auth', null)

  await app.register(cookie)
  await app.register(helmet, {
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    hsts: { maxAge: 31_536_000 },
  })
  await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute' })

  // CSRF: the session cookie is SameSite=Lax; on top of that every state-changing request
  // must come from the app's own origin.
  const origin = new URL(cfg.APP_ORIGIN).origin
  app.addHook('onRequest', async (req) => {
    if (!SAFE_METHODS.has(req.method)) {
      const sent = req.headers.origin
      if (sent !== origin) throw new HttpError(403, 'bad_origin')
    }
    req.auth = await loadSession(req.cookies[SESSION_COOKIE])
  })

  // Access log for the Audit page. Polling endpoints are logged at debug level so they do not drown the rest.
  const POLLING = /^\/api\/(syncs\/[^/]+|auth\/me|pocs\/[^/]+|stellar\/credentials|admin\/audit\/.+)$/
  app.addHook('onResponse', async (req, reply) => {
    const path = req.url.split('?')[0] ?? ''
    if (path === '/api/health') return
    const status = reply.statusCode
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : req.method === 'GET' && POLLING.test(path) ? 'debug' : 'info'
    appLog(level, 'http', `${req.method} ${path} → ${status}`, {
      userId: req.auth?.user.id ?? null,
      requestId: req.id,
      context: { method: req.method, path, status, ms: Math.round(reply.elapsedTime), ip: req.ip, userAgent: (req.headers['user-agent'] ?? '').slice(0, 120) },
    })
  })

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) {
      return reply.code(err.statusCode).send({ error: err.code, details: err.details })
    }
    if (err instanceof StellarApiError) {
      appLog('warn', 'stellar', `Instance error: ${err.code}`, { userId: req.auth?.user.id ?? null, requestId: req.id, context: { code: err.code, status: err.status, message: err.message } })
      return reply.code(STELLAR_ERROR_STATUS[err.code]).send({ error: `stellar_${err.code}` })
    }
    const status = (err as { statusCode?: number }).statusCode
    if (status && status < 500) return reply.code(status).send({ error: (err as { code?: string }).code ?? 'bad_request' })
    req.log.error({ err }, 'unhandled error')
    appLog('error', 'error', (err as Error).message || 'Unhandled error', {
      userId: req.auth?.user.id ?? null,
      requestId: req.id,
      context: { path: req.url.split('?')[0], stack: (err as Error).stack?.split('\n').slice(0, 8).join('\n') },
    })
    return reply.code(500).send({ error: 'internal' })
  })

  app.get('/api/health', { config: { rateLimit: false } }, async () => ({ status: 'ok' }))
  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(adminRoutes, { prefix: '/api/admin' })
  await app.register(auditRoutes, { prefix: '/api/admin/audit' })
  await app.register(pocRoutes, { prefix: '/api', dispatcher: deps.dispatcher })
  await app.register(reportRoutes, { prefix: '/api' })
  await app.register(customerRoutes, { prefix: '/api' })
  await app.register(notebookRoutes, { prefix: '/api' })
  await app.register(catalogRoutes, { prefix: '/api' })
  await app.register(catalogAdminRoutes, { prefix: '/api/admin' })
  await app.register(commentRoutes, { prefix: '/api' })
  return app
}

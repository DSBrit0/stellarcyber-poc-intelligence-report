// End-to-end smoke test against a running stack. It creates a throwaway Admin and PoC, then
// deletes them. Run it inside the api container (it needs the app's node_modules and DATABASE_URL):
//   docker compose exec -T -w /app/apps/server api node - < infra/scripts/smoke-test.mjs
import { generate } from 'otplib'
import postgres from 'postgres'
import { readdirSync } from 'node:fs'

const BASE = 'http://127.0.0.1:3000/api'
const ORIGIN = process.env.APP_ORIGIN
const EMAIL = `smoke-${Date.now()}@smoke.test`
const sql = postgres(process.env.DATABASE_URL, { max: 1 })
let customerId = null
let custUserId = null
const jars = { main: '', customer: '' }
let failures = 0

/** JSON with sorted keys: PostgreSQL JSONB does not keep key order. */
const canonical = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x))

async function call(path, { method = 'GET', body, jar = 'main' } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { origin: ORIGIN, cookie: jars[jar], ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) jars[jar] = setCookie.split(';')[0]
  const type = res.headers.get('content-type') ?? ''
  const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer())
  return { status: res.status, type, headers: res.headers, data }
}

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures++
}

const { hash } = await import('@node-rs/argon2')
const password = `smoke-${Math.random().toString(36).slice(2)}-pw`
const [user] = await sql`
  INSERT INTO users (email, name, password_hash, role, status)
  VALUES (${EMAIL}, 'Smoke Admin', ${await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 })}, 'admin', 'active')
  RETURNING id`

try {
  check('rejects wrong password', (await call('/auth/login', { method: 'POST', body: { email: EMAIL, password: 'wrong-password' } })).status === 401)

  const login = await call('/auth/login', { method: 'POST', body: { email: EMAIL, password } })
  check('login asks for MFA setup', login.data.step === 'mfa_setup', JSON.stringify(login.data))
  check('partial session cannot reach the API', (await call('/pocs')).status === 401)

  const setup = await call('/auth/mfa/setup', { method: 'POST', body: {} })
  const secret = new URL(setup.data.uri).searchParams.get('secret')
  check('MFA setup returns QR code', setup.data.qrDataUrl?.startsWith('data:image/png'))
  check('rejects wrong TOTP', (await call('/auth/mfa/verify', { method: 'POST', body: { code: '000000' } })).status === 401)

  const code = await generate({ secret })
  const verify = await call('/auth/mfa/verify', { method: 'POST', body: { code } })
  check('TOTP completes sign-in', verify.data.step === 'done')
  check('/auth/me', (await call('/auth/me')).data.email === EMAIL)

  const settings = await call('/admin/settings')
  check('admin settings default retention 90', settings.data.retentionDays === 90)

  const ssrf = await call('/stellar/tenants', {
    method: 'POST',
    body: { instanceUrl: 'https://10.30.11.150', credential: { method: 'apiKey', apiKey: 'smoke-test-key' } },
  })
  check('SSRF guard blocks private Instance', ssrf.status === 502 && ssrf.data.error === 'stellar_network', JSON.stringify(ssrf.data))

  // Create-PoC flow: a Draft PoC is created by "Run Sync" and completed by Save.
  const draft = await call('/pocs', {
    method: 'POST',
    body: { instanceUrl: 'https://smoke.example.com', draft: true, tenant: { id: 't-draft', name: 'Draft Tenant' }, period: { start: '2026-09-01', end: '2026-09-10' }, details: { customerName: 'Draft Tenant' } },
  })
  check('Run Sync creates a Draft PoC', draft.status === 201 && draft.data.draft === true)
  check('the list marks the Draft', (await call('/pocs')).data.some((p) => p.id === draft.data.id && p.draft === true))
  const noCred = await call(`/pocs/${draft.data.id}/syncs`, { method: 'POST', body: {} })
  check('Sync without a typed or remembered key asks for one', noCred.status === 400 && noCred.data.error === 'credential_required')
  check('no remembered credentials in a new browser', JSON.stringify((await call('/stellar/credentials')).data) === '[]')
  await call(`/pocs/${draft.data.id}`, { method: 'PATCH', body: { finalize: true, details: { customerName: 'Draft Saved' } } })
  check('Save completes the Draft', (await call(`/pocs/${draft.data.id}`)).data.draft === false)
  await call(`/pocs/${draft.data.id}`, { method: 'DELETE' })

  const poc = await call('/pocs', {
    method: 'POST',
    body: {
      instanceUrl: 'https://smoke.example.com',
      tenant: { id: 't-smoke', name: 'Smoke Tenant' },
      period: { start: '2026-09-01', end: '2026-09-10' },
      details: { customerName: 'Smoke Customer', verdict: 'approved' },
    },
  })
  check('create PoC', poc.status === 201)

  const daily = Array.from({ length: 10 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, value: 100 + i * 3 }))
  const compliance = { stats: { days: 10, zeroDays: 0, min: 100, avg: 114, max: 127 }, recommended: 121, recommendedWindow: { from: '2026-09-08', to: '2026-09-10' }, scenarios: [] }
  const data = {
    version: 3,
    collectedAt: new Date().toISOString(),
    instanceUrl: 'https://smoke.example.com',
    tenant: { id: 't-smoke', name: 'Smoke Tenant' },
    period: { start: '2026-09-01', end: '2026-09-10' },
    cases: { total: 30, bySeverity: { critical: 2, high: 8, medium: 12, low: 8 } },
    assets: { daily, compliance },
    volume: { dailyGb: daily, compliance },
    connectors: [],
    dataSensors: [],
    caseStats: { cases: 30, total: 30, alerts: 300, byStatus: { New: 10, Resolved: 20 }, byResolution: {}, handled: 20, closed: 20, medianCloseHours: 5, acknowledged: 20, medianAckMinutes: 12, top5Alerts: 80 },
    keyCases: [{ id: 'k1', name: 'Smoke threat', severity: 'critical', status: 'New', resolution: '', score: 90, alerts: 12, createdAt: Date.now() - 86400000, startedAt: Date.now() - 86460000, acknowledgedAt: null, closedAt: null }],
    tactics: { mitre: { tactics: [], techniques: [] }, xdr: { tactics: [], techniques: [] }, byCase: {}, topAlerts: {}, pages: { fetched: 1, failed: 0, forbidden: 0 }, alertsMissing: 0, casesWithoutAlertAccess: 0 },
    ingestion: { bySensor: [], byConnector: [] },
    aiTriage: null,
    gaps: [],
  }
  const [report] = await sql`INSERT INTO report_data (poc_id, version, data) VALUES (${poc.data.id}, ${data.version}, ${sql.json(data)}) RETURNING id`

  const withReports = await call(`/pocs/${poc.data.id}`)
  const w = withReports.data.reports[0]
  check('Report row carries its widgets', w && w.cases === 30 && w.alerts === 300 && w.assetsAvg === 114 && w.assetsPeak === 127 && Math.abs(w.volumeGb - daily.reduce((n, d) => n + d.value, 0)) < 1e-6, JSON.stringify(w))

  for (const template of ['technical', 'executive', 'insight']) {
    const html = await call(`/report-data/${report.id}/html?template=${template}&locale=pt-BR`)
    check(`HTML ${template}`, html.status === 200 && String(html.data).includes('Smoke Customer') && /script-src|default-src 'none'/.test(html.headers.get('content-security-policy') ?? ''))
  }
  const pdf = await call(`/report-data/${report.id}/pdf?template=insight&locale=en`)
  check('PDF render', pdf.status === 200 && pdf.type === 'application/pdf' && pdf.data.subarray(0, 4).toString() === '%PDF', `${pdf.data.length} bytes`)

  // Full PoC form round trip: API → PostgreSQL → read back → rendered Report.
  const form = {
    customerName: 'Smoke Customer', department: 'SOC', customerEmail: 'soc@smoke.test', analysts: ['Ana Smoke', 'Bruno Smoke'],
    successCriteria: 'Detect lateral movement; Cut alert noise', salesEngineer: { name: 'SE Smoke', email: 'se@smoke.test', phone: '+55 11 0000' },
    partner: { name: 'Partner Smoke', email: 'p@smoke.test', site: 'partner.smoke.test' }, platformVersion: '6.6.0', region: 'LATAM', version: '2.1',
    verdict: 'approved', comments: 'Round-trip comment', aiTriageTested: true,
    effort: { alertMin: 7, critHighMin: 90, mediumMin: 15, lowMin: 3, monthHours: 150 },
  }
  check('save the full form', (await call(`/pocs/${poc.data.id}`, { method: 'PATCH', body: { details: form } })).status === 200)
  const back = await call(`/pocs/${poc.data.id}`)
  check('form reads back identical from the database', canonical(back.data.details) === canonical(form), canonical(back.data.details).slice(0, 120))
  const [{ details: dbDetails }] = await sql`SELECT details FROM pocs WHERE id = ${poc.data.id}`
  check('form is stored in pocs.details (JSONB)', dbDetails.salesEngineer.phone === '+55 11 0000' && dbDetails.effort.alertMin === 7)
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  check('upload architecture image', (await call(`/pocs/${poc.data.id}/arch-image`, { method: 'PUT', body: { dataUrl: `data:image/png;base64,${png}` } })).status === 200)
  const img = await call(`/pocs/${poc.data.id}/arch-image`)
  check('architecture image reads back', img.status === 200 && img.type === 'image/png' && img.data.length === Buffer.from(png, 'base64').length)
  const tech = String((await call(`/report-data/${report.id}/html?template=technical&locale=en`)).data)
  check('Technical Report shows the form fields', ['SE Smoke', 'partner.smoke.test', 'Detect lateral movement', 'Round-trip comment', 'Ana Smoke; Bruno Smoke', 'LATAM', '6.6.0', 'Version 2.1'].every((x) => tech.includes(x)), ['SE Smoke', 'partner.smoke.test', 'Detect lateral movement', 'Round-trip comment', 'Ana Smoke; Bruno Smoke', 'LATAM', '6.6.0', 'Version 2.1'].filter((x) => !tech.includes(x)).join(','))
  check('Technical Report embeds the architecture image', tech.includes(`data:image/png;base64,${png}`))
  const exec = String((await call(`/report-data/${report.id}/html?template=executive&locale=en`)).data)
  check('Executive Report uses the effort premises (7 min triage)', /triage 7 min/.test(exec) && exec.includes('Approved'))
  check('verdict shown', tech.includes('Approved'))

  const present = await call(`/report-data/${report.id}/present?template=executive&locale=en`)
  check('presentation mode has a nonce-bound script', present.status === 200 && /<script nonce="[^"]+">/.test(String(present.data)) && /script-src 'nonce-/.test(present.headers.get('content-security-policy') ?? ''))

  // Customer access: registered in advance, linked by company name + Access Key, approved by the owner.
  const customer = await call('/customers', { method: 'POST', body: { name: `Smoke Customer ${Date.now()}`, instanceUrl: 'https://smoke.example.com/' } })
  check('Customer keeps its Instance URL', customer.data.instanceUrl === 'https://smoke.example.com')
  check('create Customer returns an access key once', customer.status === 201 && /^\w{4}-\w{4}-\w{4}$/.test(customer.data.accessKey))
  customerId = customer.data.id
  check('link PoC to Customer', (await call(`/pocs/${poc.data.id}`, { method: 'PATCH', body: { customerId } })).status === 200)
  const custEmail = `smoke-cust-${Date.now()}@smoke.test`
  const custPassword = `${password}-cust`
  const wrongKey = await call('/auth/register', { method: 'POST', jar: 'customer', body: { email: custEmail, name: 'Smoke Customer User', password: custPassword, customer: { name: customer.data.name, accessKey: 'AAAA-BBBB-CCCC' } } })
  check('registration with a wrong access key is refused', wrongKey.status === 400 && wrongKey.data.error === 'customer_key_invalid')
  const reg = await call('/auth/register', { method: 'POST', jar: 'customer', body: { email: custEmail, name: 'Smoke Customer User', password: custPassword, customer: { name: customer.data.name.toUpperCase(), accessKey: customer.data.accessKey.toLowerCase() } } })
  check('registration with name + key is accepted (case-insensitive)', reg.status === 202)
  check('pending customer cannot sign in', (await call('/auth/login', { method: 'POST', jar: 'customer', body: { email: custEmail, password: custPassword } })).status === 403)
  const pending = (await call('/customers/users')).data.find((u) => u.email === custEmail)
  check('owner sees the pending customer user', pending?.status === 'pending')
  check('owner approves', (await call(`/customers/users/${pending.id}/approve`, { method: 'POST', body: {} })).status === 200)
  await call('/auth/login', { method: 'POST', jar: 'customer', body: { email: custEmail, password: custPassword } })
  const cs = await call('/auth/mfa/setup', { method: 'POST', jar: 'customer', body: {} })
  await call('/auth/mfa/verify', { method: 'POST', jar: 'customer', body: { code: await generate({ secret: new URL(cs.data.uri).searchParams.get('secret') }) } })
  const me2 = await call('/auth/me', { jar: 'customer' })
  check('customer signs in with MFA, role customer', me2.data.role === 'customer' && me2.data.customerId === customerId)
  const custPocs = await call('/pocs', { jar: 'customer' })
  check('customer sees only the linked PoC', custPocs.status === 200 && custPocs.data.length === 1 && custPocs.data[0].id === poc.data.id)
  check('customer opens the Report', (await call(`/report-data/${report.id}/html?template=technical&locale=en`, { jar: 'customer' })).status === 200)
  check('customer cannot edit the PoC', (await call(`/pocs/${poc.data.id}`, { method: 'PATCH', jar: 'customer', body: { details: { customerName: 'x' } } })).status === 403)
  check('customer cannot reach staff routes', (await call('/customers', { jar: 'customer' })).status === 403)
  check('customer comments on the Report', (await call(`/report-data/${report.id}/comments`, { method: 'POST', jar: 'customer', body: { body: 'Looks good' } })).status === 201)
  const comments = await call(`/report-data/${report.id}/comments`)
  check('owner reads the comment', comments.data.length === 1 && comments.data[0].body === 'Looks good')
  custUserId = me2.data.id

  // Permanent deletion of a Report: nothing of it may remain in the database or on disk.
  const rendersDir = `${process.env.DATA_DIR ?? '/data'}/renders`
  const pdfsBefore = readdirSync(rendersDir).filter((f) => f.startsWith(`${report.id}-`)).length
  check('a cached PDF of the Report exists before deletion', pdfsBefore > 0, `${pdfsBefore} file(s)`)
  check('customer cannot delete the Report', (await call(`/report-data/${report.id}`, { method: 'DELETE', jar: 'customer' })).status === 403)
  check('owner deletes the Report', (await call(`/report-data/${report.id}`, { method: 'DELETE' })).status === 204)
  const [left] = await sql`SELECT (SELECT count(*) FROM report_data WHERE id = ${report.id})::int AS rd, (SELECT count(*) FROM report_comments WHERE report_data_id = ${report.id})::int AS rc, (SELECT count(*) FROM syncs WHERE report_data_id = ${report.id})::int AS sy`
  check('no Report Data, comments or Syncs remain', left.rd === 0 && left.rc === 0 && left.sy === 0, JSON.stringify(left))
  check('no cached PDF remains on disk', readdirSync(rendersDir).filter((f) => f.startsWith(`${report.id}-`)).length === 0)
  check('deleted Report is gone for everyone', (await call(`/report-data/${report.id}/html?template=technical&locale=en`)).status === 404)

  check('delete PoC', (await call(`/pocs/${poc.data.id}`, { method: 'DELETE' })).status === 204)
  const [pocLeft] = await sql`SELECT count(*)::int AS n FROM pocs WHERE id = ${poc.data.id}`
  check('PoC row and its details are gone', pocLeft.n === 0)
  // Audit page: the log sink flushes every second.
  await new Promise((r) => setTimeout(r, 1500))
  const summary = await call('/admin/audit/summary')
  check('audit summary', summary.status === 200 && typeof summary.data.counts?.logins24h === 'number' && summary.data.hourly?.length === 24)
  const events = await call(`/admin/audit/events?userId=${user.id}&action=auth.`)
  check('audit events list this User\'s sign-in', events.data.rows?.some((e) => e.action === 'auth.login' && e.email === EMAIL))
  const logs = await call(`/admin/audit/logs?level=debug&category=http&q=${encodeURIComponent('/api/pocs')}`)
  check('HTTP access is logged', logs.data.rows?.some((l) => l.userId === user.id && l.context?.path?.startsWith('/api/pocs')) && typeof logs.data.levels === 'object')
  const [leaked] = await sql`SELECT count(*)::int AS n FROM app_logs WHERE context::text ILIKE ${'%' + password + '%'}`
  check('no password in the logs', leaked.n === 0)
  check('audit API calls list', (await call('/admin/audit/api-calls?outcome=http_error')).status === 200)
  check('audit API stats', Array.isArray((await call('/admin/audit/api-stats')).data.endpoints))
  check('audit Syncs list', (await call('/admin/audit/syncs?status=failed')).status === 200)
  const csv = await call(`/admin/audit/export?kind=events&format=csv&userId=${user.id}`)
  check('audit CSV export', csv.type.startsWith('text/csv') && csv.data.toString().includes('auth.login'))
  const txt = await call('/admin/audit/export?kind=logs&format=txt&level=info')
  check('audit TXT export', txt.type.startsWith('text/plain') && /^\[(INFO|WARN|ERROR)\]/m.test(txt.data.toString()))
  check('audit rejects a bad filter', (await call('/admin/audit/logs?level=loud')).status === 400)

  check('logout', (await call('/auth/logout', { method: 'POST' })).status === 204)
  check('session gone after logout', (await call('/auth/me')).status === 401)

  // Installation-style account: MFA exempt and must change its password first.
  await sql`UPDATE users SET mfa_exempt = true, must_change_password = true WHERE id = ${user.id}`
  const exempt = await call('/auth/login', { method: 'POST', body: { email: EMAIL, password } })
  check('MFA-exempt login completes with password only', exempt.data.step === 'done' && exempt.data.me?.mustChangePassword === true)
  const blocked = await call('/pocs')
  check('pending password change blocks the API', blocked.status === 403 && blocked.data.error === 'password_change_required')
  check('same password is refused', (await call('/auth/password', { method: 'POST', body: { currentPassword: password, newPassword: password } })).status === 400)
  const changed = await call('/auth/password', { method: 'POST', body: { currentPassword: password, newPassword: `${password}-new` } })
  check('password change succeeds', changed.status === 200)
  check('API released after the change', (await call('/pocs')).status === 200)
} finally {
  if (custUserId) await sql`DELETE FROM audit_log WHERE user_id = ${custUserId}`
  await sql`DELETE FROM users WHERE email LIKE 'smoke-cust-%@smoke.test'`
  if (customerId) await sql`DELETE FROM customers WHERE id = ${customerId}`
  await sql`DELETE FROM audit_log WHERE user_id = ${user.id}`
  await sql`DELETE FROM app_logs WHERE user_id = ${user.id}`
  await sql`DELETE FROM api_calls WHERE user_id = ${user.id}`
  await sql`DELETE FROM users WHERE id = ${user.id}`
  await sql.end()
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exit(failures ? 1 : 0)

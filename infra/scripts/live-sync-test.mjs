// Live test of a real Sync against a Stellar Cyber Instance. It creates a throwaway Admin and PoC,
// and deletes both at the end. The credential comes from the environment and is never written to disk:
//   docker compose exec -T -w /app/apps/server -e STELLAR_URL=https://x.stellarcyber.cloud -e STELLAR_API_KEY=... \
//     api node --input-type=module - < infra/scripts/live-sync-test.mjs
// Optional: STELLAR_TENANT (cust_id; defaults to the first Tenant), POC_DAYS (default 14).
import { hash } from '@node-rs/argon2'
import postgres from 'postgres'

const BASE = 'http://127.0.0.1:3000/api'
const { APP_ORIGIN, DATABASE_URL, STELLAR_URL, STELLAR_API_KEY, STELLAR_TENANT } = process.env
const DAYS = Number(process.env.POC_DAYS ?? 14)
if (!STELLAR_URL || !STELLAR_API_KEY) throw new Error('STELLAR_URL and STELLAR_API_KEY are required')

const sql = postgres(DATABASE_URL, { max: 1 })
const credential = { method: 'apiKey', apiKey: STELLAR_API_KEY }
let cookie = ''

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { origin: APP_ORIGIN, cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  const type = res.headers.get('content-type') ?? ''
  return { status: res.status, type, data: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) }
}

const email = `live-${Date.now()}@smoke.test`
const password = `live-${Math.random().toString(36).slice(2)}-pw`
const [user] = await sql`
  INSERT INTO users (email, name, password_hash, role, status, mfa_exempt)
  VALUES (${email}, 'Live Test', ${await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 })}, 'admin', 'active', true)
  RETURNING id`
let pocId

try {
  await call('/auth/login', { method: 'POST', body: { email, password } })

  const t0 = Date.now()
  const tenants = await call('/stellar/tenants', { method: 'POST', body: { instanceUrl: STELLAR_URL, credential } })
  console.log(`tenants: HTTP ${tenants.status} in ${Date.now() - t0} ms`)
  if (tenants.status !== 200) throw new Error(JSON.stringify(tenants.data))
  for (const t of tenants.data.slice(0, 15)) console.log(`  ${t.id}  ${t.name}${t.group ? `  [${t.group}]` : ''}`)
  if (tenants.data.length > 15) console.log(`  … ${tenants.data.length - 15} more`)

  const tenant = tenants.data.find((t) => t.id === STELLAR_TENANT) ?? tenants.data[0]
  const end = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const start = new Date(Date.now() - DAYS * 86_400_000).toISOString().slice(0, 10)
  console.log(`\nPoC on tenant ${tenant.name} (${tenant.id}), ${start} → ${end}`)

  const poc = await call('/pocs', {
    method: 'POST',
    body: { instanceUrl: STELLAR_URL, tenant: { id: tenant.id, name: tenant.name }, period: { start, end }, details: { customerName: 'Live Sync Test' } },
  })
  pocId = poc.data.id
  const sync = await call(`/pocs/${pocId}/syncs`, { method: 'POST', body: { credential } })
  const t1 = Date.now()
  let state
  do {
    await new Promise((r) => setTimeout(r, 1500))
    state = (await call(`/syncs/${sync.data.syncId}`)).data
  } while (state.status === 'queued' || state.status === 'running')
  console.log(`sync: ${state.status} in ${((Date.now() - t1) / 1000).toFixed(1)} s${state.error ? ` (${state.error})` : ''}`)

  if (state.reportDataId) {
    const [{ data }] = await sql`SELECT data FROM report_data WHERE id = ${state.reportDataId}`
    console.log('\nReport Data summary')
    console.log('  cases      ', JSON.stringify(data.cases))
    console.log('  assets     ', `${data.assets.daily.length} days`, JSON.stringify(data.assets.compliance.stats), 'recommended', data.assets.compliance.recommended)
    console.log('  volume     ', `${data.volume.dailyGb.length} days`, JSON.stringify(data.volume.compliance.stats))
    console.log('  connectors ', data.connectors.length, data.connectors.slice(0, 3).map((c) => `${c.name}/${c.type}/${c.active}`).join(', '))
    console.log('  sensors    ', data.dataSensors.length, data.dataSensors.slice(0, 3).map((s) => `${s.name}/${s.kind}/${s.online}`).join(', '))
    console.log('  gaps       ', JSON.stringify(data.gaps))

    const pdf = await call(`/report-data/${state.reportDataId}/pdf?template=technical&locale=pt-BR`)
    console.log(`\nPDF: HTTP ${pdf.status} ${pdf.type} ${pdf.data.length} bytes`)
  }
} finally {
  if (pocId) await sql`DELETE FROM pocs WHERE id = ${pocId}`
  await sql`DELETE FROM audit_log WHERE user_id = ${user.id}`
  await sql`DELETE FROM users WHERE id = ${user.id}`
  await sql.end()
}

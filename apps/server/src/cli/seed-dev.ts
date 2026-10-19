// Sample data for a local development database (`docker compose --profile dev up -d dev-db`, then
// `npm run seed:dev -w @poc-intel/server`). Every account's password is Stellarcyber@. It refuses to run
// in production or against a database that is not on this machine.
import { customerNameKey, NotebookOverview, PocDetails } from '@poc-intel/shared'
import { sql as dsql } from 'drizzle-orm'
import { db, sql } from '../db/client.js'
import { migrate } from '../db/migrate.js'
import { customers, pocDataSources, pocs, users } from '../db/schema.js'
import { sha256 } from '../lib/crypto.js'
import { MIGRATIONS_DIR } from '../lib/paths.js'
import { hashPassword } from '../lib/password.js'
import { newAccessKey, normalizeAccessKey } from '../customers/access-key.js'

const host = new URL(process.env.DATABASE_URL ?? '').hostname
if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '::1'].includes(host)) {
  console.error(`seed-dev: refusing to seed ${host || 'an unknown database'} (local development databases only)`)
  process.exit(1)
}

await migrate(sql, MIGRATIONS_DIR)
const passwordHash = await hashPassword('Stellarcyber@')
const base = { status: 'active' as const, passwordHash, mfaExempt: true, mustChangePassword: false, decidedAt: dsql`now()` }
const user = async (email: string, name: string, role: 'admin' | 'sales_engineer' | 'partner' | 'customer', customerId: string | null = null, company = '') => {
  const [u] = await db.insert(users).values({ email, name, role, customerId, company, ...base })
    .onConflictDoUpdate({ target: users.email, set: { role, customerId, ...base } }).returning({ id: users.id })
  return u!.id
}
const keys: Record<string, string> = {}
const company = async (name: string, profile: 'customer' | 'partner', ownerId: string) => {
  const key = newAccessKey(); keys[name] = key
  const [c] = await db.insert(customers).values({ name, nameKey: customerNameKey(name), profile, ownerId, accessKeyHash: sha256(normalizeAccessKey(key)) })
    .onConflictDoUpdate({ target: customers.nameKey, set: { profile, ownerId, accessKeyHash: sha256(normalizeAccessKey(key)) } }).returning({ id: customers.id })
  return c!.id
}
await user('admin@local.test', 'Admin Local', 'admin')
const se = await user('se@local.test', 'Sales Engineer Local', 'sales_engineer')
await user('se2@local.test', 'Outro SE', 'sales_engineer')
const acme = await company('Acme Revenda', 'partner', se)
const partner = await user('partner@local.test', 'Partner Acme', 'partner', acme, 'Acme Revenda')
const lenovo = await company('Lenovo', 'customer', se)
await user('cliente@local.test', 'Rafael (Lenovo)', 'customer', lenovo, 'Lenovo')
const globex = await company('Globex', 'customer', partner)
await user('cliente.globex@local.test', 'Cliente Globex', 'customer', globex, 'Globex')

const details = (customerName: string) => ({ customerName, department: '', customerEmail: '', analysts: [], successCriteria: '', salesEngineer: { name: '', email: '', phone: '' }, partner: { name: '', email: '', site: '' }, platformVersion: '', region: '', comments: '', aiTriageTested: false, effort: { alertMin: 4, critHighMin: 120, mediumMin: 20, lowMin: 2, monthHours: 160 }, version: '1.0' })
await sql`DELETE FROM pocs WHERE details->>'customerName' IN ('Lenovo', 'Globex')`
await sql`DELETE FROM pocs WHERE details->>'customerName' IN ('Lenovo', 'Globex')`
const poc = { instanceUrl: 'https://demo.stellarcyber.cloud', tenantId: 'demo', tenantName: 'Demo', periodStart: '2026-08-24', periodEnd: '2026-09-22' }
await db.insert(pocs).values([
  { ...poc, ownerId: se, customerId: lenovo, details: details('Lenovo') as never },
  { ...poc, ownerId: partner, customerId: globex, details: details('Globex') as never },
])

// A PoC Notebook with Data Sources in every status.
const [notebook] = await db
  .insert(pocs)
  .values({ ownerId: se, customerId: lenovo, details: PocDetails.parse({ customerName: 'Lenovo' }), notebook: NotebookOverview.parse({ startDate: '2026-10-13' }) })
  .returning({ id: pocs.id })
const rows = [
  { kind: 'parser', name: 'Fortinet FortiGate', port: '5150', status: 'ingesting' },
  { kind: 'parser', name: 'Palo Alto Networks NGFW', port: '5146', status: 'in_progress' },
  { kind: 'parser', name: 'Cisco ASA', port: '5144', status: 'ticket_open' },
  { kind: 'parser', name: 'Windows Event NXLog', port: '5142', status: null },
  { kind: 'connector', name: 'Microsoft Entra ID', port: '', status: 'ingesting' },
  { kind: 'connector', name: 'SentinelOne', port: '', status: 'ticket_open' },
] as const
await db.insert(pocDataSources).values(rows.map((r, i) => ({ pocId: notebook!.id, kind: r.kind, name: r.name, port: r.port, status: r.status, notes: i === 0 ? 'Recebendo logs desde segunda.' : '', position: i + 1, updatedBy: se })))

console.log('Seeded. Accounts: admin@, se@, se2@, partner@, cliente@, cliente.globex@local.test; password Stellarcyber@')
console.log('Company access keys:', keys)
await sql.end()

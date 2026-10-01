// Creates (or resets) an Admin. The account must change its password at the first sign-in.
//   docker compose exec api node dist/cli/create-admin.js [--no-mfa] <email> <full name>
// The password comes from ADMIN_PASSWORD when set (env, not argv, so it stays out of `ps`);
// otherwise a random one is generated and printed once.
//   --no-mfa  exempts the account from TOTP (the installation Admin). An Admin can revoke it later.
import { Email, Password } from '@poc-intel/shared'
import { sql as dsql } from 'drizzle-orm'
import { db, sql } from '../db/client.js'
import { migrate } from '../db/migrate.js'
import { users } from '../db/schema.js'
import { randomToken } from '../lib/crypto.js'
import { MIGRATIONS_DIR } from '../lib/paths.js'
import { hashPassword } from '../lib/password.js'

const args = process.argv.slice(2)
const mfaExempt = args.includes('--no-mfa')
const [rawEmail, ...nameParts] = args.filter((a) => !a.startsWith('--'))
const email = Email.safeParse(rawEmail)
if (!email.success || nameParts.length === 0) {
  console.error('usage: create-admin [--no-mfa] <email> <full name>')
  process.exit(2)
}

const provided = process.env.ADMIN_PASSWORD
if (provided !== undefined && !Password.safeParse(provided).success) {
  console.error('ADMIN_PASSWORD must be 12–128 characters')
  process.exit(2)
}
const password = provided ?? randomToken(18)

await migrate(sql, MIGRATIONS_DIR)
const passwordHash = await hashPassword(password)
const account = {
  role: 'admin' as const,
  status: 'active' as const,
  passwordHash,
  mfaExempt,
  mustChangePassword: true,
  failedLogins: 0,
  lockedUntil: null,
}
await db
  .insert(users)
  .values({ email: email.data, name: nameParts.join(' '), decidedAt: dsql`now()`, ...account })
  .onConflictDoUpdate({ target: users.email, set: { ...account, updatedAt: dsql`now()` } })

console.log(`Admin ${email.data} ready${mfaExempt ? ' (MFA exempt)' : ''}. The password must be changed at the first sign-in.`)
if (provided === undefined) console.log(`One-time password:\n\n  ${password}\n`)
await sql.end()

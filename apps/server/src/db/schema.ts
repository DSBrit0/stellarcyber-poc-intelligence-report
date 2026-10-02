// Mirrors migrations/*.sql — the SQL files are the source of truth; keep both in step.
import type { PocDetails, ReportData, Role, SyncProgress, SyncStatus, UserStatus, Locale } from '@poc-intel/shared'
import type { SyncMetrics } from '../stellar/request-stats.js'
import { bigint, boolean, date, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'

const ts = (name: string) => timestamp(name, { withTimezone: true })

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  company: text('company').notNull().default(''),
  passwordHash: text('password_hash'),
  role: text('role').$type<Role>().notNull().default('partner'),
  status: text('status').$type<UserStatus>().notNull().default('pending'),
  locale: text('locale').$type<Locale>().notNull().default('pt-BR'),
  mfaSecretEnc: text('mfa_secret_enc'),
  mfaEnabled: boolean('mfa_enabled').notNull().default(false),
  mfaLastStep: bigint('mfa_last_step', { mode: 'number' }),
  mfaExempt: boolean('mfa_exempt').notNull().default(false),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  customerId: uuid('customer_id'),
  failedLogins: integer('failed_logins').notNull().default(0),
  lockedUntil: ts('locked_until'),
  decidedBy: uuid('decided_by'),
  decidedAt: ts('decided_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})
export type User = typeof users.$inferSelect

export const authIdentities = pgTable(
  'auth_identities',
  {
    provider: text('provider').notNull(),
    subject: text('subject').notNull(),
    userId: uuid('user_id').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.subject] })],
)

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  mfaVerified: boolean('mfa_verified').notNull().default(false),
  ip: text('ip').notNull().default(''),
  userAgent: text('user_agent').notNull().default(''),
  createdAt: ts('created_at').notNull().defaultNow(),
  lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
  expiresAt: ts('expires_at').notNull(),
})
export type Session = typeof sessions.$inferSelect

export const passwordResets = pgTable('password_resets', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  createdBy: uuid('created_by'),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
})

export const pocs = pgTable('pocs', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull(),
  instanceUrl: text('instance_url').notNull(),
  tenantId: text('tenant_id').notNull(),
  tenantName: text('tenant_name').notNull().default(''),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  details: jsonb('details').$type<PocDetails>().notNull(),
  archImage: text('arch_image'),
  customerId: uuid('customer_id'),
  draft: boolean('draft').notNull().default(false),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})
export type Poc = typeof pocs.$inferSelect

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  /** Normalised name used to match a Registration: lower case, single spaces. */
  nameKey: text('name_key').notNull().unique(),
  ownerId: uuid('owner_id').notNull(),
  accessKeyHash: text('access_key_hash').notNull(),
  instanceUrl: text('instance_url'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})
export type Customer = typeof customers.$inferSelect

export type CommentKind = 'internal' | 'report'
export const reportComments = pgTable('report_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportDataId: uuid('report_data_id').notNull(),
  userId: uuid('user_id'),
  body: text('body').notNull(),
  /** internal: stays in the app; report: a change note, printed in the Report's version history. */
  kind: text('kind').$type<CommentKind>().notNull().default('internal'),
  /** Hidden from Customer Users; internal comments by staff only. */
  isPrivate: boolean('is_private').notNull().default(false),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const reportData = pgTable('report_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  pocId: uuid('poc_id').notNull(),
  version: integer('version').notNull(),
  /** Major version of the Report within its PoC: 1, 2, 3… (gaps stay when a Report is deleted). */
  seq: integer('seq').notNull(),
  data: jsonb('data').$type<ReportData>().notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const syncs = pgTable('syncs', {
  id: uuid('id').primaryKey().defaultRandom(),
  pocId: uuid('poc_id').notNull(),
  requestedBy: uuid('requested_by'),
  status: text('status').$type<SyncStatus>().notNull().default('queued'),
  progress: jsonb('progress').$type<SyncProgress>(),
  error: text('error'),
  reportDataId: uuid('report_data_id'),
  metrics: jsonb('metrics').$type<SyncMetrics>(),
  createdAt: ts('created_at').notNull().defaultNow(),
  startedAt: ts('started_at'),
  finishedAt: ts('finished_at'),
})

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

export const apiCalls = pgTable('api_calls', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  at: ts('at').notNull().defaultNow(),
  syncId: uuid('sync_id'),
  userId: uuid('user_id'),
  instance: text('instance').notNull(),
  method: text('method').notNull(),
  endpoint: text('endpoint').notNull(),
  path: text('path').notNull(),
  query: jsonb('query').$type<Record<string, string>>(),
  status: integer('status'),
  outcome: text('outcome').$type<'ok' | 'http_error' | 'network'>().notNull(),
  ms: integer('ms').notNull(),
  bytes: integer('bytes').notNull().default(0),
  retry: boolean('retry').notNull().default(false),
  error: text('error'),
})

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export const appLogs = pgTable('app_logs', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  at: ts('at').notNull().defaultNow(),
  level: text('level').$type<LogLevel>().notNull(),
  source: text('source').notNull(),
  category: text('category').notNull(),
  message: text('message').notNull(),
  userId: uuid('user_id'),
  requestId: text('request_id'),
  context: jsonb('context'),
})

export const auditLog = pgTable('audit_log', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  at: ts('at').notNull().defaultNow(),
  userId: uuid('user_id'),
  action: text('action').notNull(),
  target: text('target'),
  ip: text('ip'),
  meta: jsonb('meta'),
})

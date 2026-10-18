// Mirrors migrations/*.sql — the SQL files are the source of truth; keep both in step.
import type { AnswerValue, AudienceProfile, BriefingSection, ExperienceView, SceneState, ExperienceStatus, StageId, StagePhase, CatalogKind, MilestoneTone, CompanyProfile, CriterionStatus, DataSourceStatus, I18nText, NotebookOverview, PocDetails, ProcessKind, ProcessStatus, ReportData, Role, SyncProgress, SyncStatus, UserStatus, Locale } from '@poc-intel/shared'
import type { SyncMetrics } from '../stellar/request-stats.js'
import { bigint, boolean, date, doublePrecision, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core'

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
  /** The Root Administrator (ADR 0013): fixed Admin Role, never disabled or deleted. */
  isRoot: boolean('is_root').notNull().default(false),
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
  /** The Report target; NULL while the PoC is only a PoC Notebook (ADR 0010). */
  instanceUrl: text('instance_url'),
  tenantId: text('tenant_id'),
  tenantName: text('tenant_name').notNull().default(''),
  periodStart: date('period_start'),
  periodEnd: date('period_end'),
  details: jsonb('details').$type<PocDetails>().notNull(),
  /** The PoC Notebook's overview; NULL when the PoC has no Notebook. */
  notebook: jsonb('notebook').$type<NotebookOverview>(),
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
  /** customer or partner: the Role its Users take (ADR 0011). */
  profile: text('profile').$type<CompanyProfile>().notNull().default('customer'),
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
  /** Period this Sync collects when it differs from the PoC's; both NULL otherwise. */
  periodStart: date('period_start'),
  periodEnd: date('period_end'),
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

// PoC Notebook rows (ADR 0010, 0012): each one is saved on its own.
export const pocCriteria = pgTable('poc_criteria', {
  id: uuid('id').primaryKey().defaultRandom(),
  pocId: uuid('poc_id').notNull(),
  position: doublePrecision('position').notNull(),
  text: text('text').notNull(),
  status: text('status').$type<CriterionStatus>(),
  notes: text('notes').notNull().default(''),
  weight: smallint('weight'),
  updatedBy: uuid('updated_by'),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

export const pocMeetings = pgTable('poc_meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  pocId: uuid('poc_id').notNull(),
  date: date('date'),
  link: text('link').notNull().default(''),
  passcode: text('passcode').notNull().default(''),
  notes: text('notes').notNull().default(''),
  nextSteps: text('next_steps').notNull().default(''),
  updatedBy: uuid('updated_by'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

export const notebookTemplateItems = pgTable('notebook_template_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  section: text('section').$type<'process' | 'schedule'>().notNull(),
  kind: text('kind').$type<ProcessKind | 'milestone'>().notNull(),
  position: doublePrecision('position').notNull(),
  indent: smallint('indent').notNull().default(0),
  text: jsonb('text').$type<I18nText>().notNull(),
  hidden: boolean('hidden').notNull().default(false),
  /** Milestones only. */
  days: smallint('days'),
  tone: text('tone').$type<MilestoneTone>(),
  key: text('key'),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})
export type NotebookTemplateItem = typeof notebookTemplateItems.$inferSelect

export const pocProcessItems = pgTable('poc_process_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  pocId: uuid('poc_id').notNull(),
  kind: text('kind').$type<ProcessKind>().notNull(),
  position: doublePrecision('position').notNull(),
  indent: smallint('indent').notNull().default(0),
  text: jsonb('text').$type<I18nText>().notNull(),
  hidden: boolean('hidden').notNull().default(false),
  status: text('status').$type<ProcessStatus>(),
  /** Phases: the template key that ties a phase to its PoC Schedule milestone. */
  key: text('key'),
  updatedBy: uuid('updated_by'),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

// The Data Source Catalog, read from the official documentation.
export const catalogEntries = pgTable('catalog_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind').$type<CatalogKind>().notNull(),
  key: text('key').notNull(),
  name: text('name').notNull(),
  port: text('port').notNull().default(''),
  category: text('category').notNull().default(''),
  source: text('source').notNull().default(''),
  detail: text('detail').notNull().default(''),
  docUrl: text('doc_url').notNull().default(''),
  firstSeenAt: ts('first_seen_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
  removedAt: ts('removed_at'),
})

export const pocDataSources = pgTable('poc_data_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  pocId: uuid('poc_id').notNull(),
  kind: text('kind').$type<CatalogKind>().notNull(),
  catalogId: uuid('catalog_id'),
  name: text('name').notNull(),
  port: text('port').notNull().default(''),
  status: text('status').$type<DataSourceStatus>(),
  notes: text('notes').notNull().default(''),
  position: doublePrecision('position').notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

export const pocMilestones = pgTable('poc_milestones', {
  id: uuid('id').primaryKey().defaultRandom(),
  pocId: uuid('poc_id').notNull(),
  position: doublePrecision('position').notNull(),
  key: text('key'),
  text: jsonb('text').$type<I18nText>().notNull(),
  days: smallint('days').notNull().default(2),
  tone: text('tone').$type<MilestoneTone>().notNull().default('poc'),
  dateOverride: date('date_override'),
  /** The PoC Process phase this milestone stands for; NULL for the start day or a milestone added by hand. */
  phaseId: uuid('phase_id'),
  updatedBy: uuid('updated_by'),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

// Stellar Experiences (migration 0019, ADR 0014).
export const experiences = pgTable('experiences', {
  id: uuid('id').primaryKey().defaultRandom(),
  pocId: uuid('poc_id').notNull(),
  name: text('name').notNull(),
  profile: text('profile').$type<AudienceProfile>().notNull(),
  status: text('status').$type<ExperienceStatus>().notNull().default('disabled'),
  /** The Stage ids chosen, in pipeline order. */
  stages: jsonb('stages').$type<StageId[]>().notNull(),
  /** The Presenter's Stage. */
  currentStage: text('current_stage').$type<StageId>().notNull(),
  /** Whether that Stage shows its Briefing or its question. */
  currentPhase: text('current_phase').$type<StagePhase>().notNull().default('briefing'),
  /** The Briefing topics the Presenter has opened on the current Stage. */
  briefingOpen: jsonb('briefing_open').$type<BriefingSection[]>().notNull().default([]),
  /** The 3D interaction model and the object the Presenter entered. */
  scene: jsonb('scene').$type<SceneState>().notNull().default({ model: 'chamber', target: null }),
  /** The Presenter's screen beyond the Stage (migration 0023); rows written before a field existed lack it: read through `viewOf`. */
  view: jsonb('view').$type<Partial<ExperienceView>>().notNull().default({ panel: true, spot: null, replay: 0 }),
  createdBy: uuid('created_by'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
  finishedAt: ts('finished_at'),
})
export type Experience = typeof experiences.$inferSelect

export const experienceAnswers = pgTable('experience_answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  experienceId: uuid('experience_id').notNull(),
  stageId: text('stage_id').$type<StageId>().notNull(),
  userId: uuid('user_id').notNull(),
  value: jsonb('value').$type<AnswerValue>().notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

export const experienceStageResults = pgTable(
  'experience_stage_results',
  {
    experienceId: uuid('experience_id').notNull(),
    stageId: text('stage_id').$type<StageId>().notNull(),
    outcome: text('outcome').$type<'approved' | 'skipped'>().notNull(),
    value: jsonb('value').$type<AnswerValue>(),
    answerIds: jsonb('answer_ids').$type<string[]>().notNull().default([]),
    decidedBy: uuid('decided_by'),
    decidedAt: ts('decided_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.experienceId, t.stageId] })],
)

export const experienceQuestions = pgTable('experience_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  experienceId: uuid('experience_id').notNull(),
  stageId: text('stage_id').$type<StageId>().notNull(),
  userId: uuid('user_id'),
  text: text('text').notNull(),
  reply: text('reply'),
  answeredLive: boolean('answered_live').notNull().default(false),
  repliedBy: uuid('replied_by'),
  repliedAt: ts('replied_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
})

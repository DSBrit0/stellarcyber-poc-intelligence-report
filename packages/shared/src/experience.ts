import { z } from 'zod'
import { CatalogKind, CreateNotebookInput } from './notebook.js'

const Text = (max: number) => z.string().trim().max(max)

/** Disabled → Active → Finished; a Finished Experience can be reopened (CONTEXT.md, "Stellar Experience"). */
export const EXPERIENCE_STATUSES = ['disabled', 'active', 'finished'] as const
export const ExperienceStatus = z.enum(EXPERIENCE_STATUSES)
export type ExperienceStatus = z.infer<typeof ExperienceStatus>

/** Only pre-selects the Stages; the questions are the same. */
export const AUDIENCE_PROFILES = ['technical', 'executive'] as const
export const AudienceProfile = z.enum(AUDIENCE_PROFILES)
export type AudienceProfile = z.infer<typeof AudienceProfile>

/** The three layers of the Multi-Layer AI™ Stack that group the Stages. */
export const CHAPTERS = ['data_engine', 'open_xdr', 'agentic_soc'] as const
export type Chapter = (typeof CHAPTERS)[number]

export const MTTD_PHASES = ['collection', 'triage', 'correlation', 'investigation'] as const
export type MttdPhase = (typeof MTTD_PHASES)[number]

export const FILTER_ACTIONS = ['drop', 'reduce'] as const

export type Question =
  | { kind: 'data_sources' }
  | { kind: 'choice'; multiple: boolean; options: readonly string[] }
  | { kind: 'number'; unit: 'tools' | 'alerts_per_day' | 'minutes'; max: number }
  | { kind: 'items'; max: number }
  | { kind: 'filters'; max: number }
  | { kind: 'mttd' }

/**
 * The Stages in pipeline order. Ids are stable: an Experience stores the ids it was enabled with, so
 * renaming or reordering here never changes one already run (plan, Q25).
 */
export const STAGES = [
  { id: 'data_sources', chapter: 'data_engine', question: { kind: 'data_sources' } },
  { id: 'collection', chapter: 'data_engine', question: { kind: 'choice', multiple: true, options: ['on_prem', 'aws', 'azure', 'gcp', 'm365', 'google_workspace', 'saas', 'ot', 'branch_offices'] } },
  { id: 'normalization', chapter: 'data_engine', question: { kind: 'number', unit: 'tools', max: 100 } },
  { id: 'threat_intel', chapter: 'data_engine', question: { kind: 'choice', multiple: true, options: ['commercial', 'open_source', 'misp', 'isac', 'government', 'none'] } },
  { id: 'enrichment', chapter: 'data_engine', question: { kind: 'items', max: 10 } },
  { id: 'ingestion_filters', chapter: 'data_engine', question: { kind: 'filters', max: 3 } },
  { id: 'data_lake', chapter: 'data_engine', question: { kind: 'choice', multiple: false, options: ['d30', 'd90', 'd180', 'y1', 'y2_plus'] } },
  { id: 'ndr', chapter: 'open_xdr', question: { kind: 'choice', multiple: false, options: ['full', 'partial', 'none'] } },
  { id: 'sandbox', chapter: 'open_xdr', question: { kind: 'choice', multiple: true, options: ['email', 'web', 'file_share', 'usb', 'endpoint'] } },
  { id: 'fim', chapter: 'open_xdr', question: { kind: 'items', max: 10 } },
  {
    id: 'itdr_ueba',
    chapter: 'open_xdr',
    question: { kind: 'choice', multiple: true, options: ['impossible_travel', 'privilege_escalation', 'lateral_movement', 'data_exfiltration', 'off_hours', 'service_account', 'brute_force', 'insider'] },
  },
  { id: 'detection', chapter: 'open_xdr', question: { kind: 'mttd' } },
  { id: 'correlation', chapter: 'open_xdr', question: { kind: 'number', unit: 'alerts_per_day', max: 10_000_000 } },
  { id: 'agentic_soc', chapter: 'agentic_soc', question: { kind: 'number', unit: 'minutes', max: 10_000 } },
  {
    id: 'response',
    chapter: 'agentic_soc',
    question: { kind: 'choice', multiple: true, options: ['block_ip', 'isolate_host', 'disable_user', 'quarantine_email', 'reset_password', 'open_ticket', 'notify_team'] },
  },
] as const satisfies readonly { id: string; chapter: Chapter; question: Question }[]

export type StageId = (typeof STAGES)[number]['id']
export const STAGE_IDS = STAGES.map((s) => s.id) as [StageId, ...StageId[]]
export const StageId = z.enum(STAGE_IDS)

export const stageById = (id: StageId) => STAGES.find((s) => s.id === id)!

const EXECUTIVE_STAGES: readonly StageId[] = ['data_sources', 'detection', 'correlation', 'agentic_soc', 'response']
export const stagesForProfile = (profile: AudienceProfile): StageId[] => (profile === 'technical' ? [...STAGE_IDS] : STAGE_IDS.filter((id) => EXECUTIVE_STAGES.includes(id)))

/** A Stage selection in pipeline order, without repeats. */
export const StageSelection = z
  .array(StageId)
  .min(1)
  .transform((ids) => STAGE_IDS.filter((id) => ids.includes(id)))

/** A question whose approved Answer may merge several participants' Answers. */
export const isListQuestion = (q: Question) => q.kind === 'data_sources' || q.kind === 'items' || q.kind === 'filters' || (q.kind === 'choice' && q.multiple)

const ExperienceDataSource = z
  .object({ kind: CatalogKind, catalogId: z.uuid().nullable().default(null), name: Text(300).min(1) })
  .strict()
export type ExperienceDataSource = z.infer<typeof ExperienceDataSource>

const IngestionFilter = z.object({ source: Text(300).min(1), eventType: Text(300).min(1), action: z.enum(FILTER_ACTIONS) }).strict()
export type IngestionFilter = z.infer<typeof IngestionFilter>

const Minutes = z.number().min(0).max(1_000_000)

/** The schema of an Answer's value for a question. */
export function answerSchema(q: Question) {
  switch (q.kind) {
    case 'data_sources':
      return z.object({ sources: z.array(ExperienceDataSource).min(1).max(50) }).strict()
    case 'choice':
      return z
        .object({ options: z.array(z.enum(q.options as unknown as [string, ...string[]])).min(1).max(q.multiple ? q.options.length : 1) })
        .strict()
        .transform((v) => ({ options: q.options.filter((o) => v.options.includes(o)) }))
    case 'number':
      return z.object({ value: z.number().min(0).max(q.max) }).strict()
    case 'items':
      return z
        .object({ items: z.array(Text(200)).max(q.max) })
        .strict()
        .transform((v) => ({ items: v.items.filter(Boolean) }))
        .refine((v) => v.items.length > 0, { message: 'empty' })
    case 'filters':
      return z.object({ filters: z.array(IngestionFilter).min(1).max(q.max) }).strict()
    case 'mttd':
      return z
        .object({ mttdHours: z.number().min(0).max(100_000), phases: z.object({ collection: Minutes, triage: Minutes, correlation: Minutes, investigation: Minutes }).strict() })
        .strict()
  }
}

export type DataSourcesValue = { sources: ExperienceDataSource[] }
export type ChoiceValue = { options: string[] }
export type NumberValue = { value: number }
export type ItemsValue = { items: string[] }
export type FiltersValue = { filters: IngestionFilter[] }
export type MttdValue = { mttdHours: number; phases: Record<MttdPhase, number> }
export type AnswerValue = DataSourcesValue | ChoiceValue | NumberValue | ItemsValue | FiltersValue | MttdValue

const dedupe = <T>(items: T[], key: (t: T) => string) => {
  const seen = new Set<string>()
  return items.filter((t) => {
    const k = key(t)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * The Approved Answer from the Answers chosen: a list question merges them (in the order given), any
 * other question takes exactly one. Returns null when the choice is not allowed.
 */
export function mergeAnswers(q: Question, values: AnswerValue[]): AnswerValue | null {
  if (values.length === 0) return null
  if (!isListQuestion(q)) return values.length === 1 ? values[0]! : null
  switch (q.kind) {
    case 'data_sources': {
      const sources = dedupe(
        (values as DataSourcesValue[]).flatMap((v) => v.sources),
        (s) => s.catalogId ?? `${s.kind}:${s.name.toLowerCase()}`,
      )
      return { sources: sources.slice(0, 50) }
    }
    case 'choice': {
      const chosen = new Set((values as ChoiceValue[]).flatMap((v) => v.options))
      return { options: q.options.filter((o) => chosen.has(o)) }
    }
    case 'items':
      return { items: dedupe((values as ItemsValue[]).flatMap((v) => v.items), (s) => s.toLowerCase()).slice(0, q.max) }
    case 'filters': {
      const filters = dedupe((values as FiltersValue[]).flatMap((v) => v.filters), (f) => `${f.source}|${f.eventType}|${f.action}`.toLowerCase())
      // A list longer than the question allows cannot be approved: the approver picks fewer.
      return filters.length <= q.max ? { filters } : null
    }
    default:
      return null
  }
}

/** Detection gain: the minutes of the manual phases Stellar Cyber automates, from the Customer's own figures. */
export const AUTOMATED_MTTD_PHASES: readonly MttdPhase[] = ['collection', 'triage', 'correlation']
export const automatedMinutes = (v: MttdValue) => AUTOMATED_MTTD_PHASES.reduce((sum, p) => sum + v.phases[p], 0)

export const CreateExperienceInput = z.object({ name: Text(80).min(1), profile: AudienceProfile })
/** "Stellar Experience" on New PoC: a PoC Notebook started together with its first Experience. */
export const CreateNotebookStartInput = CreateNotebookInput.extend({ experience: CreateExperienceInput.optional() })
export const UpdateExperienceInput = z
  .object({ name: Text(80).min(1).optional(), stages: StageSelection.optional(), status: ExperienceStatus.optional() })
  .refine((v) => v.name !== undefined || v.stages !== undefined || v.status !== undefined, { message: 'empty' })
/** A Stage shows its Briefing first; the Presenter then opens its question. */
export const STAGE_PHASES = ['briefing', 'question'] as const
export const StagePhase = z.enum(STAGE_PHASES)
export type StagePhase = z.infer<typeof StagePhase>
export const PhaseInput = z.object({ phase: StagePhase })

/** The topics of a Briefing, in order. They start summarized; the Presenter opens them while explaining. */
export const BRIEFING_SECTIONS = ['how', 'value', 'objectives', 'frameworks', 'techniques'] as const
export const BriefingSection = z.enum(BRIEFING_SECTIONS)
export type BriefingSection = z.infer<typeof BriefingSection>
export const BriefingInput = z.object({ open: z.array(BriefingSection).max(BRIEFING_SECTIONS.length) })

/**
 * The two ways to go inside the Stack: the Engine Chamber shows one engine at work on a raw record;
 * the Record Trace follows one record through every engine up to a Case (CONTEXT.md).
 */
export const SCENE_MODELS = ['chamber', 'trace'] as const
export const SceneModel = z.enum(SCENE_MODELS)
export type SceneModel = z.infer<typeof SceneModel>
/** The object the Presenter entered: a Data Source tile (by name) or a Stage's plate. */
export const SceneTarget = z.object({ kind: z.enum(['source', 'stage']), key: Text(300).min(1) })
export type SceneTarget = z.infer<typeof SceneTarget>
export const SceneState = z.object({ model: SceneModel, target: SceneTarget.nullable() })
export type SceneState = z.infer<typeof SceneState>

/**
 * The rest of the Presenter's screen, mirrored on every participant's: the side panel open or folded,
 * the Spotlight (the item the Presenter points at, by its spot id, such as `if:field:src_ip`) and
 * how many times the Record Trace was replayed.
 */
export const ExperienceView = z.object({ panel: z.boolean(), spot: Text(200).min(1).nullable(), replay: z.number().int().min(0) })
export type ExperienceView = z.infer<typeof ExperienceView>
export const DEFAULT_VIEW: ExperienceView = { panel: true, spot: null, replay: 0 }
export const ViewInput = z
  .object({ panel: z.boolean().optional(), spot: Text(200).min(1).nullable().optional(), replay: z.literal(true).optional() })
  .refine((v) => v.panel !== undefined || v.spot !== undefined || v.replay !== undefined, { message: 'empty' })
export type ViewInput = z.infer<typeof ViewInput>
/** The view after a Presenter's change: what the change leaves out stays; a replay counts one more. */
export const applyView = (view: ExperienceView, input: ViewInput): ExperienceView => ({
  panel: input.panel ?? view.panel,
  spot: input.spot === undefined ? view.spot : input.spot,
  replay: view.replay + (input.replay ? 1 : 0),
})

export const CustomerQuestionInput = z.object({ text: Text(1000).min(1) })
/** The Sales Engineer's follow-up: a written Reply (null clears it) or "answered live". */
export const ReplyInput = z
  .object({ reply: Text(2000).nullable().optional(), answeredLive: z.boolean().optional() })
  .refine((v) => v.reply !== undefined || v.answeredLive !== undefined, { message: 'empty' })

export const AnswerInput = z.object({ value: z.unknown() })
export const ApproveInput = z.object({ answerIds: z.array(z.uuid()).min(1).max(50) })
export const GoToStageInput = z.object({ stageId: StageId })

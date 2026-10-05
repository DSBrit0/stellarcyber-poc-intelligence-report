import { z } from 'zod'
import { InstanceUrl } from './auth.js'
import { EmailField, LineField, PersonContact, PersonNameField, UrlField } from './fields.js'
import { PocDetails, PocPeriod } from './poc.js'

const Text = (max: number) => z.string().trim().max(max)
const IsoDate = z.iso.date()

/**
 * A PATCH schema from a shape: every field optional and without its default. Zod applies a field's
 * default even inside .partial(), which would overwrite what the request did not send.
 */
const patchOf = <S extends z.ZodRawShape>(shape: S) =>
  z.object(Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, ((v instanceof z.ZodDefault ? v.unwrap() : v) as z.ZodType).optional()]))) as unknown as z.ZodObject<{
    [K in keyof S]: z.ZodOptional<S[K] extends z.ZodDefault<infer T> ? T : S[K]>
  }>

/** A Notebook's own fields; the customer, contacts and success criteria are the PoC's (ADR 0010). */
export const NotebookOverview = z.object({
  /** POC Start Day: the PoC Schedule is computed from it. */
  startDate: IsoDate,
  sizingGbDay: z.number().min(0).max(1_000_000).nullable().default(null),
  pocUrl: UrlField.default(''),
  businessContact: PersonContact.default({ name: '', email: '', phone: '' }),
  technicalContact: PersonContact.default({ name: '', email: '', phone: '' }),
  businessRequirements: Text(4000).default(''),
})
export type NotebookOverview = z.infer<typeof NotebookOverview>

/**
 * The PoC details a Notebook edits, every field typed and normalised; Verdict, comments and effort
 * belong to the Report.
 */
export const NotebookDetails = z.object({
  customerName: LineField(160).pipe(z.string().min(1)),
  department: LineField(160).default(''),
  customerEmail: EmailField.default(''),
  analysts: z
    .array(PersonNameField)
    .max(50)
    .transform((names) => names.filter(Boolean))
    .default([]),
  salesEngineer: PersonContact.default({ name: '', email: '', phone: '' }),
  partner: z.object({ name: PersonNameField.default(''), email: EmailField.default(''), site: UrlField.default('') }).default({ name: '', email: '', site: '' }),
})
export type NotebookDetails = z.infer<typeof NotebookDetails>
/** What a Notebook shows of the PoC details, as stored (older values may predate the typed fields). */
export const NotebookDetailsView = PocDetails.pick({ customerName: true, department: true, customerEmail: true, analysts: true, salesEngineer: true, partner: true })

export const CreateNotebookInput = z.object({
  customerId: z.uuid(),
  startDate: IsoDate,
  customerName: Text(160).min(1).optional(),
})

export const UpdateNotebookInput = z.object({
  overview: patchOf(NotebookOverview.shape).optional(),
  details: patchOf(NotebookDetails.shape).optional(),
})

export const CRITERION_STATUSES = ['completed_success', 'completed_partial', 'completed_failed', 'ticket_open'] as const
export const CriterionStatus = z.enum(CRITERION_STATUSES)
export type CriterionStatus = z.infer<typeof CriterionStatus>

export const CriterionInput = z.object({
  text: Text(1000).min(1),
  status: CriterionStatus.nullable().default(null),
  notes: Text(4000).default(''),
  weight: z.number().int().min(1).max(5).nullable().default(null),
})
export const CriterionPatch = patchOf(CriterionInput.shape)

export const MeetingInput = z.object({
  date: IsoDate.nullable().default(null),
  link: Text(1000).default(''),
  passcode: Text(200).default(''),
  notes: Text(20_000).default(''),
  nextSteps: Text(4000).default(''),
})
export const MeetingPatch = patchOf(MeetingInput.shape)

export const PROCESS_STATUSES = ['in_progress', 'completed', 'na'] as const
export const ProcessStatus = z.enum(PROCESS_STATUSES)
export type ProcessStatus = z.infer<typeof ProcessStatus>
export const PROCESS_KINDS = ['phase', 'group', 'item', 'note'] as const
export const ProcessKind = z.enum(PROCESS_KINDS)
export type ProcessKind = z.infer<typeof ProcessKind>

/** Template text: pt-BR is required; en and es fall back to it when blank (ADR 0012). */
export const I18nText = z.object({ 'pt-BR': Text(2000).min(1), en: Text(2000).default(''), es: Text(2000).default('') })
export type I18nText = z.infer<typeof I18nText>

/** Filling in: any Notebook editor. */
export const ProcessFill = z.object({ status: ProcessStatus.nullable() })
/** Shaping: the Notebook's Sales Engineer, Owner or an Admin. */
export const ProcessShape = z.object({ text: I18nText.optional(), hidden: z.boolean().optional(), kind: ProcessKind.optional(), indent: z.number().int().min(0).max(1).optional() })
export const ProcessAdd = z.object({ afterId: z.uuid().nullable(), kind: ProcessKind.default('item'), text: I18nText, indent: z.number().int().min(0).max(1).default(0) })

/** "Create the Final Report" on a Notebook: the Report target the PoC lacked until now. */
export const ReportTargetInput = z.object({
  instanceUrl: InstanceUrl,
  tenant: z.object({ id: Text(128).min(1), name: Text(200).default('') }),
  period: PocPeriod,
})

export const CATALOG_KINDS = ['parser', 'connector'] as const
export const CatalogKind = z.enum(CATALOG_KINDS)
export type CatalogKind = z.infer<typeof CatalogKind>

export const DATA_SOURCE_STATUSES = ['in_progress', 'ingesting', 'ticket_open'] as const
export const DataSourceStatus = z.enum(DATA_SOURCE_STATUSES)
export type DataSourceStatus = z.infer<typeof DataSourceStatus>

/** A Data Source or Connector of a Notebook: from the catalog, or typed when the catalog lacks it. */
export const DataSourceInput = z
  .object({
    kind: CatalogKind,
    catalogId: z.uuid().nullable().default(null),
    name: Text(300).default(''),
    port: Text(80).default(''),
  })
  .refine((d) => d.catalogId != null || d.name.length > 0, { message: 'name_required', path: ['name'] })
export const DataSourcePatch = z.object({ status: DataSourceStatus.nullable().optional(), notes: Text(4000).optional(), port: Text(80).optional() })

/** The two documentation pages the Data Source Catalog is read from. */
export const CatalogSources = z.object({ parsersUrl: z.url(), connectorsUrl: z.url() })
export type CatalogSources = z.infer<typeof CatalogSources>

/** Colour group of a milestone: start day, before the PoC, PoC meetings, closeout. */
export const MILESTONE_TONES = ['start', 'pre', 'poc', 'close'] as const
export const MilestoneTone = z.enum(MILESTONE_TONES)
export type MilestoneTone = z.infer<typeof MilestoneTone>

/** Shaping the PoC Schedule (its SE, Owner or an Admin): days to the next milestone, a date by hand, the name. */
export const MilestonePatch = z.object({
  days: z.number().int().min(0).max(60).optional(),
  dateOverride: IsoDate.nullable().optional(),
  text: I18nText.optional(),
  tone: MilestoneTone.optional(),
})
export const MilestoneAdd = z.object({ afterId: z.uuid().nullable(), text: I18nText, days: z.number().int().min(0).max(60).default(2), tone: MilestoneTone.default('poc') })

/** Notebook Template editing (Admin, ADR 0012); changes reach only the Notebooks started afterwards. */
export const TEMPLATE_SECTIONS = ['process', 'schedule'] as const
export const TemplateSection = z.enum(TEMPLATE_SECTIONS)
export type TemplateSection = z.infer<typeof TemplateSection>
export const TemplatePatch = z.object({
  text: I18nText.optional(),
  hidden: z.boolean().optional(),
  kind: ProcessKind.optional(),
  indent: z.number().int().min(0).max(1).optional(),
  days: z.number().int().min(0).max(60).optional(),
  tone: MilestoneTone.optional(),
})
export const TemplateAdd = z.object({
  section: TemplateSection,
  afterId: z.uuid().nullable(),
  kind: z.enum(['phase', 'group', 'item', 'note', 'milestone']),
  text: I18nText,
  indent: z.number().int().min(0).max(1).default(0),
  days: z.number().int().min(0).max(60).default(2),
  tone: MilestoneTone.default('poc'),
  /** A new phase gets its PoC Schedule milestone too. */
  withMilestone: z.boolean().default(true),
})
export const TemplateMove = z.object({ direction: z.enum(['up', 'down']) })

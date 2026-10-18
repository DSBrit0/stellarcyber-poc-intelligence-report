import { z } from 'zod'
import { InstanceUrl } from './auth.js'
import { CompanyProfile, MAX_POC_DAYS } from './domain.js'
import { EmailField, PersonContact, PersonNameField, UrlField } from './fields.js'

const IsoDate = z.iso.date()
const Text = (max: number) => z.string().trim().max(max)

const Contact = z.object({
  name: Text(120).default(''),
  email: Text(254).default(''),
  phone: Text(40).default(''),
})

const Partner = z.object({
  name: Text(120).default(''),
  email: Text(254).default(''),
  site: Text(254).default(''),
})

export const VERDICTS = ['approved', 'conditional', 'rejected'] as const

/** Analyst-effort assumptions for the Executive "effort avoided" estimate, in minutes (monthHours in hours). */
export const EFFORT_DEFAULTS = { alertMin: 4, critHighMin: 120, mediumMin: 20, lowMin: 2, monthHours: 160 } as const

/** PoC details typed by the Owner. Editable at any time; a Report always shows the current values. */
export const PocDetails = z.object({
  customerName: Text(160).min(1),
  department: Text(160).default(''),
  customerEmail: Text(254).default(''),
  /** Stakeholders on the customer side. */
  analysts: z.array(Text(60)).max(50).default([]),
  /** Free text; items are separated by ";" or new lines. */
  successCriteria: Text(550).default(''),
  salesEngineer: Contact.default({ name: '', email: '', phone: '' }),
  partner: Partner.default({ name: '', email: '', site: '' }),
  platformVersion: Text(40).default(''),
  region: Text(80).default(''),
  /** Report document version shown on the cover and in Appendix B. */
  version: Text(20).default('1.0'),
  verdict: z.enum(VERDICTS).nullable().default(null),
  comments: Text(1500).default(''),
  /** The SE validated Stellar Cyber AI Triage during the PoC: the Sync then collects the AI verdicts. */
  aiTriageTested: z.boolean().default(false),
  effort: z
    .object({
      alertMin: z.number().min(0).max(1440).default(EFFORT_DEFAULTS.alertMin),
      critHighMin: z.number().min(0).max(14400).default(EFFORT_DEFAULTS.critHighMin),
      mediumMin: z.number().min(0).max(14400).default(EFFORT_DEFAULTS.mediumMin),
      lowMin: z.number().min(0).max(14400).default(EFFORT_DEFAULTS.lowMin),
      monthHours: z.number().min(1).max(744).default(EFFORT_DEFAULTS.monthHours),
    })
    .default({ ...EFFORT_DEFAULTS }),
})
export type PocDetails = z.infer<typeof PocDetails>

export const PocPeriod = z
  .object({ start: IsoDate, end: IsoDate })
  .refine((p) => p.start <= p.end, 'period.order')
  .refine(
    (p) => (Date.parse(p.end) - Date.parse(p.start)) / 86_400_000 + 1 <= MAX_POC_DAYS,
    'period.tooLong',
  )
export type PocPeriod = z.infer<typeof PocPeriod>

/**
 * PoC details as typed in a form: e-mails, phones, people's names and web addresses are normalised and
 * validated. Stored details are read with the lenient PocDetails, so older values still load.
 */
export const PocDetailsInput = PocDetails.extend({
  customerEmail: EmailField.default(''),
  analysts: z
    .array(PersonNameField)
    .max(50)
    .transform((names) => names.filter(Boolean))
    .default([]),
  salesEngineer: PersonContact.default({ name: '', email: '', phone: '' }),
  partner: z.object({ name: PersonNameField.default(''), email: EmailField.default(''), site: UrlField.default('') }).default({ name: '', email: '', site: '' }),
})

export const CreatePocInput = z.object({
  instanceUrl: InstanceUrl,
  customerId: z.uuid().nullable().optional(),
  /** Created by "Run Sync" before the details are filled in. */
  draft: z.boolean().optional(),
  tenant: z.object({ id: Text(128).min(1), name: Text(200).default('') }),
  period: PocPeriod,
  details: PocDetailsInput,
})
export type CreatePocInput = z.infer<typeof CreatePocInput>

export const UpdatePocInput = z.object({
  period: PocPeriod.optional(),
  details: PocDetailsInput.optional(),
  customerId: z.uuid().nullable().optional(),
  /** Saving the details completes a Draft PoC. */
  finalize: z.boolean().optional(),
})

/** How a Closed PoC ended commercially; not the Verdict, which is the technical outcome. */
export const DEAL_RESULTS = ['won', 'lost', 'no_decision'] as const
export const DealResult = z.enum(DEAL_RESULTS)
export type DealResult = z.infer<typeof DealResult>
export const ClosePocInput = z.object({ dealResult: DealResult })

/** Customer company name: matching ignores case and repeated spaces. */
export const customerNameKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ')

export const CreateCustomerInput = z.object({
  name: z.string().trim().min(2).max(160),
  instanceUrl: InstanceUrl.nullable().optional(),
  profile: CompanyProfile.default('customer'),
})
export const UpdateCustomerInput = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  instanceUrl: InstanceUrl.nullable().optional(),
  profile: CompanyProfile.optional(),
})

export const CommentKind = z.enum(['internal', 'report'])
export type CommentKind = z.infer<typeof CommentKind>
export const CommentInput = z
  .object({ body: z.string().trim().min(1).max(4000), kind: CommentKind.default('internal'), private: z.boolean().default(false) })
  // A Report comment is printed in the Report the Customer downloads, so it cannot be private.
  .refine((c) => !(c.private && c.kind === 'report'), { message: 'private_report_comment', path: ['private'] })

/** Architecture image as a data: URL (JPEG or PNG, resized in the browser). */
export const ArchImageInput = z.object({
  dataUrl: z
    .string()
    .max(3_000_000)
    .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/)
    .nullable(),
})

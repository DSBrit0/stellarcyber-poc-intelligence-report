import { z } from 'zod'
import { InstanceUrl } from './auth.js'
import { MAX_POC_DAYS } from './domain.js'

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

export const CreatePocInput = z.object({
  instanceUrl: InstanceUrl,
  tenant: z.object({ id: Text(128).min(1), name: Text(200).default('') }),
  period: PocPeriod,
  details: PocDetails,
})
export type CreatePocInput = z.infer<typeof CreatePocInput>

export const UpdatePocInput = z.object({
  period: PocPeriod.optional(),
  details: PocDetails.optional(),
})

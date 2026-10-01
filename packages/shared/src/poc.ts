import { z } from 'zod'
import { InstanceUrl } from './auth.js'
import { MAX_POC_DAYS } from './domain.js'

const IsoDate = z.iso.date()
const Text = (max: number) => z.string().trim().max(max)

const Contact = z.object({
  name: Text(120).default(''),
  email: Text(254).default(''),
  phone: Text(40).default(''),
  company: Text(120).default(''),
})

export const VERDICTS = ['approved', 'conditional', 'rejected'] as const

/** PoC details typed by the Owner. Editable at any time; a Report always shows the current values. */
export const PocDetails = z.object({
  customerName: Text(160).min(1),
  department: Text(160).default(''),
  customerEmail: Text(254).default(''),
  analysts: z.array(Text(120)).max(50).default([]),
  successCriteria: z.array(Text(500)).max(50).default([]),
  salesEngineer: Contact.default({ name: '', email: '', phone: '', company: '' }),
  partner: Contact.default({ name: '', email: '', phone: '', company: '' }),
  platformVersion: Text(40).default(''),
  region: Text(80).default(''),
  verdict: z.enum(VERDICTS).nullable().default(null),
  comments: Text(5000).default(''),
  effortPremises: z
    .object({
      minutesPerAlert: z.number().min(0).max(240).default(5),
      minutesPerCase: z.number().min(0).max(1440).default(30),
    })
    .default({ minutesPerAlert: 5, minutesPerCase: 30 }),
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

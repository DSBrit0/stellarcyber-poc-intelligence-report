import { z } from 'zod'

const Env = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  APP_ORIGIN: z.url(),
  DATABASE_URL: z.string().min(1),
  ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'ENCRYPTION_KEY must be 32 bytes, base64'),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(12),
  SESSION_IDLE_MINUTES: z.coerce.number().positive().default(30),
  DATA_DIR: z.string().default('./data'),
  /** Where backup.sh writes its dumps, mounted read-only into the API for the Admin download. */
  BACKUP_DIR: z.string().default('./backups'),
  STELLAR_ALLOWED_PRIVATE_CIDRS: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
  SMTP_HOST: z.string().default(''),
  /** First password of the Root Administrator on a fresh installation (ADR 0013). */
  // Blank (as in .env.example) means unset.
  ROOT_PASSWORD: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(12).max(128).optional()),
})

export type Config = z.infer<typeof Env>

let cached: Config | undefined

export function config(): Config {
  if (!cached) {
    const parsed = Env.safeParse(process.env)
    if (!parsed.success) {
      console.error('Invalid environment:\n' + z.prettifyError(parsed.error))
      process.exit(1)
    }
    cached = parsed.data
  }
  return cached
}

import { z } from 'zod'

export const ROLES = ['admin', 'sales_engineer', 'partner'] as const
export const Role = z.enum(ROLES)
export type Role = z.infer<typeof Role>

/** pending: Registration awaiting an Admin. active: can sign in. */
export const USER_STATUSES = ['pending', 'active', 'rejected', 'disabled'] as const
export const UserStatus = z.enum(USER_STATUSES)
export type UserStatus = z.infer<typeof UserStatus>

export const LOCALES = ['pt-BR', 'en', 'es'] as const
export const Locale = z.enum(LOCALES)
export type Locale = z.infer<typeof Locale>
export const DEFAULT_LOCALE: Locale = 'pt-BR'

export const TEMPLATES = ['technical', 'executive', 'insight'] as const
export const Template = z.enum(TEMPLATES)
export type Template = z.infer<typeof Template>

export const SYNC_STATUSES = ['queued', 'running', 'succeeded', 'failed'] as const
export const SyncStatus = z.enum(SYNC_STATUSES)
export type SyncStatus = z.infer<typeof SyncStatus>

/** Longest PoC period the Stellar Cyber API can serve for daily series (daily_count accepts 1–31 days). */
export const MAX_POC_DAYS = 30

export const DEFAULT_RETENTION_DAYS = 90

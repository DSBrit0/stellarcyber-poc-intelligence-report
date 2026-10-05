import type { Role } from '@poc-intel/shared'
import type { MessageKey } from '@poc-intel/shared/i18n'

/**
 * The User Guide (the Help page). Each locale writes its own text; the names of buttons, tabs and
 * fields come from the app's catalogue through `ui()`, so the guide always says what the screen says.
 * Inline markup: **text** is a screen label, `text` is something the person types.
 */
export type HelpBlock =
  | { kind: 'p'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'steps'; items: string[] }
  | { kind: 'list'; items: string[] }
  | { kind: 'tip'; text: string }
  | { kind: 'warn'; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }

export interface HelpSection {
  id: string
  title: string
  /** The Roles this topic is written for; the page shows the reader's topics first. */
  roles: readonly Role[] | 'all'
  summary: string
  blocks: HelpBlock[]
}

export interface HelpGuide {
  sections: HelpSection[]
}

/** A screen label from the catalogue, marked up as **label**. */
export type Ui = (key: MessageKey, vars?: Record<string, string | number>) => string

export const STAFF = ['admin', 'sales_engineer', 'partner'] as const
export const OWNERS = ['admin', 'sales_engineer'] as const

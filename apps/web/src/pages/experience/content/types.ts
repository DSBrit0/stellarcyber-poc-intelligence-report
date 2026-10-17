import type { Chapter, FILTER_ACTIONS, MttdPhase, STAGES, StageId } from '@poc-intel/shared'

/**
 * The words of a Stellar Experience, one file per locale (like the User Guide). Option labels are
 * typed from the Stage definitions, so a new option cannot ship without its label in every locale.
 * Every technical statement here is to be reviewed by the product owner before a customer sees it.
 */
interface StageWords {
  title: string
  /** One or two sentences on what this part of the platform does. */
  lead: string
  question: string
  hint?: string
}

type Stage = (typeof STAGES)[number]
type OptionWords<Q> = Q extends { kind: 'choice'; options: readonly (infer O extends string)[] } ? { options: Record<O, string> } : unknown

export type StagesWords = { [S in Stage as S['id']]: StageWords & OptionWords<S['question']> }

export interface ExperienceWords {
  chapters: Record<Chapter, { title: string; summary: string }>
  stages: StagesWords
  mttdPhases: Record<MttdPhase, string>
  filterActions: Record<(typeof FILTER_ACTIONS)[number], string>
  briefings: Briefings
}

/** The words of a Stage's Briefing; its framework and ATT&CK references live in briefing-refs.ts. */
export interface BriefingWords {
  /** How the technology works, technically. */
  how: string[]
  /** What it changes in the SOC's operation. */
  value: string[]
  /** The SOC objectives it serves, as short phrases. */
  objectives: string[]
  /** One sentence introducing the ATT&CK techniques. */
  techniquesLead: string
}

export type Briefings = Record<StageId, BriefingWords>

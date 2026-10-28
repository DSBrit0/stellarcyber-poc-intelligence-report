import type { Chapter, FILTER_ACTIONS, MttdPhase, STAGES, StackChapter, StageId } from '@poc-intel/shared'

/**
 * The words of a Stellar Experience, one file per locale (like the User Guide). Option labels are
 * typed from the Stage definitions, so a new option cannot ship without its label in every locale.
 * Every technical statement here is to be reviewed by the product owner before a customer sees it.
 */
interface StageWords {
  title: string
  /** One or two sentences on what this part of the platform does. */
  lead: string
}

type Stage = (typeof STAGES)[number]
/** A Stage that asks no question (the Closing) has no question words. */
type QuestionWords<Q> = Q extends { kind: 'none' } ? unknown : { question: string; hint?: string }
type OptionWords<Q> = Q extends { kind: 'choice'; options: readonly (infer O extends string)[] } ? { options: Record<O, string> } : unknown

export type StagesWords = { [S in Stage as S['id']]: StageWords & QuestionWords<S['question']> & OptionWords<S['question']> }

/** The labels of the Closing's two diagrams: the deployment topology and the lab (Lab presentation, slides 1–4). */
export interface ClosingWords {
  topology: {
    environment: string
    sensor: string
    sensorNote: string
    api: string
    normalization: string
    platform: string
    response: string
    nodes: { firewall: string; switch: string; virtual: string; servers: string; pc: string; mac: string }
    links: { spanPort: string; syslog: string; serverSensor: string; connector: string }
    /** The API-integrated tool families (cloud tiles). */
    apis: { identity: string; edr: string; paas: string; vulnerability: string; firewalls: string; saas: string }
  }
  lab: {
    network: string
    sensorPort: string
    /** The lab drawing's link labels. */
    links: { logs: string; api: string; caldera: string }
    disableUser: string
    isolateHost: string
    attack: string
    attackFrom: string
    /** The Caldera chain, in order (slide 3). */
    steps: [string, string, string, string, string, string, string, string]
    access: { title: string; user: string; userValue: string; code: string; open: string }
    /** Who is in the session, so the Presenter can invite them; each Customer User confirms with a thumbs-up. */
    participants: {
      title: string
      presenter: string
      you: string
      offline: string
      confirmed: string
      pending: string
      confirm: string
      undo: string
      copy: string
      copyAll: string
      copied: string
      empty: string
    }
  }
}

/** The Stack scene's own labels: each layer's mission (data sheet) and the source families shown before any Data Source is approved. */
export interface SceneWords {
  missions: Record<StackChapter, string>
  defaultSources: [string, string, string, string, string, string]
}

/** The names floating above the Stack: everyone in the session but the Presenter, and whether they are looking. */
export interface AudienceWords {
  /** Shown beside a name while that person is not looking (away or gone). */
  away: string
  /** Tooltips: page hidden, window out of focus or pointer off the page; or no sign for 30 s. */
  awayHint: string
  leftHint: string
  you: string
  /** "+{n}" when more people are in the session than names fit. */
  more: string
}

export interface ExperienceWords {
  chapters: Record<Chapter, { title: string; summary: string }>
  scene: SceneWords
  audience: AudienceWords
  stages: StagesWords
  closing: ClosingWords
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

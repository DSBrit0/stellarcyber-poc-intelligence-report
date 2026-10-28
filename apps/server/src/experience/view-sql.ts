import type { ViewInput } from '@poc-intel/shared'
import { sql, type SQL } from 'drizzle-orm'
import { experiences } from '../db/schema.js'

/**
 * The Presenter's view as SQL, merged in the database: each change touches only its own keys (jsonb
 * `||`), and a replay is counted there. Reading the row, changing it in JS and writing it back lost
 * updates when two arrived together (the Presenter's hover, scroll and Spotlight are sent separately).
 */
const current = sql`coalesce(${experiences.view}, '{}'::jsonb)`

export function viewPatch(input: ViewInput): SQL {
  let view: SQL = current
  if (input.panel !== undefined) view = sql`${view} || jsonb_build_object('panel', ${input.panel}::boolean)`
  if (input.spot !== undefined) view = sql`${view} || jsonb_build_object('spot', ${input.spot}::text)`
  if (input.layer !== undefined) view = sql`${view} || jsonb_build_object('layer', ${input.layer}::text)`
  if (input.chapter !== undefined) view = sql`${view} || jsonb_build_object('chapter', ${input.chapter}::text)`
  if (input.replay) view = sql`${view} || jsonb_build_object('replay', coalesce((${experiences.view}->>'replay')::int, 0) + 1)`
  if (input.scroll)
    view = sql`${view} || jsonb_build_object('scroll', coalesce(${experiences.view}->'scroll', '{}'::jsonb) || jsonb_build_object(${input.scroll.area}::text, ${input.scroll.ratio}::float8))`
  return view
}

/** New content on screen (another Stage, phase or scene): nothing pointed at or selected, every area at its top. */
export const viewClearFocus = (): SQL => sql`${current} || '{"spot": null, "chapter": null, "scroll": {}}'::jsonb`

/** A Briefing topic just opened is what everyone looks at; folding it lets go of the Spotlight. */
export const viewSpot = (spot: string | null): SQL => sql`${current} || jsonb_build_object('spot', ${spot}::text)`

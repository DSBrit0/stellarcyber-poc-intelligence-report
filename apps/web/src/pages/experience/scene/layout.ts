import { CHAPTERS, stageById, type Chapter, type StageId } from '@poc-intel/shared'

/** Scene units. The Stack climbs on +Y: Data Engine at the base, Agentic SOC on top. */
export const SLAB = { size: 6, thickness: 0.34, gap: 0.68, chapterGap: 1.1 }

/** The engines that orbit their slab as satellites (plan, Q30). */
export const SATELLITE_STAGES: readonly StageId[] = ['threat_intel', 'ndr', 'sandbox', 'fim', 'itdr_ueba']

export interface SlabPlace {
  id: StageId
  chapter: Chapter
  y: number
}

export interface StackLayout {
  slabs: SlabPlace[]
  chapters: { chapter: Chapter; from: number; to: number }[]
  top: number
}

/** Where each chosen Stage sits in the Stack. */
export function stackLayout(stages: readonly StageId[]): StackLayout {
  const slabs: SlabPlace[] = []
  const chapters: StackLayout['chapters'] = []
  let y = 0
  for (const chapter of CHAPTERS) {
    const ids = stages.filter((s) => stageById(s).chapter === chapter)
    if (ids.length === 0) continue
    const from = y
    for (const id of ids) {
      slabs.push({ id, chapter, y })
      y += SLAB.gap
    }
    chapters.push({ chapter, from, to: y - SLAB.gap })
    y += SLAB.chapterGap - SLAB.gap
  }
  // Centre the Stack on the origin so the camera frames it the same whatever its height.
  const top = y - SLAB.chapterGap + SLAB.gap
  const shift = top / 2
  return {
    slabs: slabs.map((s) => ({ ...s, y: s.y - shift })),
    chapters: chapters.map((c) => ({ ...c, from: c.from - shift, to: c.to - shift })),
    top: top - shift,
  }
}

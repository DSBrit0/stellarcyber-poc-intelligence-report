import { CHAPTERS, stageById, type StageId } from '@poc-intel/shared'
import { useWords } from './content'

/**
 * The Multi-Layer AI™ Stack drawn flat: one glass slab per Stage, grouped by Chapter, the Presenter's
 * Stage lit. A stand-in until the 3D scene (plan, slice 2) replaces it.
 */
export function StackPreview({ stages, current, settled }: { stages: StageId[]; current: StageId; settled: ReadonlySet<StageId> }) {
  const words = useWords()
  const w = 260
  const h = 74
  const thick = 7
  const gap = 15
  const chapterGap = 34
  const cx = 230
  // Bottom to top: the pipeline climbs the Stack.
  let y = 40
  const slabs: { id: StageId; y: number }[] = []
  const labels: { chapter: (typeof CHAPTERS)[number]; y: number }[] = []
  for (const chapter of [...CHAPTERS].reverse()) {
    const inChapter = stages.filter((s) => stageById(s).chapter === chapter).reverse()
    if (inChapter.length === 0) continue
    const top = y
    for (const id of inChapter) {
      slabs.push({ id, y })
      y += gap
    }
    labels.push({ chapter, y: (top + y - gap) / 2 })
    y += chapterGap
  }
  const height = y - chapterGap + h + thick + 10
  const face = (sy: number) => `${cx},${sy} ${cx + w / 2},${sy + h / 2} ${cx},${sy + h} ${cx - w / 2},${sy + h / 2}`
  const left = (sy: number) => `${cx - w / 2},${sy + h / 2} ${cx},${sy + h} ${cx},${sy + h + thick} ${cx - w / 2},${sy + h / 2 + thick}`
  const right = (sy: number) => `${cx + w / 2},${sy + h / 2} ${cx},${sy + h} ${cx},${sy + h + thick} ${cx + w / 2},${sy + h / 2 + thick}`
  return (
    <svg viewBox={`0 0 ${cx + w / 2 + 20} ${height}`} className="h-full max-h-[62vh] w-auto" role="img" aria-label={words.stages[current].title}>
      <defs>
        <linearGradient id="slab-lit" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#41C5F9" stopOpacity="0.85" />
          <stop offset="1" stopColor="#3044E0" stopOpacity="0.55" />
        </linearGradient>
        <filter id="slab-glow" x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      {/* Drawn top to bottom so each lower slab overlaps the one above, as glass seen from above. */}
      {[...slabs].reverse().map(({ id, y: sy }) => {
        const lit = id === current
        const done = settled.has(id)
        return (
          <g key={id} className="transition-opacity duration-500">
            {lit ? <polygon points={face(sy)} fill="#41C5F9" opacity="0.45" filter="url(#slab-glow)" /> : null}
            <polygon points={left(sy)} fill={lit ? '#3295F8' : done ? '#3044E0' : '#FAFAF4'} opacity={lit ? 0.9 : done ? 0.55 : 0.08} />
            <polygon points={right(sy)} fill={lit ? '#3044E0' : done ? '#22309f' : '#FAFAF4'} opacity={lit ? 0.9 : done ? 0.55 : 0.05} />
            <polygon points={face(sy)} fill={lit ? 'url(#slab-lit)' : done ? '#3044E0' : '#FAFAF4'} fillOpacity={lit ? 1 : done ? 0.28 : 0.04} stroke={lit ? '#FAFAF4' : '#FAFAF4'} strokeOpacity={lit ? 0.9 : 0.22} strokeWidth="1" />
          </g>
        )
      })}
      {labels.map(({ chapter, y: ly }) => (
        <text key={chapter} x={cx - w / 2 - 14} y={ly + h / 2} textAnchor="end" className="fill-sc-silver/60 text-[13px] font-medium">
          {words.chapters[chapter].title}
        </text>
      ))}
    </svg>
  )
}

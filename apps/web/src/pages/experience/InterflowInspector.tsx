import type { SceneModel, SceneTarget, StageId } from '@poc-intel/shared'
import { useEffect, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { useWords } from './content'
import { fieldsUpTo, type FieldValue, type InterflowSample } from './content/interflow-samples'
import { Spot, useMirroredScroll } from './spotlight'

const show = (v: FieldValue) => (Array.isArray(v) ? `[${v.map((x) => `"${x}"`).join(', ')}]` : typeof v === 'number' ? String(v) : `"${v}"`)

/**
 * What the Presenter's entered object shows, beside the 3D scene: in the chamber, the raw record
 * and what this engine turns it into; in the trace, the Interflow growing engine by engine.
 * The samples are real captures or illustrations (ADR 0015); the screen no longer labels which.
 */
export function InterflowInspector({
  model,
  target,
  engine,
  sample,
  steps,
  traceIndex,
  canLeave,
  onLeave,
  onReplay,
  reducedMotion,
}: {
  model: SceneModel
  target: SceneTarget
  /** The engine at work in the chamber. */
  engine: string
  sample: InterflowSample
  /** The sample's steps through the Stages of this session. */
  steps: InterflowSample['steps']
  traceIndex: number
  canLeave: boolean
  onLeave: () => void
  onReplay: () => void
  reducedMotion: boolean
}) {
  const { t } = useI18n()
  const words = useWords()
  const stage = target.kind === 'stage' ? (target.key as StageId) : null
  const title = target.kind === 'source' ? target.key : words.stages[stage!].title
  const mirrored = useMirroredScroll<HTMLDivElement>('inspector')
  return (
    <section
      // On the left, as tall as the screen allows so a record fits; the tunnel takes the space to its right.
      className="pointer-events-auto mt-5 flex max-h-[calc(100dvh-15rem)] min-h-0 w-full max-w-[44rem] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#060f17]/88 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] backdrop-blur-xl"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">
          {t(model === 'chamber' ? 'exp.scene.chamber' : 'exp.scene.trace')}
          <span className="mx-2 text-sc-silver/30">/</span>
          {title}
          {/* The engine only when it adds something: a Stage named after its engine (Sandbox) would read twice. */}
          {model === 'chamber' && engine && engine !== title ? <span className="ml-2 font-normal text-sc-sky-light">{engine}</span> : null}
        </p>
        {model === 'trace' && canLeave ? (
          <button type="button" className="rounded px-2 py-0.5 text-xs text-sc-silver/70 hover:bg-white/10 hover:text-sc-silver" onClick={onReplay}>
            {t('exp.scene.replay')}
          </button>
        ) : null}
        {canLeave ? (
          <button type="button" className="rounded-lg border border-white/15 px-2.5 py-1 text-xs hover:border-white/40" onClick={onLeave}>
            {t('exp.scene.leave')}
          </button>
        ) : null}
      </header>
      {/* The Pipeline a size smaller and tighter: by the last engine its record is some thirty fields, and they should fit with the Case. */}
      <div {...mirrored} className={`min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono ${model === 'trace' ? 'text-[11.5px] leading-snug' : 'text-[12.5px] leading-relaxed'}`}>
        {model === 'chamber' ? <ChamberView sample={sample} stage={stage} reducedMotion={reducedMotion} /> : <TraceView sample={sample} steps={steps} index={traceIndex} />}
      </div>
    </section>
  )
}

/** Raw on the left, Interflow on the right; each mapping lights up in turn, as the parser reads it. */
function ChamberView({ sample, stage, reducedMotion }: { sample: InterflowSample; stage: StageId | null; reducedMotion: boolean }) {
  const { t } = useI18n()
  const stepIndex = stage ? sample.steps.findIndex((s) => s.stage === stage) : sample.steps.findIndex((s) => s.stage === 'normalization')
  const [lit, setLit] = useState(reducedMotion ? sample.mappings.length : 0)
  useEffect(() => {
    if (lit >= sample.mappings.length) return
    const id = window.setTimeout(() => setLit((n) => n + 1), 650)
    return () => window.clearTimeout(id)
  }, [lit, sample.mappings.length])

  // A source that sends structured fields has no raw line: show what it delivers, already as Interflow.
  if ((!stage || stage === 'normalization' || stage === 'data_sources' || stage === 'collection') && sample.raw == null) {
    const parsed = sample.steps.find((s) => s.stage === 'normalization')
    return (
      <div className="space-y-2">
        <p className="font-roboto text-sm text-sc-silver/70">{t('exp.scene.noRaw')}</p>
        <Json spot="if:add" rows={Object.entries(parsed?.fields ?? {}).map(([key, value]) => ({ key, value, fresh: true }))} />
      </div>
    )
  }
  // A Data Source, or the parser itself: the raw record mapped field by field.
  if (!stage || stage === 'normalization' || stage === 'data_sources' || stage === 'collection') {
    const rawText = sample.raw ?? ''
    const highlighted = sample.mappings.slice(0, lit)
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-1 font-roboto text-xs text-sc-silver/55">{t('exp.scene.raw')}</p>
          <Spot id="if:raw" className="break-all text-sc-silver/80">
            <Highlighted text={rawText} parts={highlighted.map((m) => m.raw)} />
          </Spot>
        </div>
        <div>
          <p className="mb-1 font-roboto text-xs text-sc-silver/55">{t('exp.scene.interflow')}</p>
          <ul className="space-y-0.5">
            {sample.mappings.map((m, i) => (
              <Spot as="li" key={m.field} id={`if:map:${m.field}`} className={`transition-opacity duration-500 ${i < lit ? 'opacity-100' : 'opacity-0'}`}>
                <span className="text-sc-sky-light">{m.field}</span>
                <span className="text-sc-silver/40"> ← </span>
                <span className="text-sc-silver/75">{m.raw}</span>
              </Spot>
            ))}
          </ul>
        </div>
      </div>
    )
  }
  if (stepIndex < 0) return <p className="font-roboto text-sm text-sc-silver/70">{t('exp.scene.notInSample')}</p>
  const before = fieldsUpTo(sample, stepIndex - 1)
  const step = sample.steps[stepIndex]!
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <p className="mb-1 font-roboto text-xs text-sc-silver/55">{t('exp.scene.input')}</p>
        <Json spot="if:in" rows={before.map((f) => ({ ...f, fresh: false }))} />
      </div>
      <div>
        <p className="mb-1 font-roboto text-xs text-sc-silver/55">
          {t('exp.scene.adds')}: <span className="text-sc-silver">{step.engine}</span>
        </p>
        <Json spot="if:add" rows={Object.entries(step.fields).map(([key, value]) => ({ key, value, fresh: true }))} />
      </div>
    </div>
  )
}

/** The engines the record has passed, and its Interflow so far, newest fields lit. */
function TraceView({ sample, steps, index }: { sample: InterflowSample; steps: InterflowSample['steps']; index: number }) {
  const { t } = useI18n()
  const words = useWords()
  const reached = steps.slice(0, index + 1)
  const fields = new Map<string, { value: FieldValue; fresh: boolean }>()
  reached.forEach((st, i) => Object.entries(st.fields).forEach(([k, v]) => fields.set(k, { value: v, fresh: i === index })))
  const done = index >= steps.length - 1
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,14rem)_1fr]">
      {/* The Case sits under the steps, the way the record ends, in view without scrolling the record. */}
      <div className="space-y-3">
        <ol className="space-y-1 font-roboto text-sm">
          <li className="text-sc-silver/55">{sample.source}</li>
          {steps.map((st, i) => (
            <Spot as="li" key={st.stage} id={`if:step:${st.stage}`} className={`flex items-baseline gap-2 ${i === index ? 'text-sc-solar' : i < index ? 'text-sc-silver/85' : 'text-sc-silver/30'}`}>
              <span aria-hidden>{i < index ? '✓' : i === index ? '▸' : '·'}</span>
              <span>
                {words.stages[st.stage].title}
                <span className="block text-xs opacity-70">{st.engine}</span>
              </span>
            </Spot>
          ))}
        </ol>
        {done ? (
          <Spot id="if:case" className="rounded-lg border border-sc-solar/40 bg-sc-solar/10 px-3 py-2 font-roboto text-sm">
            {t('exp.scene.case', { id: sample.outcome.caseId, score: sample.outcome.score, alerts: sample.outcome.alerts })}
            <span className="block text-sc-silver/80">
              {t('exp.scene.response')}: {words.stages.response.options[sample.outcome.response.action]} ({sample.outcome.response.target})
            </span>
          </Spot>
        ) : null}
      </div>
      <Json spot="if:field" rows={[...fields].map(([key, v]) => ({ key, ...v }))} />
    </div>
  )
}

/** `spot`: each field can be put in the Spotlight as `<spot>:<field>`. */
function Json({ rows, spot }: { rows: { key: string; value: FieldValue; fresh: boolean }[]; spot: string }) {
  return (
    <pre className="whitespace-pre-wrap">
      <span className="text-sc-silver/50">{'{'}</span>
      {rows.map((r, i) => (
        <Spot as="span" key={r.key} id={`${spot}:${r.key}`} className={`block pl-4 transition-colors duration-700 ${r.fresh ? 'bg-sc-solar/10' : ''}`}>
          <span className={r.fresh ? 'text-sc-solar' : 'text-sc-sky-light'}>"{r.key}"</span>
          <span className="text-sc-silver/50">: </span>
          <span className="text-sc-silver/85">{show(r.value)}</span>
          <span className="text-sc-silver/50">{i < rows.length - 1 ? ',' : ''}</span>
        </Spot>
      ))}
      <span className="text-sc-silver/50">{'}'}</span>
    </pre>
  )
}

/** The raw text with the pieces already read by the parser marked. */
function Highlighted({ text, parts }: { text: string; parts: string[] }) {
  const marks: { start: number; end: number }[] = []
  for (const p of parts) {
    const at = text.indexOf(p.replace('…', ''))
    if (at >= 0) marks.push({ start: at, end: at + p.replace('…', '').length })
  }
  marks.sort((a, b) => a.start - b.start)
  const out: React.ReactNode[] = []
  let pos = 0
  marks.forEach((m, i) => {
    if (m.start < pos) return
    out.push(text.slice(pos, m.start))
    out.push(
      <mark key={i} className="rounded bg-sc-sky-light/20 px-0.5 text-sc-sky-light">
        {text.slice(m.start, m.end)}
      </mark>,
    )
    pos = m.end
  })
  out.push(text.slice(pos))
  return <>{out}</>
}

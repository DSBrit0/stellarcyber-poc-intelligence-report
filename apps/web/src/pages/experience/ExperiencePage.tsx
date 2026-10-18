import { applyView, CHAPTERS, DEFAULT_VIEW, hasQuestion, viewOf, isListQuestion, stageById, type AnswerValue, type AudienceProfile, type DataSourcesValue, type BriefingSection, type ExperienceStatus, type ExperienceView, type SceneState, type ViewInput, type StageId, type StagePhase } from '@poc-intel/shared'
import '@fontsource/roboto/latin-400.css'
import '@fontsource/roboto/latin-500.css'
import '@fontsource/roboto/latin-700.css'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useParams } from 'react-router'
import logoDark from '../../assets/stellar-cyber-logo-dark.svg'
import { api } from '../../lib/api'
import { errorKey } from '../../lib/errors'
import { useI18n } from '../../lib/i18n'
import { AnswerInput, AnswerSummary, type Draft } from './AnswerInputs'
import { BriefingTerminal } from './BriefingTerminal'
import { ClosingView, type Participant } from './ClosingView'
import { CollapseButton } from './CollapseButton'
import { CustomerQuestions, type QuestionRow } from './CustomerQuestions'
import { familyOf, SAMPLES } from './content/interflow-samples'
import { InterflowInspector } from './InterflowInspector'
import { questionWords, useWords } from './content'
import { Spot, SpotlightProvider, useMirroredScroll, useSpotlight } from './spotlight'
import { StackPreview } from './StackPreview'

// three.js and its effects load only where the 3D scene can run.
const StackScene = lazy(() => import('./scene/StackScene'))

const useMedia = (query: string) =>
  useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
  )

const hasWebGL = (() => {
  let ok: boolean | null = null
  return () => {
    if (ok == null) {
      try {
        ok = document.createElement('canvas').getContext('webgl2') != null
      } catch {
        ok = false
      }
    }
    return ok
  }
})()

interface AnswerRow {
  id: string
  stageId: StageId
  userId: string
  userName: string
  value: AnswerValue
  updatedAt: string
  mine: boolean
}
interface ResultRow {
  stageId: StageId
  outcome: 'approved' | 'skipped'
  value: AnswerValue | null
  answerIds: string[]
}
interface Live {
  experience: { id: string; name: string; profile: AudienceProfile; status: ExperienceStatus; stages: StageId[]; currentStage: StageId; currentPhase: StagePhase; briefingOpen: BriefingSection[]; scene: SceneState; view: ExperienceView }
  customerName: string
  docsVersion: string | null
  questions: QuestionRow[]
  answers: AnswerRow[]
  results: ResultRow[]
  participants?: Participant[]
  canRun: boolean
  canAnswer: boolean
  canApprove: boolean
}

/** The full-screen Stellar Experience: everyone's view follows the Presenter's Stage (ADR 0014). */
export function ExperiencePage() {
  const { id = '', expId = '' } = useParams()
  const { t } = useI18n()
  const words = useWords()
  const qc = useQueryClient()
  const key = ['experience', expId]
  const { data, error } = useQuery({
    queryKey: key,
    queryFn: () => api<Live>(`/pocs/${id}/experiences/${expId}`),
    refetchInterval: (q) => (q.state.data?.experience.status === 'active' ? 1000 : false),
  })
  // A Finished Experience has no Presenter: the viewer walks its replay alone.
  const [replayStage, setReplayStage] = useState<StageId | null>(null)
  const [replayPhase, setReplayPhase] = useState<StagePhase>('briefing')
  const [replayOpen, setReplayOpen] = useState<BriefingSection[]>([])
  const [replayScene, setReplayScene] = useState<SceneState>({ model: 'chamber', target: null })
  const [replayView, setReplayView] = useState<ExperienceView>(DEFAULT_VIEW)
  const [moveError, setMoveError] = useState<string | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: key })
  // Small screens and browsers without WebGL 2 get the flat Stack; reduced motion keeps 3D but still.
  const wide = useMedia('(min-width: 768px)')
  const lg = useMedia('(min-width: 1024px)')
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)')
  const with3D = wide && hasWebGL()
  const exp = data?.experience
  const live = exp?.status === 'active'
  const stage: StageId | undefined = exp ? (live ? exp.currentStage : (replayStage ?? exp.stages[0])) : undefined
  const index = exp && stage ? exp.stages.indexOf(stage) : -1
  const settled = new Set((data?.results ?? []).map((r) => r.stageId))
  const result = data?.results.find((r) => r.stageId === stage)
  const presenting = Boolean(data?.canRun && live)
  // The Presenter's panel, Spotlight and trace replays: mirrored on every screen; in a replay, the viewer's own.
  const view: ExperienceView = exp ? (live ? viewOf(exp.view) : replayView) : DEFAULT_VIEW
  const leading = presenting || !live
  const patchLive = (patch: Partial<Live['experience']>) => qc.setQueryData<Live>(key, (d) => (d ? { ...d, experience: { ...d.experience, ...patch } } : d))
  const setView = async (patch: ViewInput) => {
    if (!exp || !leading) return
    const next = applyView(view, patch)
    if (!live) return setReplayView(next)
    patchLive({ view: next })
    try {
      await api(`/pocs/${id}/experiences/${exp.id}/view`, { method: 'POST', body: patch })
    } finally {
      await refresh()
    }
  }
  // The Presenter folds the description and questions away to give the scene the whole screen, for everyone.
  const panelOpen = view.panel
  const togglePanel = () => void setView({ panel: !panelOpen })
  const point = (spot: string | null) => void setView({ spot })
  // Hover and scroll fire many times a second: the Presenter's last one in each quarter second is sent,
  // without touching the local view (the Presenter already sees their own).
  const pending = useRef(new Map<string, number>())
  useEffect(() => () => pending.current.forEach((t) => window.clearTimeout(t)), [])
  const mirror = (key: string, patch: ViewInput) => {
    if (!exp || !presenting) return
    window.clearTimeout(pending.current.get(key))
    pending.current.set(
      key,
      window.setTimeout(() => void api(`/pocs/${id}/experiences/${exp.id}/view`, { method: 'POST', body: patch }).catch(() => undefined), 250),
    )
  }
  // Each Stage opens on its Briefing; the Presenter then opens its question.
  const phase: StagePhase = exp ? (live ? exp.currentPhase : replayPhase) : 'briefing'

  const go = async (target: StageId | undefined) => {
    if (!target || !exp) return
    if (!live) {
      setReplayPhase('briefing')
      setReplayOpen([])
      setReplayView((v) => ({ ...v, spot: null }))
      return setReplayStage(target)
    }
    setMoveError(null)
    try {
      await api(`/pocs/${id}/experiences/${exp.id}/go`, { method: 'POST', body: { stageId: target } })
      await refresh()
    } catch (err) {
      setMoveError(t(errorKey(err)))
    }
  }
  const setPhase = async (next: StagePhase) => {
    if (!exp) return
    if (!live) {
      setReplayView((v) => ({ ...v, spot: null }))
      return setReplayPhase(next)
    }
    setMoveError(null)
    try {
      await api(`/pocs/${id}/experiences/${exp.id}/phase`, { method: 'POST', body: { phase: next } })
      await refresh()
    } catch (err) {
      setMoveError(t(errorKey(err)))
    }
  }
  // The Presenter opens each Briefing topic while explaining it; in a replay the viewer does.
  const briefingOpen = exp ? (live ? exp.briefingOpen : replayOpen) : []
  const toggleTopic = async (section: BriefingSection) => {
    if (!exp) return
    // One topic at a time: opening the next one closes the one before.
    const next = briefingOpen.includes(section) ? [] : [section]
    // The topic just opened goes in the Spotlight, as the server does.
    const spot = next[0] ? `brief:${next[0]}` : null
    if (!live) {
      setReplayView((v) => ({ ...v, spot }))
      return setReplayOpen(next)
    }
    patchLive({ briefingOpen: next, view: { ...view, spot } })
    try {
      await api(`/pocs/${id}/experiences/${exp.id}/briefing`, { method: 'POST', body: { open: next } })
    } finally {
      await refresh()
    }
  }
  // The 3D interaction (prototype models, plan Q38): the Presenter enters objects, everyone follows.
  const scene: SceneState = exp ? (live ? exp.scene : replayScene) : { model: 'chamber', target: null }
  const setScene = async (next: SceneState) => {
    if (!exp) return
    if (!live) {
      setReplayView((v) => ({ ...v, spot: null }))
      return setReplayScene(next)
    }
    patchLive({ scene: next, view: { ...view, spot: null } })
    try {
      await api(`/pocs/${id}/experiences/${exp.id}/scene`, { method: 'POST', body: next })
    } finally {
      await refresh()
    }
  }
  // The view picker: the Stack, or straight into the tunnel. Data ingestion opens on the engine of the Stage
  // on screen; the Pipeline follows a record from a source (the first approved one, else network traffic).
  // Clicking a plate or a source tile on the Stack still enters that object instead.
  const openView = (m: 'stack' | SceneState['model']) => {
    if (m === 'stack') return setScene({ model: scene.model, target: null })
    const target = scene.target ?? (m === 'trace' ? { kind: 'source' as const, key: approvedSources[0] ?? 'Network' } : stage ? { kind: 'stage' as const, key: stage } : null)
    return setScene({ model: m, target })
  }
  const approvedSources = (data?.results.find((r) => r.stageId === 'data_sources' && r.value)?.value as DataSourcesValue | undefined)?.sources.map((s) => s.name) ?? []
  // A source shows its own family's record; a Stage, a record that actually goes through that engine.
  const preferred = SAMPLES[familyOf(approvedSources[0] ?? 'FortiGate')]
  const sample =
    scene.target?.kind === 'source'
      ? SAMPLES[familyOf(scene.target.key)]
      : scene.target?.kind === 'stage' && !preferred.steps.some((st) => st.stage === scene.target!.key)
        ? (Object.values(SAMPLES).find((x) => x.steps.some((st) => st.stage === scene.target!.key)) ?? preferred)
        : preferred
  const sampleSteps = exp ? sample.steps.filter((st) => exp.stages.includes(st.stage)) : []
  // The traced record advances one engine every few seconds, on every screen, from the moment the Presenter enters or replays.
  const traceKey = scene.model === 'trace' && scene.target ? `${scene.target.kind}:${scene.target.key}:${view.replay}` : null
  const [traceIndex, setTraceIndex] = useState(0)
  useEffect(() => {
    setTraceIndex(0)
    if (!traceKey) return
    const timer = window.setInterval(() => setTraceIndex((i) => Math.min(i + 1, sampleSteps.length - 1)), reducedMotion ? 1800 : 2600)
    return () => window.clearInterval(timer)
  }, [traceKey, sampleSteps.length, reducedMotion])
  const chamberEngine =
    scene.target?.kind === 'stage'
      ? (sample.steps.find((st) => st.stage === scene.target!.key)?.engine ?? words.stages[scene.target.key as StageId]?.title ?? '')
      : (sample.steps.find((st) => st.stage === 'normalization')?.engine ?? 'Parser')

  const prev = exp && index > 0 ? exp.stages[index - 1] : undefined
  const next = exp && index >= 0 && index < exp.stages.length - 1 ? exp.stages[index + 1] : undefined
  // A Stage without a question (the Closing) has no question phase and never holds the Presenter back.
  const asks = stage ? hasQuestion(stage) : true
  const closing = stage ? stageById(stage).chapter === 'closing' : false
  const canNext = Boolean(next && (!live || (stage && (settled.has(stage) || !asks))))

  // Arrow keys move the Presenter (or the replay) when no field has focus.
  useEffect(() => {
    if (!presenting && live) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowRight') {
        if (phase === 'briefing' && asks) void setPhase('question')
        else if (canNext) void go(next)
      }
      if (e.key === 'ArrowLeft') {
        if (phase === 'question') void setPhase('briefing')
        else if (prev) void go(prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (error) {
    return (
      <Screen>
        <p className="m-auto max-w-md text-center text-sc-silver/80">{t(errorKey(error))}</p>
      </Screen>
    )
  }
  if (!data || !exp || !stage) return <Screen />
  const def = stageById(stage)
  const stageWords = words.stages[stage]

  return (
    <SpotlightProvider
      value={{ spot: view.spot, canPoint: leading, point, scroll: view.scroll, onScroll: presenting ? (area, ratio) => mirror(`scroll:${area}`, { scroll: { area, ratio } }) : undefined }}
    >
    <Screen blades={!with3D || closing}>
      {with3D && !closing ? (
        <>
        {/* A soft shade behind the title so text never sits on bright glass. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-72 bg-linear-to-b from-[#04060D]/85 via-[#04060D]/40 to-transparent" />
        <Suspense fallback={null}>
          <StackScene
            stages={exp.stages}
            current={stage}
            settled={settled}
            sources={approvedSources}
            chapterTitles={{ data_engine: words.chapters.data_engine.title, open_xdr: words.chapters.open_xdr.title, agentic_soc: words.chapters.agentic_soc.title }}
            stageTitles={Object.fromEntries(Object.entries(words.stages).map(([k, v]) => [k, v.title])) as Record<StageId, string>}
            reducedMotion={reducedMotion}
            // The Stack sits left of the panel; inside the tunnel, the tunnel sits right of the text box on the left.
            shift={!lg ? 0 : scene.target ? (panelOpen ? (phase === 'briefing' ? -0.01 : -0.05) : -0.2) : panelOpen ? (phase === 'briefing' ? 0.24 : 0.2) : 0}
            shiftDown={scene.target ? 0 : 0.1}
            wide={panelOpen && phase === 'briefing'}
            scene={scene}
            traceStages={sampleSteps.map((st) => st.stage)}
            traceIndex={traceIndex}
            canInteract={presenting || !live}
            onEnter={(target) => void setScene({ model: scene.model, target })}
            pointedLayer={live ? view.layer : null}
            onLayerHover={(layer) => mirror('layer', { layer })}
          />
        </Suspense>
        </>
      ) : null}
      <header className="relative z-10 flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-8">
        <img src={logoDark} alt="Stellar Cyber" width={159} height={22} className="h-5 w-auto" />
        <p className="min-w-0 flex-1 truncate text-sm text-sc-silver/70">
          <span className="font-medium text-sc-silver">{exp.name}</span>
          <span className="mx-2 text-sc-silver/30">/</span>
          {data.customerName}
        </p>
        <ChapterRail stages={exp.stages} current={stage} settled={settled} />
        <Link to={`/pocs/${id}`} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-sc-silver/80 hover:border-white/40 hover:text-sc-silver">
          {t('exp.leave')}
        </Link>
      </header>

      <main
        className={`pointer-events-none relative z-10 grid flex-1 gap-6 px-4 pb-4 sm:px-8 lg:gap-10 ${closing ? '' : !panelOpen ? 'lg:grid-cols-[minmax(0,1fr)_auto]' : phase === 'briefing' ? 'lg:grid-cols-[minmax(0,1fr)_minmax(26rem,38rem)]' : 'lg:grid-cols-[minmax(0,1fr)_minmax(22rem,30rem)]'}`}
      >
        <section className="flex min-h-0 flex-col">
          <p className="text-sm font-medium text-sc-sky-light">
            {words.chapters[def.chapter].title}
            <span className="ml-3 text-sc-silver/50 tabular-nums">{t('exp.stageOf', { n: index + 1, total: exp.stages.length })}</span>
          </p>
          <h1 className={`mt-2 leading-[1.05] font-bold tracking-tight text-balance ${scene.target || closing ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-6xl'}`}>{stageWords.title}</h1>
          {with3D && !closing ? (
            <div className="pointer-events-auto mt-3 flex flex-wrap items-center gap-2 text-xs">
              <div className="flex rounded-lg border border-white/15 p-0.5" role="radiogroup" aria-label={t('exp.scene.mode')}>
                {(['stack', 'chamber', 'trace'] as const).map((m) => {
                  const on = m === 'stack' ? !scene.target : Boolean(scene.target) && scene.model === m
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={!(presenting || !live)}
                      className={`rounded-md px-2.5 py-1 ${on ? 'bg-white/15 text-sc-silver' : 'text-sc-silver/60 enabled:hover:text-sc-silver'}`}
                      onClick={() => void openView(m)}
                    >
                      {t(m === 'stack' ? 'exp.scene.stack' : m === 'chamber' ? 'exp.scene.chamber' : 'exp.scene.trace')}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
          {scene.target && with3D && !closing ? (
            <InterflowInspector
              key={`${scene.model}:${scene.target.kind}:${scene.target.key}`}
              model={scene.model}
              target={scene.target}
              engine={chamberEngine}
              sample={sample}
              steps={sampleSteps}
              traceIndex={traceIndex}
              canLeave={presenting || !live}
              onLeave={() => void setScene({ model: scene.model, target: null })}
              onReplay={() => void setView({ replay: true })}
              reducedMotion={reducedMotion}
            />
          ) : (
            <>
              <p className={`mt-4 max-w-[60ch] leading-relaxed text-sc-silver/75 ${closing ? 'text-base' : 'text-base sm:text-lg'}`}>{stageWords.lead}</p>
              {/* The Closing shows its diagrams where the Stack would be. */}
              {closing ? (
                <ClosingView
                  stage={stage as 'topology' | 'lab'}
                  participants={data.participants ?? []}
                  canRun={data.canRun}
                  live={live}
                  onLabAccess={async (confirmed) => {
                    await api(`/pocs/${id}/experiences/${exp.id}/lab-access`, { method: 'POST', body: { confirmed } })
                    await refresh()
                  }}
                />
              ) : null}
            </>
          )}
          {with3D || closing ? null : (
            <div className="mt-6 flex min-h-64 flex-1 items-center justify-center">
              <StackPreview stages={exp.stages} current={stage} settled={settled} />
            </div>
          )}
        </section>

        {/* A fixed height on large screens: the Briefing scrolls inside, the questions stay in view.
            The Closing has no panel: its diagrams take the whole width. */}
        {closing ? null : panelOpen ? (
        <div id="experience-panel" className="flex min-h-0 flex-col gap-4 lg:h-[calc(100dvh-10.5rem)]">
          {phase === 'briefing' ? (
            <BriefingTerminal
              key={`${exp.id}-${stage}`}
              stage={stage}
              open={briefingOpen}
              canToggle={presenting || !live}
              onToggle={(s) => void toggleTopic(s)}
              docsVersion={data.docsVersion}
              reducedMotion={reducedMotion}
              onCollapse={leading ? togglePanel : undefined}
            />
          ) : (
            <StagePanel key={`${exp.id}-${stage}`} pocId={id} data={data} stage={stage} result={result} approvedSources={approvedSources} onChanged={refresh} onCollapse={leading ? togglePanel : undefined} />
          )}
          <CustomerQuestions
            base={`/pocs/${id}/experiences/${exp.id}`}
            stage={stage}
            questions={data.questions.filter((q) => q.stageId === stage)}
            canAsk={live}
            canReply={data.canRun}
            onChanged={refresh}
          />
        </div>
        ) : (
          // Folded: a slim tab on the right edge brings the panel back (the Presenter's, for everyone), and says if questions are waiting.
          <button
            type="button"
            disabled={!leading}
            onClick={togglePanel}
            aria-expanded={false}
            aria-controls="experience-panel"
            className="pointer-events-auto flex items-center gap-2 self-start rounded-xl border border-white/15 bg-[#060f17]/80 px-3 py-2 text-sm text-sc-silver/80 backdrop-blur hover:border-white/40 hover:text-sc-silver lg:[writing-mode:vertical-rl]"
          >
            {t('exp.panel.expand')}
            {data.questions.some((q) => q.stageId === stage) ? (
              <span className="rounded-full bg-sc-solar/20 px-1.5 text-xs text-sc-solar">{data.questions.filter((q) => q.stageId === stage).length}</span>
            ) : null}
          </button>
        )}
      </main>

      {with3D && !closing ? (
        // How to handle the 3D view; each viewer's camera is their own.
        <p className="pointer-events-none absolute right-4 bottom-[4.4rem] z-10 hidden text-[10px] text-sc-silver/40 lg:block sm:right-8">{t('exp.scene.controls')}</p>
      ) : null}
      <footer className="relative z-10 flex flex-wrap items-center gap-3 border-t border-white/10 px-4 py-3 sm:px-8">
        {presenting || !live ? (
          <>
            {/* One Back, mirroring Next: from the question to its Briefing, then to the previous Stage. */}
            <button
              type="button"
              className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:border-white/40 disabled:opacity-30"
              disabled={phase === 'briefing' && !prev}
              onClick={() => void (phase === 'question' ? setPhase('briefing') : go(prev))}
            >
              ← {t('exp.back')}
            </button>
            <p className="flex-1 text-center text-sm text-sc-silver/60" role="status">
              {moveError ?? (live && phase === 'question' && !settled.has(stage) ? t('exp.needApproval') : '')}
            </p>
            {presenting && phase === 'question' && !settled.has(stage) ? <SkipButton pocId={id} expId={exp.id} stage={stage} onDone={refresh} /> : null}
            {/* One Next: from the Briefing to the question, then on to the next Stage. */}
            <button
              type="button"
              className="rounded-lg bg-sc-sky px-5 py-2 text-sm font-semibold text-sc-silver hover:bg-sc-sky-mid disabled:opacity-30"
              disabled={(phase === 'question' || !asks) && !canNext}
              onClick={() => void (phase === 'briefing' && asks ? setPhase('question') : go(next))}
            >
              {t('exp.next')} →
            </button>
          </>
        ) : (
          <p className="text-sm text-sc-silver/60">{phase === 'briefing' && asks ? t('exp.waitQuestion') : t('exp.following')}</p>
        )}
        {!live ? <p className="w-full text-center text-xs text-sc-silver/50">{exp.status === 'finished' ? t('exp.finishedNote') : t('exp.notLive')}</p> : null}
      </footer>
    </Screen>
    </SpotlightProvider>
  )
}

function Screen({ children, blades = true }: { children?: React.ReactNode; blades?: boolean }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-x-hidden bg-sc-midnight font-roboto text-sc-silver">
      {blades ? <Blades /> : null}
      {children}
    </div>
  )
}

/** The brand's "Blades": translucent Dark Sky Blue planes in the background (Brand Guidelines, Graphics). */
function Blades() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(48,68,224,0.28),transparent_60%)]" />
      <div className="absolute -top-24 right-[8%] h-[70vh] w-[22vw] skew-y-[-14deg] bg-linear-to-b from-sc-sky/25 to-transparent" />
      <div className="absolute top-[18%] right-[-6%] h-[60vh] w-[26vw] skew-y-[-14deg] bg-linear-to-b from-sc-sky/15 to-transparent" />
      <div className="absolute bottom-[-20%] left-[-4%] h-[70vh] w-[18vw] skew-y-[14deg] bg-linear-to-t from-sc-sky/12 to-transparent" />
    </div>
  )
}

/** Three Chapters, a tick per Stage: where the session is, what is done. */
function ChapterRail({ stages, current, settled }: { stages: StageId[]; current: StageId; settled: ReadonlySet<StageId> }) {
  const words = useWords()
  return (
    <ol className="order-last flex w-full gap-4 md:order-none md:w-auto">
      {CHAPTERS.map((c) => {
        const ids = stages.filter((s) => stageById(s).chapter === c)
        if (ids.length === 0) return null
        return (
          <li key={c} className="min-w-0 flex-1 md:flex-none">
            <p className={`mb-1 text-xs ${ids.includes(current) ? 'text-sc-silver' : 'text-sc-silver/50'}`}>{words.chapters[c].title}</p>
            <div className="flex gap-1">
              {ids.map((s) => (
                <span
                  key={s}
                  title={words.stages[s].title}
                  className={`h-1.5 min-w-3 flex-1 rounded-full md:w-5 md:flex-none ${s === current ? 'bg-sc-sky-light shadow-[0_0_10px_#41C5F9]' : settled.has(s) ? 'bg-sc-sky' : 'bg-white/15'}`}
                />
              ))}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function SkipButton({ pocId, expId, stage, onDone }: { pocId: string; expId: string; stage: StageId; onDone: () => unknown }) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      className="rounded-lg px-4 py-2 text-sm text-sc-silver/70 hover:bg-white/10 hover:text-sc-silver"
      onClick={async () => {
        await api(`/pocs/${pocId}/experiences/${expId}/stages/${stage}/skip`, { method: 'POST' })
        await onDone()
      }}
    >
      {t('exp.skip')}
    </button>
  )
}

/** The glass panel: the question, your Answer, everyone's Answers and the approval. */
function StagePanel({
  pocId,
  data,
  stage,
  result,
  approvedSources,
  onChanged,
  onCollapse,
}: {
  pocId: string
  data: Live
  stage: StageId
  result: ResultRow | undefined
  approvedSources: string[]
  onChanged: () => unknown
  onCollapse?: () => void
}) {
  const { t } = useI18n()
  const words = useWords()
  const question = stageById(stage).question
  const answers = data.answers.filter((a) => a.stageId === stage)
  const mine = answers.find((a) => a.mine)
  const [draft, setDraft] = useState<Draft>(mine?.value ?? null)
  const [picked, setPicked] = useState<string[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const list = isListQuestion(question)
  const base = `/pocs/${pocId}/experiences/${data.experience.id}/stages/${stage}`

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true)
    setStatus(null)
    try {
      await fn()
      await onChanged()
      if (done) setStatus(done)
    } catch (err) {
      setStatus(t(errorKey(err)))
      await onChanged()
    } finally {
      setBusy(false)
    }
  }
  const { spot, canPoint, point } = useSpotlight()
  const mirrored = useMirroredScroll<HTMLElement>('panel')
  // The Presenter's pick goes in the Spotlight, so everyone sees which Answer is about to be approved.
  const togglePick = (answerId: string) => {
    const dropping = list && picked.includes(answerId)
    setPicked((p) => (list ? (p.includes(answerId) ? p.filter((x) => x !== answerId) : [...p, answerId]) : [answerId]))
    if (canPoint) point(dropping ? (spot === `ans:${answerId}` ? null : spot) : `ans:${answerId}`)
  }

  return (
    <aside {...mirrored} className="pointer-events-auto flex min-h-0 shrink flex-col gap-5 self-start overflow-y-auto rounded-2xl border border-white/12 bg-white/[0.06] p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:p-6">
      <div className="relative pr-24">
        {onCollapse ? <CollapseButton onClick={onCollapse} className="absolute top-0 right-0" /> : null}
        <h2 className="text-xl leading-snug font-semibold text-balance">{questionWords(words, stage).question}</h2>
        {questionWords(words, stage).hint ? <p className="mt-1 text-sm text-sc-silver/60">{questionWords(words, stage).hint}</p> : null}
      </div>

      {result ? (
        <div className={`rounded-xl border px-4 py-3 text-sm ${result.outcome === 'approved' ? 'border-sc-sky-light/50 bg-sc-sky-light/10' : 'border-white/15 bg-white/5'}`}>
          <p className="mb-1 font-semibold">{t(result.outcome === 'approved' ? 'exp.approved' : 'exp.skipped')}</p>
          {result.value ? <AnswerSummary stageId={stage} question={question} value={result.value} /> : null}
          {result.outcome === 'approved' && stage === 'data_sources' ? <p className="mt-2 text-xs text-sc-silver/60">{t('exp.toNotebook')}</p> : null}
        </div>
      ) : null}

      {data.canAnswer ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (draft) void run(() => api(`${base}/answer`, { method: 'PUT', body: { value: draft } }), t('exp.sent'))
          }}
        >
          <p className="text-sm font-medium text-sc-silver/80">{t('exp.yourAnswer')}</p>
          <AnswerInput stageId={stage} question={question} value={draft} onChange={setDraft} approvedSources={approvedSources} />
          <button className="rounded-lg bg-sc-sky px-4 py-2 text-sm font-semibold hover:bg-sc-sky-mid disabled:opacity-40" disabled={!draft || busy}>
            {mine ? t('exp.update') : t('exp.send')}
          </button>
        </form>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-sc-silver/80">{t('exp.answers')}</p>
          {data.canApprove && answers.length > 0 ? <p className="text-xs text-sc-silver/50">{t(list ? 'exp.pickSeveral' : 'exp.pickOne')}</p> : null}
        </div>
        {answers.length === 0 ? <p className="text-sm text-sc-silver/50">{t('exp.noAnswers')}</p> : null}
        <ul className="space-y-2">
          {answers.map((a) => {
            const isPicked = picked.includes(a.id)
            const wasApproved = result?.answerIds.includes(a.id)
            const content = (
              <>
                <span className="mb-0.5 block text-xs text-sc-silver/55">
                  {a.mine ? t('exp.you') : a.userName}
                  {wasApproved ? <span className="ml-2 text-sc-sky-light">{t('exp.approved')}</span> : null}
                </span>
                <AnswerSummary stageId={stage} question={question} value={a.value} />
              </>
            )
            return (
              <Spot as="li" key={a.id} id={`ans:${a.id}`} pointable={false}>
                {data.canApprove ? (
                  <button
                    type="button"
                    role={list ? 'checkbox' : 'radio'}
                    aria-checked={isPicked}
                    onClick={() => togglePick(a.id)}
                    className={`block w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${isPicked ? 'border-sc-solar bg-sc-solar/10' : 'border-white/10 bg-white/[0.03] hover:border-white/30'}`}
                  >
                    {content}
                  </button>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">{content}</div>
                )}
              </Spot>
            )
          })}
        </ul>
        {data.canApprove && picked.length > 0 ? (
          <button
            type="button"
            disabled={busy}
            className="w-full rounded-lg bg-linear-to-r from-sc-solar to-sc-burnt px-4 py-2 text-sm font-semibold text-sc-midnight disabled:opacity-40"
            onClick={() =>
              void run(async () => {
                await api(`${base}/approve`, { method: 'POST', body: { answerIds: picked } })
                setPicked([])
              })
            }
          >
            {list && picked.length > 1 ? t('exp.approveSelected') : t('exp.approve')}
          </button>
        ) : null}
      </div>
      {status ? (
        <p className="text-sm text-sc-silver/70" role="status">
          {status}
        </p>
      ) : null}
    </aside>
  )
}

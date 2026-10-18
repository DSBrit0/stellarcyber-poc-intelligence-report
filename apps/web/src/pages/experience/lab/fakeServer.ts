import { applyView, clearFocus, DEFAULT_VIEW, SCENE_MODELS, STAGE_IDS, StageId, stagesForProfile, type AudienceProfile, type BriefingSection, type ExperienceView, type SceneState, type StagePhase } from '@poc-intel/shared'

/**
 * The visual lab's server: an in-memory stand-in for the Experience API, installed over `fetch`
 * only on the lab page (dev builds). The real ExperiencePage runs against it, so visual work needs
 * no database, login or live session, and what is tuned here is exactly what ships.
 */
export const LAB_POC = '00000000-0000-4000-8000-00000000a1ab'
export const LAB_EXP = '00000000-0000-4000-8000-00000000e1ab'

interface LabState {
  profile: AudienceProfile
  stages: StageId[]
  currentStage: StageId
  currentPhase: StagePhase
  briefingOpen: BriefingSection[]
  scene: SceneState
  view: ExperienceView
  settled: Set<StageId>
}

/** The starting point, read from the lab URL: ?profile=&stage=&phase=&model=&target=kind:key&open=topic&spot=id&panel=closed */
export function stateFromUrl(search: string): LabState {
  const q = new URLSearchParams(search)
  const profile: AudienceProfile = q.get('profile') === 'executive' ? 'executive' : 'technical'
  const stages = stagesForProfile(profile)
  const stage = StageId.safeParse(q.get('stage')).data
  const currentStage = stage && stages.includes(stage) ? stage : stages[0]!
  const [kind, ...key] = (q.get('target') ?? '').split(':')
  const model = (SCENE_MODELS as readonly string[]).includes(q.get('model') ?? '') ? (q.get('model') as SceneState['model']) : 'chamber'
  return {
    profile,
    stages,
    currentStage,
    currentPhase: q.get('phase') === 'question' ? 'question' : 'briefing',
    briefingOpen: q.get('open') ? [q.get('open') as BriefingSection] : [],
    scene: { model, target: (kind === 'source' || kind === 'stage') && key.length ? { kind, key: key.join(':') } : null },
    view: { ...DEFAULT_VIEW, panel: q.get('panel') !== 'closed', spot: q.get('spot') || (q.get('open') ? `brief:${q.get('open')}` : null) },
    // Every Stage before the current one counts as done, so the Stack shows progress.
    settled: new Set(stages.slice(0, stages.indexOf(currentStage))),
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export function installFakeServer(state: LabState): () => void {
  const realFetch = window.fetch.bind(window)
  const base = `/api/pocs/${LAB_POC}/experiences/${LAB_EXP}`
  const live = () => ({
    experience: {
      id: LAB_EXP,
      name: 'Visual lab',
      profile: state.profile,
      status: 'active',
      stages: state.stages,
      currentStage: state.currentStage,
      currentPhase: state.currentPhase,
      briefingOpen: state.briefingOpen,
      scene: state.scene,
      view: state.view,
      finishedAt: null,
    },
    customerName: 'Lab Customer',
    docsVersion: null,
    questions: [],
    answers: [],
    results: [...state.settled].map((stageId) => ({ stageId, outcome: 'skipped', value: null, answerIds: [], decidedAt: new Date().toISOString() })),
    canRun: true,
    canAnswer: true,
    canApprove: true,
  })
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.origin)
    const method = (init?.method ?? 'GET').toUpperCase()
    const body = init?.body ? JSON.parse(String(init.body)) : {}
    const path = url.pathname
    if (path === '/api/auth/me')
      return json({ id: '00000000-0000-4000-8000-0000000000aa', email: 'lab@local', name: 'Lab', role: 'sales_engineer', status: 'active', locale: 'pt-BR', mfaEnabled: false, mustChangePassword: false, customerId: null, isRoot: false })
    if (path === '/api/catalog') return json({ version: null, entries: [] })
    if (path === base && method === 'GET') return json(live())
    if (path === `${base}/go`) {
      state.currentStage = body.stageId
      state.currentPhase = 'briefing'
      state.briefingOpen = []
      state.scene = { model: state.scene.model, target: null }
      state.view = clearFocus(state.view)
      return json({ ok: true })
    }
    if (path === `${base}/phase`) return (state.currentPhase = body.phase), (state.view = clearFocus(state.view)), json({ ok: true })
    if (path === `${base}/briefing`) return (state.briefingOpen = body.open), (state.view = { ...state.view, spot: body.open.at(-1) ? `brief:${body.open.at(-1)}` : null }), json({ ok: true })
    if (path === `${base}/scene`) return (state.scene = body), (state.view = clearFocus(state.view)), json({ ok: true })
    if (path === `${base}/view`) return (state.view = applyView(state.view, body)), json({ ok: true })
    const stageAction = path.match(new RegExp(`^${base}/stages/([a-z_]+)/(skip|approve)$`))
    if (stageAction && (STAGE_IDS as readonly string[]).includes(stageAction[1]!)) return state.settled.add(stageAction[1] as StageId), json({ ok: true })
    if (path.startsWith(base)) return json({ ok: true })
    return realFetch(input, init)
  }
  return () => {
    window.fetch = realFetch
  }
}

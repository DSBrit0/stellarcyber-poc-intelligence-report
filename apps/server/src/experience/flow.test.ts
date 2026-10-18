import { DEFAULT_VIEW, STAGE_IDS, ViewInput, answerSchema, applyView, clearFocus, viewOf, mergeAnswers, stageById, stagesForProfile, type StageId } from '@poc-intel/shared'
import { describe, expect, it } from 'vitest'
import { canGoTo, canTransition, stageAfterSelection } from './flow.js'

describe('Stellar Experience flow', () => {
  it('goes Disabled → Active → Finished and reopens', () => {
    expect(canTransition('disabled', 'active')).toBe(true)
    expect(canTransition('active', 'finished')).toBe(true)
    expect(canTransition('finished', 'active')).toBe(true)
    expect(canTransition('disabled', 'finished')).toBe(false)
    expect(canTransition('active', 'disabled')).toBe(false)
  })

  it('moves back freely and forward only past settled Stages', () => {
    const stages: StageId[] = ['data_sources', 'collection', 'normalization']
    expect(canGoTo(stages, new Set(), 'collection', 'data_sources')).toBe(true)
    expect(canGoTo(stages, new Set(), 'data_sources', 'collection')).toBe(false)
    expect(canGoTo(stages, new Set(['data_sources']), 'data_sources', 'collection')).toBe(true)
    expect(canGoTo(stages, new Set(['data_sources']), 'data_sources', 'normalization')).toBe(false)
    expect(canGoTo(stages, new Set(['data_sources']), 'data_sources', 'response')).toBe(false)
  })

  it('keeps the Presenter on a Stage still chosen, else on the nearest earlier one', () => {
    expect(stageAfterSelection(STAGE_IDS, ['data_sources', 'detection'], 'detection')).toBe('detection')
    expect(stageAfterSelection(STAGE_IDS, ['data_sources', 'detection'], 'normalization')).toBe('data_sources')
    expect(stageAfterSelection(STAGE_IDS, ['detection'], 'collection')).toBe('detection')
  })

  it("mirrors the Presenter's panel, Spotlight and trace replays", () => {
    const folded = applyView(DEFAULT_VIEW, { panel: false })
    expect(folded).toEqual({ ...DEFAULT_VIEW, panel: false })
    const pointed = applyView(folded, { spot: 'if:field:src_ip' })
    expect(pointed.spot).toBe('if:field:src_ip')
    expect(applyView(pointed, { replay: true }).replay).toBe(1)
    expect(applyView(pointed, { spot: null }).spot).toBeNull()
    expect(ViewInput.safeParse({}).success).toBe(false)
    expect(ViewInput.safeParse({ replay: false }).success).toBe(false)
  })

  it("mirrors the Presenter's hovered layer and scrolling, and clears both focus and scroll on new content", () => {
    const hovered = applyView(DEFAULT_VIEW, { layer: 'detection' })
    expect(hovered.layer).toBe('detection')
    const scrolled = applyView(applyView(hovered, { scroll: { area: 'briefing', ratio: 0.4 } }), { scroll: { area: 'panel', ratio: 1 } })
    expect(scrolled.scroll).toEqual({ briefing: 0.4, panel: 1 })
    expect(ViewInput.safeParse({ scroll: { area: 'briefing', ratio: 1.5 } }).success).toBe(false)
    expect(ViewInput.safeParse({ layer: 'not_a_stage' }).success).toBe(false)
    const cleared = clearFocus({ ...scrolled, spot: 'brief:how' })
    expect(cleared).toMatchObject({ spot: null, scroll: {}, layer: 'detection' })
    // A view stored before hover and scroll existed reads their defaults.
    expect(viewOf({ panel: false, spot: null, replay: 2 })).toEqual({ panel: false, spot: null, replay: 2, layer: null, scroll: {} })
  })

  it('the Executive profile pre-selects five Stages in pipeline order', () => {
    expect(stagesForProfile('executive')).toEqual(['data_sources', 'detection', 'correlation', 'agentic_soc', 'response'])
    expect(stagesForProfile('technical')).toHaveLength(15)
  })
})

describe('Answers', () => {
  it('a single-choice question takes one option it offers', () => {
    const s = answerSchema(stageById('data_lake').question)
    expect(s.safeParse({ options: ['y1'] }).success).toBe(true)
    expect(s.safeParse({ options: ['y1', 'd90'] }).success).toBe(false)
    expect(s.safeParse({ options: ['forever'] }).success).toBe(false)
  })

  it('list questions merge several Answers without repeats', () => {
    const q = stageById('data_sources').question
    const merged = mergeAnswers(q, [
      { sources: [{ kind: 'parser', catalogId: null, name: 'FortiGate' }] },
      { sources: [{ kind: 'parser', catalogId: null, name: 'fortigate' }, { kind: 'connector', catalogId: null, name: 'CrowdStrike' }] },
    ])
    expect(merged).toEqual({ sources: [{ kind: 'parser', catalogId: null, name: 'FortiGate' }, { kind: 'connector', catalogId: null, name: 'CrowdStrike' }] })
  })

  it('a value question approves exactly one Answer', () => {
    const q = stageById('correlation').question
    expect(mergeAnswers(q, [{ value: 1 }])).toEqual({ value: 1 })
    expect(mergeAnswers(q, [{ value: 1 }, { value: 2 }])).toBeNull()
  })

  it('merged filters may not exceed three', () => {
    const q = stageById('ingestion_filters').question
    const f = (n: number) => ({ source: 'FortiGate', eventType: `type ${n}`, action: 'drop' as const })
    expect(mergeAnswers(q, [{ filters: [f(1), f(2)] }, { filters: [f(3)] }])).not.toBeNull()
    expect(mergeAnswers(q, [{ filters: [f(1), f(2)] }, { filters: [f(3), f(4)] }])).toBeNull()
  })

  it('multiple-choice merges keep the question\'s option order', () => {
    const q = stageById('sandbox').question
    expect(mergeAnswers(q, [{ options: ['usb'] }, { options: ['email', 'usb'] }])).toEqual({ options: ['email', 'usb'] })
  })
})

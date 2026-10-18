import { hasQuestion, type ExperienceStatus, type StageId } from '@poc-intel/shared'

/** Disabled → Active → Finished, and a Finished Experience reopens to Active. */
const TRANSITIONS: Record<ExperienceStatus, readonly ExperienceStatus[]> = {
  disabled: ['active'],
  active: ['finished'],
  finished: ['active'],
}

export const canTransition = (from: ExperienceStatus, to: ExperienceStatus) => TRANSITIONS[from].includes(to)

/**
 * Whether the Presenter may move from `current` to `target`: back to any Stage, forward only past
 * Stages already settled (approved or Skipped) or that ask no question.
 */
export function canGoTo(stages: readonly StageId[], settled: ReadonlySet<StageId>, current: StageId, target: StageId): boolean {
  const from = stages.indexOf(current)
  const to = stages.indexOf(target)
  if (to < 0) return false
  if (from < 0 || to <= from) return true
  return stages.slice(from, to).every((s) => settled.has(s) || !hasQuestion(s))
}

/** The Presenter's Stage after the selection changed: kept when still chosen, else the nearest earlier one chosen. */
export function stageAfterSelection(order: readonly StageId[], selection: readonly StageId[], current: StageId): StageId {
  if (selection.includes(current)) return current
  const before = order.slice(0, order.indexOf(current)).reverse()
  return before.find((s) => selection.includes(s)) ?? selection[0]!
}

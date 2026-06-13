import type { GameState } from '@/engine/types/GameState'

// The corner counter "stars in the sky: 8,128" — revealed only once the telescope is owned,
// and already ticking DOWN on ACCUMULATED game time (resolved decision: scripted timers use
// accumulatedGameTimeMs, never the wall clock). The game never mentions it; it is pure tell.
// state.starsRemaining (8128 → down) is the canonical store; this module derives the visible
// value from accumulated time so the descent survives reload/background via the same delta
// machinery as everything else.

/** Ms of accumulated game time per single star lost. One star roughly every ~30 minutes. */
export const MS_PER_STAR = 30 * 60 * 1000

/** The full starting count (the perfect number 8,128). */
export const STARTING_STARS = 8128

/** Whether the star counter is visible (only after the telescope is bought). */
export function starCounterVisible(state: GameState): boolean {
  return state.flags['telescopeOwned'] === true
}

/**
 * The stars that should remain given how much accumulated game time has passed SINCE the
 * telescope was bought. The telescope-purchase accumulated-time stamp is read from
 * numbers.telescopeBoughtAtMs (set by content on purchase). Clamped to ≥ 0 and never above
 * the persisted starsRemaining (the descent is monotonic — time only removes stars).
 */
export function projectedStars(state: GameState): number {
  if (!starCounterVisible(state)) return state.starsRemaining
  const boughtAt = state.numbers['telescopeBoughtAtMs'] ?? state.accumulatedGameTimeMs
  const elapsed = Math.max(0, state.accumulatedGameTimeMs - boughtAt)
  const lost = Math.floor(elapsed / MS_PER_STAR)
  return Math.max(0, state.starsRemaining - lost)
}

/**
 * Reconcile state.starsRemaining down to the projected value (called by the tick/lifecycle
 * so the persisted store tracks the visible descent). Also re-anchors telescopeBoughtAtMs to
 * the consumed boundary so the next decrement is measured fresh. Immutable; SAME reference
 * when no whole star has elapsed.
 */
export function reconcileStars(state: GameState): GameState {
  if (!starCounterVisible(state)) return state
  const boughtAt = state.numbers['telescopeBoughtAtMs'] ?? state.accumulatedGameTimeMs
  const elapsed = Math.max(0, state.accumulatedGameTimeMs - boughtAt)
  const lost = Math.floor(elapsed / MS_PER_STAR)
  if (lost <= 0) return state
  const starsRemaining = Math.max(0, state.starsRemaining - lost)
  return {
    ...state,
    starsRemaining,
    numbers: { ...state.numbers, telescopeBoughtAtMs: boughtAt + lost * MS_PER_STAR },
  }
}

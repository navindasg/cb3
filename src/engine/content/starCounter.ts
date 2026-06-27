import type { GameState } from '@/engine/types/GameState'
import { STAGE_ACCEL } from '@/content/sun/observationDeck'

// The corner counter "stars in the sky: 8,128" — revealed only once the telescope is owned,
// and already ticking DOWN on ACCUMULATED game time (resolved decision: scripted timers use
// accumulatedGameTimeMs, never the wall clock). The game never mentions it; it is pure tell.
// state.starsRemaining (8128 → down) is the canonical store; this module derives the visible
// value from accumulated time so the descent survives reload/background via the same delta
// machinery as everything else.
//
// Act 3 (the observation deck, DESIGN §15/§189): the descent ACCELERATES as the dyson scaffold rises. Each
// completed stage steepens it (starDescentMultiplier counts the dysonStageN_Done flags — engine literals in
// lock-step with content/flags, the moonStrata idiom; STAGE_ACCEL is content CONFIG, imported the same way
// engine/content/actGate imports PEPPERMINT_GATE_AMOUNT, ADR §3-allowed). effectiveMsPerStar divides
// MS_PER_STAR by that multiplier, and both projectedStars and reconcileStars use it. The descent stays on
// accumulatedGameTimeMs (never the wall clock), stays MONOTONIC (time only ever REMOVES stars), and stays
// offline-safe; reconcileStars re-anchors telescopeBoughtAtMs to the consumed boundary at the CURRENT rate
// each pass, so a rate that changes between passes never double-counts or drifts. A save with no scaffold
// flags falls at exactly the old base rate (back-compat). The dread is the number you ignored all game,
// finally moving where you can see it — and the building is what is doing it.

/** Ms of accumulated game time per single star lost AT THE BASE RATE. One star roughly every ~30 minutes,
 * before any scaffold acceleration. */
export const MS_PER_STAR = 30 * 60 * 1000

/** The full starting count (the perfect number 8,128). */
export const STARTING_STARS = 8128

/**
 * The dyson-scaffold done-flags, re-declared here in lock-step with content/flags.DYSON_STAGE_DONE_FLAGS
 * (content owns the named array; the engine re-declares the literals rather than importing the content
 * value — ADR §3, the moonStrata idiom). The descent steepens once per flag set.
 */
const DYSON_STAGE_DONE_FLAGS = [
  'dysonStage1Done',
  'dysonStage2Done',
  'dysonStage3Done',
  'dysonStage4Done',
  'dysonStage5Done',
] as const

/** Whether the star counter is visible (only after the telescope is bought). */
export function starCounterVisible(state: GameState): boolean {
  return state.flags['telescopeOwned'] === true
}

/**
 * The descent multiplier from the dyson scaffold: 1 + STAGE_ACCEL × (completed stages). Exactly 1 on a save
 * with no scaffold flags (back-compat — the old base rate), and steepening by one STAGE_ACCEL step per
 * raised stage. Pure derivation over the lock-stepped flag literals; never below 1.
 */
export function starDescentMultiplier(state: GameState): number {
  const stagesDone = DYSON_STAGE_DONE_FLAGS.reduce(
    (n, flag) => (state.flags[flag] === true ? n + 1 : n),
    0,
  )
  return 1 + STAGE_ACCEL * stagesDone
}

/** Ms of accumulated game time per single star lost AT THE CURRENT scaffold-accelerated rate: the base
 * cadence divided by the descent multiplier (more stages → fewer ms per star → a faster fall). */
export function effectiveMsPerStar(state: GameState): number {
  return MS_PER_STAR / starDescentMultiplier(state)
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
  const lost = Math.floor(elapsed / effectiveMsPerStar(state))
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
  const msPerStar = effectiveMsPerStar(state)
  const lost = Math.floor(elapsed / msPerStar)
  if (lost <= 0) return state
  const starsRemaining = Math.max(0, state.starsRemaining - lost)
  return {
    ...state,
    starsRemaining,
    // Re-anchor to the consumed boundary at the CURRENT rate, so a rate that changes between passes never
    // double-counts the partial star already accounted for (the descent stays drift-free + monotonic).
    numbers: { ...state.numbers, telescopeBoughtAtMs: boughtAt + lost * msPerStar },
  }
}

import type { GameState } from '@/engine/types/GameState'
import { STAGE_ACCEL } from '@/content/sun/observationDeck'
import { ECLIPSE_DURATION_MS } from '@/content/void/voidWhale'
import { setNumber } from '@/engine/state/reducers'

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

// Act 4 — the endings (DESIGN §200/§201/§203). Two terminal branches re-declare their content flag literals
// here in lock-step with content/flags.STARS_RELIGHTING_FLAG / STAR_COUNTER_FROZEN_FLAG (the moonStrata idiom —
// the engine never imports a content FLAG value, ADR §3):
//  - starsRelighting (ending 1, LET IT HATCH): the dragon ascends burning and relights the eaten stars, so the
//    counter ticks UP toward STARTING_STARS (clamped — the ONLY up-tick in the entire game), still on
//    accumulatedGameTimeMs, still drift-free via the same re-anchor machinery, just inverted.
//  - starCounterFrozen (ending 2, FEED THE SUN): the star-eater becomes the egg's guardian and the sky stops —
//    projectedStars returns the stored count unchanged and reconcileStars early-returns the SAME reference.

/** content/flags.STARS_RELIGHTING_FLAG — ending 1: the descent inverts and the stars come BACK. */
const STARS_RELIGHTING_FLAG = 'starsRelighting'

/** content/flags.STAR_COUNTER_FROZEN_FLAG — ending 2: the descent stops forever, up or down. */
const STAR_COUNTER_FROZEN_FLAG = 'starCounterFrozen'

/** Whether the relight (up-tick) branch is active (ending 1). Strict === true. */
function relighting(state: GameState): boolean {
  return state.flags[STARS_RELIGHTING_FLAG] === true
}

/** Whether the freeze branch is active (ending 2). Strict === true. */
function frozen(state: GameState): boolean {
  return state.flags[STAR_COUNTER_FROZEN_FLAG] === true
}

// The eclipse (Phase 5 — the black licorice grimoire's world spell, the void whale's hermit, DESIGN §17/§18).
// Casting eclipse draws a shadow across the sky and the descent STOPS for a window (ECLIPSE_DURATION_MS of
// accumulated game time). It is a TEMPORARY, drift-free pause — unlike ending 2's permanent freeze: while the
// eclipse holds, the count does not move; when it ends, the descent resumes exactly where it left off, having
// lost no stars to the paused window (reconcileStars re-anchors telescopeBoughtAtMs forward across the shadow,
// the same re-anchor machinery the ordinary descent uses). It is the ONE thing that can hold the dark back, and
// only for a while. A window per cast, monotonic (never rewinds); a re-cast during an active eclipse EXTENDS it
// from now (not stacking on the tail — a fresh shadow). Never an up-tick; it only pauses the down-tick.

/** numbers-namespace key: the accumulated-game-time ms at which the current eclipse ends (0/absent = none). */
export const ECLIPSE_UNTIL_KEY = 'eclipseUntilMs'

/** The accumulated-game-time ms the current eclipse holds until (0 when none). */
export function eclipseUntilMs(state: GameState): number {
  return Math.max(0, state.numbers[ECLIPSE_UNTIL_KEY] ?? 0)
}

/** Whether the sky is currently eclipsed — the descent is paused (accumulated time has not yet reached the
 * eclipse's end). Ending 2's permanent freeze takes precedence (frozen wins), and ending 1's relight is inert
 * to it too: the eclipse only ever pauses the DOWN-tick, it must never hold back the RETURNING light (the one
 * hopeful up-tick), so an eclipse stamped before the relight began is a no-op once relighting. Under an ordinary
 * descent an active eclipse holds it. Pure. */
export function eclipsed(state: GameState): boolean {
  if (frozen(state)) return false
  if (relighting(state)) return false
  return state.accumulatedGameTimeMs < eclipseUntilMs(state)
}

/**
 * Cast the eclipse: pause the descent for ECLIPSE_DURATION_MS of accumulated game time FROM NOW. Sets the
 * eclipse-until stamp to accumulatedGameTimeMs + the duration (a fresh shadow — a re-cast extends from now, it
 * does not stack on the tail). Also re-anchors telescopeBoughtAtMs to now, so the shadow starts clean and no
 * partial star from before the cast is carried into the paused window (the sub-star fraction in flight at cast
 * is DROPPED — always player-favorable, never adds a star; monotonic-safe). A no-op (SAME reference) once the
 * sky is permanently frozen (ending 2 — there is nothing left to pause) or never revealed (no telescope). The
 * descent stays MONOTONIC (eclipse only ever pauses the down-tick; it never relights). Immutable.
 */
export function castEclipse(state: GameState): GameState {
  if (frozen(state)) return state
  if (!starCounterVisible(state)) return state
  const until = state.accumulatedGameTimeMs + ECLIPSE_DURATION_MS
  // Re-anchor the descent to now first, then stamp the shadow's end. Both ride the numbers z.record.
  const anchored = setNumber(state, 'telescopeBoughtAtMs', state.accumulatedGameTimeMs)
  return setNumber(anchored, ECLIPSE_UNTIL_KEY, until)
}

/**
 * Whether the star counter is visible: after the telescope is bought (the Act-1 reveal — it holds for the rest
 * of the game), OR once an ending has flipped the descent into its relight/freeze branch (so the up-tick /
 * the stop shows even on the off chance the telescope flag were ever cleared). In practice telescopeOwned holds
 * all game, so the ending clauses are belt-and-braces; the relight up-tick is the one the player is watching.
 */
export function starCounterVisible(state: GameState): boolean {
  return state.flags['telescopeOwned'] === true || relighting(state) || frozen(state)
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
  // Ending 2 (FEED THE SUN): the counter is frozen forever — the stored value, unmoved (up or down).
  if (frozen(state)) return state.starsRemaining
  if (!starCounterVisible(state)) return state.starsRemaining
  // The eclipse (a temporary pause): the count holds at the stored value while the shadow is up.
  if (eclipsed(state)) return state.starsRemaining
  const boughtAt = state.numbers['telescopeBoughtAtMs'] ?? state.accumulatedGameTimeMs
  const elapsed = Math.max(0, state.accumulatedGameTimeMs - boughtAt)
  const gained = Math.floor(elapsed / effectiveMsPerStar(state))
  // Ending 1 (LET IT HATCH): the descent inverts — the dragon relights the eaten stars, the count rises toward
  // 8128 and clamps there (the ONLY up-tick in the game).
  if (relighting(state)) return Math.min(STARTING_STARS, state.starsRemaining + gained)
  return Math.max(0, state.starsRemaining - gained)
}

/**
 * Reconcile state.starsRemaining down to the projected value (called by the tick/lifecycle
 * so the persisted store tracks the visible descent). Also re-anchors telescopeBoughtAtMs to
 * the consumed boundary so the next decrement is measured fresh. Immutable; SAME reference
 * when no whole star has elapsed.
 */
export function reconcileStars(state: GameState): GameState {
  // Ending 2 (FEED THE SUN): the counter stops forever — never re-anchor, never move. SAME reference.
  if (frozen(state)) return state
  if (!starCounterVisible(state)) return state
  // The eclipse (a temporary pause): hold the count, but re-anchor telescopeBoughtAtMs forward across the
  // shadow so the paused window is never charged as elapsed once it lifts (drift-free — the same re-anchor
  // the ordinary descent does, just consuming zero stars). SAME reference once already anchored to now.
  if (eclipsed(state)) {
    return setNumber(state, 'telescopeBoughtAtMs', state.accumulatedGameTimeMs)
  }
  const boughtAt = state.numbers['telescopeBoughtAtMs'] ?? state.accumulatedGameTimeMs
  const elapsed = Math.max(0, state.accumulatedGameTimeMs - boughtAt)
  const msPerStar = effectiveMsPerStar(state)
  const whole = Math.floor(elapsed / msPerStar)
  if (whole <= 0) return state

  // Ending 1 (LET IT HATCH): the descent inverts — relight stars toward 8128 (clamped). Otherwise descend
  // toward 0 (clamped). Either way re-anchor to the consumed boundary at the CURRENT rate, so a rate that
  // changes between passes never double-counts the partial star (the count stays drift-free + monotonic in
  // its direction). If the relight has already reached the cap, there is nothing to add — SAME reference.
  if (relighting(state)) {
    const starsRemaining = Math.min(STARTING_STARS, state.starsRemaining + whole)
    if (starsRemaining === state.starsRemaining) return state
    return {
      ...state,
      starsRemaining,
      numbers: { ...state.numbers, telescopeBoughtAtMs: boughtAt + whole * msPerStar },
    }
  }

  const starsRemaining = Math.max(0, state.starsRemaining - whole)
  return {
    ...state,
    starsRemaining,
    numbers: { ...state.numbers, telescopeBoughtAtMs: boughtAt + whole * msPerStar },
  }
}

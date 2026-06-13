import type { GameState } from '@/engine/types/GameState'

// G1 — the SEED EVENT, the act gate that pivots the genre (DESIGN §22). The gate fires once,
// the instant BOTH conditions hold: the telescope is owned AND total candies ever earned
// (candies.lifetimeAccumulated — resolved decision 6) has reached the threshold. When it
// fires: a falling star lands in the field, the star counter ticks 8128 → 8127 (one real
// star, decremented from the canonical store), a seed appears in the crater, and the
// astronomer offers his (wrong) theories. It is GUARDED by a flag so it fires EXACTLY ONCE
// and is idempotent across reload. Pure & immutable: a miss (or an already-fired gate)
// returns the SAME state reference so callers can skip via Object.is.

/** The candies.lifetimeAccumulated threshold that arms the seed event (tunable). */
export const SEED_EVENT_THRESHOLD = 50000

/** Flag set the instant the seed event fires (the once-only guard; persists across reload). */
export const SEED_EVENT_FLAG = 'seedEventFired'

/** Flag set when the seed exists in the crater, ready to plant. */
export const SEED_PRESENT_FLAG = 'seedPresent'

/** Whether the gate's preconditions hold (telescope owned + lifetime candies past threshold). */
export function seedGateArmed(state: GameState): boolean {
  return (
    state.flags['telescopeOwned'] === true &&
    state.candies.lifetimeAccumulated >= SEED_EVENT_THRESHOLD
  )
}

/** Whether the seed event has already fired (so it never fires twice, even after a reload). */
export function seedEventFired(state: GameState): boolean {
  return state.flags[SEED_EVENT_FLAG] === true
}

/** Whether the seed event should fire on this pass (armed and not yet fired). */
export function shouldFireSeedEvent(state: GameState): boolean {
  return seedGateArmed(state) && !seedEventFired(state)
}

export interface SeedEventResult {
  /** True only on the single pass that fires the event. */
  readonly fired: boolean
  /** The state after firing (guard flag set, seed present, one star consumed); same ref on a miss. */
  readonly state: GameState
}

/**
 * Fire the seed event if armed and not yet fired. On firing: set the once-only guard flag,
 * mark the seed present in the crater, and decrement starsRemaining by EXACTLY ONE (the
 * falling star — clamped at 0). Idempotent across reload via SEED_EVENT_FLAG: once set, this
 * is inert and returns the SAME state reference. Immutable throughout.
 */
export function fireSeedEvent(state: GameState): SeedEventResult {
  if (!shouldFireSeedEvent(state)) return { fired: false, state }
  const next: GameState = {
    ...state,
    starsRemaining: Math.max(0, state.starsRemaining - 1),
    flags: {
      ...state.flags,
      [SEED_EVENT_FLAG]: true,
      [SEED_PRESENT_FLAG]: true,
    },
  }
  return { fired: true, state: next }
}

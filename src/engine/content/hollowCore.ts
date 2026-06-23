import type { GameState } from '@/engine/types/GameState'
import type { EchoCall, StratumDef } from '@/engine/types/defs'
import { setNumber } from '@/engine/state/reducers'
import { currentStratum } from '@/engine/content/moonStrata'
import {
  HOLLOW_ROUND_KEY,
  HOLLOW_INPUT_KEY,
  ECHO_SEQUENCE,
  BASE_LENGTH,
  TARGET_ROUNDS,
} from '@/content/moon/hollowCore'

// The hollow core's echo puzzle (Act 1, Quest 5 — DESIGN §8 / lore §15.2). Pure & immutable,
// mirroring engine/content/moonStrata: compute from state, return the next state, no-op returns the
// SAME reference. The chamber answers your call with a growing prefix of a fixed sequence; you echo
// it back (Simon-style). Solving it (TARGET_ROUNDS cleared) opens the dead centre — the warm, empty
// chamber. All progress lives in the numbers namespace; the "reached" beat lives in a flag.

/**
 * Kept in lock-step with content/flags.HOLLOW_CORE_REACHED_FLAG (content owns the named constant —
 * the moonStrata/wormMold idiom). Set on the solving call so the "reached" state is pure-engine and
 * testable; the engine writes the literal here rather than importing a content value (ADR §3).
 */
const HOLLOW_CORE_REACHED_FLAG = 'hollowCoreReached'

export function hollowRound(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[HOLLOW_ROUND_KEY] ?? 0))
}

export function hollowInput(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[HOLLOW_INPUT_KEY] ?? 0))
}

/** Whether the echo puzzle has been solved (the warm chamber reached) — reads the flag. */
export function hollowCoreReached(state: GameState): boolean {
  return state.flags[HOLLOW_CORE_REACHED_FLAG] === true
}

/**
 * Whether the hollow core is accessible — true once every stratum is mined clean (no current
 * stratum remains). Derived from the existing mining state; no new flag.
 */
export function hollowCoreAccessible(state: GameState, strata: readonly StratumDef[]): boolean {
  return currentStratum(state, strata) === null
}

/** The echo length the current round asks for (a growing prefix: round 0 → BASE_LENGTH calls). */
export function currentRoundLength(state: GameState): number {
  return BASE_LENGTH + hollowRound(state)
}

/** The full call sequence the chamber speaks this round (what the player must echo back). */
export function roundSequence(state: GameState): readonly EchoCall[] {
  return ECHO_SEQUENCE.slice(0, currentRoundLength(state))
}

/** The next call the chamber expects (the one your echo should match now), or null if solved. */
export function expectedCall(state: GameState): EchoCall | null {
  if (hollowCoreReached(state)) return null
  return ECHO_SEQUENCE[hollowInput(state)] ?? null
}

export interface EchoResult {
  readonly ok: boolean
  readonly state: GameState
  /** Was the call the chamber's expected next echo. */
  readonly correct: boolean
  /** True on the call that completed the round (the chamber answers one deeper). */
  readonly roundComplete: boolean
  /** True on the call that cleared the final round (the dead centre opens). */
  readonly solved: boolean
}

/**
 * Echo one call back into the chamber. A correct call advances your echo; completing the round's
 * full sequence answers it and lengthens the next (or, on the final round, opens the centre and sets
 * the reached flag). A wrong call scatters the echo — the current round restarts (input back to 0).
 * No-op (SAME reference, ok:false) once the core is already reached.
 */
export function echoCall(state: GameState, call: EchoCall): EchoResult {
  if (hollowCoreReached(state)) {
    return { ok: false, state, correct: false, roundComplete: false, solved: false }
  }

  const expected = expectedCall(state)
  if (call !== expected) {
    // The echo scatters — restart this round's sequence (setNumber no-ops if already 0).
    const reset = setNumber(state, HOLLOW_INPUT_KEY, 0)
    return { ok: true, state: reset, correct: false, roundComplete: false, solved: false }
  }

  const sunk = hollowInput(state) + 1
  if (sunk < currentRoundLength(state)) {
    // Mid-round: just advance the echo.
    return { ok: true, state: setNumber(state, HOLLOW_INPUT_KEY, sunk), correct: true, roundComplete: false, solved: false }
  }

  // Round complete — reset the echo and step to the next round.
  const nextRound = hollowRound(state) + 1
  const advanced = setNumber(setNumber(state, HOLLOW_ROUND_KEY, nextRound), HOLLOW_INPUT_KEY, 0)
  if (nextRound < TARGET_ROUNDS) {
    return { ok: true, state: advanced, correct: true, roundComplete: true, solved: false }
  }

  // The final round fell — the dead centre opens.
  const solved: GameState = { ...advanced, flags: { ...advanced.flags, [HOLLOW_CORE_REACHED_FLAG]: true } }
  return { ok: true, state: solved, correct: true, roundComplete: true, solved: true }
}

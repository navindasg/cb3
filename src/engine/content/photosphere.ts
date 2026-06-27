import type { GameState } from '@/engine/types/GameState'
import { setFlag } from '@/engine/state/reducers'
import { act3GateCleared } from '@/engine/content/actGate'

// The photosphere descent (Act 4 — quest 11, DESIGN §5/§194/§196). This slice stands up the ONE-CUE
// half only: the pure predicate that DECIDES when the game's only sound plays, plus the fire-once latch.
// The SOUND is performed by coverage-excluded render glue (render/descentAudio); the DECISION of
// whether/when to fire it is a tiny pure engine predicate (ADR §3 — the engine decides, render performs).
// The descent SIM (the deterministic hazard rung-by-rung resolve) and the spend-on-start are wired in a
// later slice; here the descent-port reach gate reuses the existing act3GateCleared.
//
// The engine reads no content FLAG value: it re-declares the two descent flags as string literals in
// lock-step with content/flags' PHOTOSPHERE_DESCENT_STARTED_FLAG + DESCENT_CUE_PLAYED_FLAG (the moonStrata
// idiom, ADR §3). It MAY reuse a sibling engine predicate (actGate.act3GateCleared) for the reach gate.

/**
 * Kept in lock-step with content/flags.PHOTOSPHERE_DESCENT_STARTED_FLAG (content owns the named constant —
 * the moonStrata idiom; the engine re-declares the literal rather than importing the content value, ADR §3).
 * Set the instant the descent begins (the same click that performs the cue).
 */
const PHOTOSPHERE_DESCENT_STARTED_FLAG = 'photosphereDescentStarted'

/**
 * Kept in lock-step with content/flags.DESCENT_CUE_PLAYED_FLAG (the moonStrata idiom). The fire-once latch:
 * once set, the cue can never play again — shouldPlayDescentCue is false forever after.
 */
const DESCENT_CUE_PLAYED_FLAG = 'descentCuePlayed'

/**
 * Whether the descent port is reachable — reuses the existing engine predicate act3GateCleared
 * (dysonStage5Done && the bathysphere built), built in Act 3. The descent button only enables once this is
 * true (and, in a later slice, the coolant + plating are banked). A pure derivation the screen reads.
 */
export function descentPortAvailable(state: GameState): boolean {
  return act3GateCleared(state)
}

/**
 * Whether the photosphere descent has begun. Set in the SAME dispatch that starts the descent (a later
 * slice), and read here as the cue predicate's "started" half. Strict === true so a corrupt/truthy-but-
 * not-true flag does not fire the cue.
 */
export function photosphereDescentStarted(state: GameState): boolean {
  return state.flags[PHOTOSPHERE_DESCENT_STARTED_FLAG] === true
}

/** Whether the descent cue has already played (the fire-once latch is set). Strict === true. */
export function descentCuePlayed(state: GameState): boolean {
  return state.flags[DESCENT_CUE_PLAYED_FLAG] === true
}

/**
 * The game's ONLY audio decision (DESIGN §194): whether the descent cue should play right now. True ONLY
 * while the descent has started AND the fire-once latch is unset — so after the first play (which sets the
 * latch via markDescentCuePlayed) this is false forever after. A pure predicate: the render glue reads it,
 * performs the sound, and dispatches markDescentCuePlayed in the SAME path, so the cue fires EXACTLY once
 * and can never be re-fired or farmed.
 */
export function shouldPlayDescentCue(state: GameState): boolean {
  return photosphereDescentStarted(state) && !descentCuePlayed(state)
}

/**
 * Set the fire-once latch (the cue has played). A no-op returning the SAME reference once already set
 * (setFlag is SAME-ref when the flag is unchanged — Object.is-stable). Dispatched by the descent-button
 * handler in the same path it performs the sound, so shouldPlayDescentCue goes false and stays false.
 */
export function markDescentCuePlayed(state: GameState): GameState {
  if (descentCuePlayed(state)) return state
  return setFlag(state, DESCENT_CUE_PLAYED_FLAG)
}

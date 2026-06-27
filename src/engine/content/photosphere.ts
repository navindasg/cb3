import type { GameState } from '@/engine/types/GameState'
import { spendResource } from '@/engine/types/Resource'
import { setFlag } from '@/engine/state/reducers'
import { act3GateCleared } from '@/engine/content/actGate'
import {
  DESCENT_COST,
  MIN_COOLANT,
  MIN_PLATING,
  RUNG_COUNT,
  RUNG_HAZARDS,
  RUNG_COOLANT_DRAIN,
  VENT_COOLANT_COST,
  FLARE_PLATING_DAMAGE,
  FLARE_VENTED_DAMAGE,
  STORM_BRACED_DAMAGE,
  STORM_UNBRACED_DAMAGE,
  type DescentHazard,
} from '@/content/sun/photosphere'

// The photosphere descent (Act 4 — quest 11, DESIGN §5/§194/§196). Two halves live here, both pure:
//  - the ONE-CUE decision: the predicate that DECIDES when the game's only sound plays + the fire-once
//    latch. The SOUND is performed by coverage-excluded render glue (render/descentAudio); the DECISION is
//    a tiny pure engine predicate (ADR §3 — the engine decides, render performs).
//  - the descent SIM: a deterministic, telegraphed, TRANSIENT hazard march (the kraken/reef/comet idiom —
//    it never touches GameState; an abandoned or lost descent is forfeit). canDescend gates on the existing
//    act3GateCleared reach + EXISTING mint coolant / peppermint plating (never an unobtainable resource —
//    the soft-lock-free rule). startDescent atomically spends both batches AND sets the started flag in ONE
//    dispatch (the instant the cue fires); the sim drains coolant/plating against the telegraphed hazards;
//    reaching the core wins, coolant-out or plating-out loses. completePhotosphere commits the cleared flag.
//
// The engine reads no content FLAG value: it re-declares the descent flags as string literals in lock-step
// with content/flags' PHOTOSPHERE_DESCENT_STARTED_FLAG / DESCENT_CUE_PLAYED_FLAG / PHOTOSPHERE_CLEARED_FLAG
// (the moonStrata idiom, ADR §3). It MAY reuse a sibling engine predicate (actGate.act3GateCleared) and
// import content CONFIG data/numbers (the cost lines + the hazard tuning — data, not logic).

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
 * Kept in lock-step with content/flags.PHOTOSPHERE_CLEARED_FLAG (the moonStrata idiom). The commit-once
 * "cleared" flag: set when the descent reaches the core; canDescend is false once it is set, so the descent
 * cannot be re-run for value (and there is no value to farm — the sim pays no resources).
 */
const PHOTOSPHERE_CLEARED_FLAG = 'photosphereCleared'

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

// --- the descent gate + the spend-on-start ---------------------------------

/** Whether the photosphere descent has already been cleared (reached the core) — reads the flag. Strict ===. */
export function photosphereCleared(state: GameState): boolean {
  return state.flags[PHOTOSPHERE_CLEARED_FLAG] === true
}

/**
 * Whether the descent can be begun right now: the Act-3 gate is cleared (the reach — the scaffold built +
 * the bathysphere sealed), it has not already been cleared, and BOTH batches are affordable (mint coolant >=
 * MIN_COOLANT, peppermint plating >= MIN_PLATING). A pure predicate the screen reads to enable/disable the
 * descent button (no spend). Gates only on EXISTING resources Act 2/3 produced — never an unobtainable one.
 */
export function canDescend(state: GameState): boolean {
  return (
    act3GateCleared(state) &&
    !photosphereCleared(state) &&
    state.mint.current >= MIN_COOLANT &&
    state.peppermint.current >= MIN_PLATING
  )
}

export interface StartDescentResult {
  readonly ok: boolean
  readonly state: GameState
  readonly reason?: 'locked' | 'alreadyCleared' | 'unaffordable'
}

/**
 * Begin the descent: pay BOTH cost lines (coolant + plating), then set the started flag, all in the SAME
 * returned state. No-op (SAME reference, ok:false) before the Act-3 gate (`locked`), once already cleared
 * (`alreadyCleared`), or when either line is unaffordable (spendResource returns null rather than
 * overdrafting, so nothing is touched — NEVER a partial spend). Setting the started flag here is the instant
 * shouldPlayDescentCue goes true, so the render glue fires the cue on this same click. Immutable.
 */
export function startDescent(state: GameState): StartDescentResult {
  if (!act3GateCleared(state)) return { ok: false, state, reason: 'locked' }
  if (photosphereCleared(state)) return { ok: false, state, reason: 'alreadyCleared' }

  let paid: GameState = state
  for (const line of DESCENT_COST) {
    const spent = spendResource(paid[line.resource], line.amount)
    if (!spent) return { ok: false, state, reason: 'unaffordable' }
    paid = { ...paid, [line.resource]: spent }
  }

  return { ok: true, state: setFlag(paid, PHOTOSPHERE_DESCENT_STARTED_FLAG) }
}

// --- the descent SIM (transient — never persisted; the kraken/reef idiom) ---

/** A descent action: VENT coolant (kill a flare) or BRACE the plating (scatter a storm). */
export type DescentAction = 'vent' | 'brace'
/** The descent's result, or null while it is still on. */
export type DescentOutcome = 'reachedCore' | 'lost' | null

/**
 * A live descent: how far down (rung index), the coolant left, and the plating left. TRANSIENT — built from
 * the batch you spent on start, resolved rung by rung, and thrown away on win or loss. Never serialized.
 */
export interface PhotosphereState {
  /** The rung being resolved (0 = the first below the cage .. RUNG_COUNT-1 = the last before the core). */
  readonly rung: number
  readonly coolant: number
  readonly plating: number
}

/** A fresh descent, charged with the spent batch (the full coolant + plating you packed in). Pure. */
export function createDescent(): PhotosphereState {
  return { rung: 0, coolant: MIN_COOLANT, plating: MIN_PLATING }
}

/** The hazard telegraphed at the current rung (the one the choice resolves), or null past the last rung. */
export function rungHazard(state: PhotosphereState): DescentHazard | null {
  return RUNG_HAZARDS[state.rung] ?? null
}

/**
 * The descent's result, checked on the resolved state. ReachedCore (you cleared every rung) is checked
 * FIRST so a final rung that just exhausted your reserves still WINS — you got down. Then coolant-out or
 * plating-out (either non-positive) is a loss.
 */
export function descentOutcome(state: PhotosphereState): DescentOutcome {
  if (state.rung >= RUNG_COUNT) return 'reachedCore'
  if (state.coolant <= 0 || state.plating <= 0) return 'lost'
  return null
}

/** Whether the descent has reached the core (a convenience the screen reads). */
export function reachedCore(state: PhotosphereState): boolean {
  return descentOutcome(state) === 'reachedCore'
}

/**
 * Resolve one rung: the rung's hazard is met by your choice. A FLARE vented bleeds VENT_COOLANT_COST extra
 * coolant and reaches near-nothing; a FLARE braced (the wrong read) cooks FLARE_PLATING_DAMAGE off the hull.
 * A STORM braced (the right read) costs a small STORM_BRACED_DAMAGE bite; a STORM vented wastes the coolant
 * AND eats the full STORM_UNBRACED_DAMAGE. Every rung also bleeds the baseline RUNG_COOLANT_DRAIN. Then you
 * drop one rung. Pure — returns a new state; a no-op (SAME reference) once the descent is over.
 */
export function resolveRung(state: PhotosphereState, action: DescentAction): PhotosphereState {
  if (descentOutcome(state) !== null) return state

  const hazard = rungHazard(state)
  let coolant = state.coolant - RUNG_COOLANT_DRAIN
  let plating = state.plating

  if (action === 'vent') coolant -= VENT_COOLANT_COST

  if (hazard === 'flare') {
    plating -= action === 'vent' ? FLARE_VENTED_DAMAGE : FLARE_PLATING_DAMAGE
  } else if (hazard === 'storm') {
    plating -= action === 'brace' ? STORM_BRACED_DAMAGE : STORM_UNBRACED_DAMAGE
  }

  return { rung: state.rung + 1, coolant, plating }
}

/**
 * Commit the descent: set the cleared flag. A no-op returning the SAME reference once already set (setFlag
 * is SAME-ref when the flag is unchanged). The screen dispatches this once the sim reaches the core; the
 * flag persists (the sim itself never does), is farm-proof (canDescend is false after, and the sim pays no
 * resources), and is the clean hook the caramel-core reveal opens on.
 */
export function completePhotosphere(state: GameState): GameState {
  if (photosphereCleared(state)) return state
  return setFlag(state, PHOTOSPHERE_CLEARED_FLAG)
}

import type { GameState } from '@/engine/types/GameState'
import { grantItem } from '@/engine/shop/purchase'
// DELIBERATE, non-cargo-cult divergence from the kraken/boarding drop idiom (where the RENDER layer owns the
// item-def import + the commit-once grant): here the grant reducer lives in the engine ON PURPOSE so it stays
// pure-tested (contextWindowScreens is coverage-excluded glue). The ItemDef is CONFIG data (ADR §3 permits the
// engine to read content config), not a content FLAG VALUE — the flag is still re-declared in lock-step below.
// This mirrors reflectionFight's deliberate divergence (same testability reason).
import { FOURTH_WALL_FRAGMENT } from '@/content/items/items'
import {
  HALLUCINATION_PLAYER_HP,
  HALLUCINATION_HP,
  COUNTER,
  MAX_TURNS,
  HP_BAR_LIE_MAX,
  HALLUCINATION_PATTERN,
  type HallucinationBeat,
  type TrustAction,
} from '@/content/moon/hallucination'

// The hallucination's "distrust the UI" sim (Phase 5 — hidden boss 3, DESIGN §17/§28). A pure, immutable,
// TRANSIENT turn-based fight (like the boarding / reflection / wolf it never touches GameState mid-fight; an
// abandoned or lost fight is forfeit, and only the cleared flag + the fourth-wall-fragment drop are persisted,
// owned by the screen). Deterministic (no RNG, no rAF).
//
// The fight is HONEST underneath — real HP, real damage — but it ADDITIONALLY carries the LIES the counterfeit
// UI draws, alongside the truth, the boardingDuel data-tell/data-line idiom: each beat exposes `shown` (the
// number on the fake button) beside `trueDmg` (what the mechanic deals), and the state exposes `shownFoeHp` (the
// lying, backwards HP bar) beside the true `foeHp`. THE OUTCOME ONLY EVER READS THE TRUTH. The render draws the
// lies; the tests assert the truth; the lie can never change the result. The read is: each turn, is it LYING
// (shown != trueDmg — DISBELIEVE, take zero, counter) or telling the TRUTH (a double bluff, shown == trueDmg —
// BELIEVE, brace exactly, take zero)? Naive trust-the-UI (always BELIEVE the numbers) LOSES; the reflexive cynic
// (always DISBELIEVE) ALSO loses (the double bluffs punish it); only reading the cadence — trusting the MECHANIC,
// not the interface — WINS. Grid-searched in the test so both reflexes lose and clean reads win at every build,
// bare hands included (a fair fight — the READ is the whole game).
//
// DISTINCT AXIS: unlike its siblings this fight is NOT a weapon race — you do not out-hit a hallucination (it
// has no body, only lies), so the counter is a FLAT, weapon-INDEPENDENT chip (COUNTER). Every build fights it
// identically; the whole fight is the read. It mirrors engine/content/cloudWolf's spine, re-flavored around trust.

export type HallucinationOutcome = 'won' | 'lost' | null

/**
 * Kept in lock-step with content/flags.HALLUCINATION_DEFEATED_FLAG (content owns the named constant — the
 * moonStrata idiom). The engine reads the literal here rather than importing the content value (ADR §3).
 */
const HALLUCINATION_DEFEATED_FLAG = 'hallucinationDefeated'

/** Whether the hallucination has been beaten (the fourth-wall fragment granted, the fight retired — commit-once). */
export function hallucinationDefeated(state: GameState): boolean {
  return state.flags[HALLUCINATION_DEFEATED_FLAG] === true
}

export interface HallucinationState {
  readonly yourHp: number
  readonly yourMaxHp: number
  /** The TRUE foe HP — the only HP the outcome reads. */
  readonly foeHp: number
  readonly foeMaxHp: number
  /** Exchanges resolved so far (it wears you out at MAX_TURNS). */
  readonly turn: number
}

/** A fresh fight: you at full HP, the thing at its TRUE HP, its pattern at the first beat. */
export function createHallucination(): HallucinationState {
  return {
    yourHp: HALLUCINATION_PLAYER_HP,
    yourMaxHp: HALLUCINATION_PLAYER_HP,
    foeHp: HALLUCINATION_HP,
    foeMaxHp: HALLUCINATION_HP,
    turn: 0,
  }
}

/** The beat the hallucination plays this exchange (loops the pattern if the fight runs long). */
export function beatFor(turn: number): HallucinationBeat {
  return HALLUCINATION_PATTERN[turn % HALLUCINATION_PATTERN.length]!
}

/**
 * Whether the beat is LYING this turn (its shown number differs from the true one — DISBELIEVE it). Pure. The
 * inverse is a double-bluff / honest turn (BELIEVE it). This is the read the player must learn; the engine
 * knows it for free, and the balance test uses it to define "clean reads". The RENDER never gets this — it only
 * gets `shown`, which is the whole point (you read the cadence by dying, not by a data attribute).
 */
export function beatIsLying(beat: HallucinationBeat): boolean {
  return beat.shown !== beat.trueDmg
}

/**
 * The LYING, backwards HP bar the counterfeit UI draws — pure DECORATION the render shows and the outcome never
 * reads. It runs inverted (HP_BAR_LIE_MAX - trueHp, clamped): nearly full when the thing is nearly dead, draining
 * toward empty as you actually win. Exposed here so the render can draw the lie from ONE tested source while the
 * fight resolves on the true `foeHp`. A player who watches this bar will think they are losing right as they win.
 */
export function shownFoeHp(state: HallucinationState): number {
  const lie = HP_BAR_LIE_MAX - state.foeHp
  if (lie < 0) return 0
  if (lie > HP_BAR_LIE_MAX) return HP_BAR_LIE_MAX
  return lie
}

/** The fight's result, or null while it is still on. Checked on the resolved state — reads ONLY the true HP (the
 * lies never touch this). The foe-down check comes first: the killing counter beats a simultaneous blow. */
export function hallucinationOutcome(state: HallucinationState): HallucinationOutcome {
  if (state.foeHp <= 0) return 'won'
  if (state.yourHp <= 0) return 'lost'
  if (state.turn >= MAX_TURNS) return 'lost' // it wore you down
  return null
}

/**
 * Resolve one exchange, on the TRUTH. Each turn the beat is either LYING (shown != trueDmg) or honest (a double
 * bluff, shown == trueDmg). BELIEVE the UI: brace for exactly what it showed — a clean block + counter ONLY if it
 * was HONEST (you braced the real number); if it was LYING, your brace was for the wrong number and the true blow
 * lands, no counter. DISBELIEVE it: ignore the number, trust the mechanic — a clean block + counter ONLY if it was
 * LYING (you were right not to trust it); if it was HONEST, your distrust left you open and the true blow lands, no
 * counter. Either correct read chips the foe for the flat COUNTER. The read correctness is measured against
 * `beatIsLying`; the SHOWN number is NEVER consulted by the resolution (only the render draws it). Pure — returns a
 * new state; a no-op (SAME reference) once the fight is over.
 */
export function resolveHallucination(state: HallucinationState, action: TrustAction): HallucinationState {
  if (hallucinationOutcome(state) !== null) return state

  const beat = beatFor(state.turn)
  const lying = beatIsLying(beat)

  // A read is correct when your trust matches the truth: DISBELIEVE a lie, or BELIEVE the honest turn.
  const readCorrect = action === 'disbelieve' ? lying : !lying

  let foeHp = state.foeHp
  let yourHp = state.yourHp

  if (readCorrect) {
    foeHp -= COUNTER // read it right: block clean + counter
  } else {
    yourHp -= beat.trueDmg // read it wrong: the TRUE blow lands, no counter
  }

  return { ...state, foeHp, yourHp, turn: state.turn + 1 }
}

// --- the drop (commit-once) -----------------------------------------------------------------------------------

/**
 * Grant the fourth-wall fragment exactly once, on the first hallucination win. Sets the cleared flag + the
 * fragment (its own saveFlag + ownedItems, via grantItem — the fragment has no slot, so it just banks as a
 * keepsake). A second call (already cleared) returns the SAME reference — farm-proof, the kraken/boarding idiom.
 * Pure & immutable.
 */
export function grantHallucinationReward(state: GameState): GameState {
  if (hallucinationDefeated(state)) return state
  const cleared: GameState = {
    ...state,
    flags: { ...state.flags, [HALLUCINATION_DEFEATED_FLAG]: true },
  }
  return grantItem(cleared, FOURTH_WALL_FRAGMENT)
}

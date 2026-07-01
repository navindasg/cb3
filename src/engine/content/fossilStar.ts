import type { GameState } from '@/engine/types/GameState'
import { spendResource } from '@/engine/types/Resource'
import { STARTING_STARS } from '@/engine/content/starCounter'
import { meleeWeapon } from '@/content/items/playerLoadout'
import {
  FOSSIL_STAR_COST,
  NEWBORN_HP,
  NEWBORN_PLAYER_HP,
  NEWBORN_SHOT,
  NEWBORN_FAST_COOLDOWN_MS,
  NEWBORN_STRIKE_FACTOR,
  NEWBORN_STEADY_FACTOR,
  NEWBORN_MAX_TURNS,
} from '@/content/mines/fossilStar'

// The fossil-star superboss + the mines bookend (Phase 5 — ending 4, DESIGN §309/§16.4). Pure & immutable.
// The secret epilogue, reachable ONLY post-game (an ending already chosen), so it can never block the main
// spine: the sugar-mines fossil the game opened on — the one you fed a single candy in Act 0 — has been a
// dead star this whole time, and with 1000 stardust (the v8 resource, faucet already live at the comet + the
// star-sea trawlers) you can relight it. The game's last image is the first dungeon's ceiling, glowing.
//
// THE ONE UP-TICK: igniteFossilStar mirrors observationDeck.witnessStarDie EXACTLY, but +1 instead of -1 —
// it is the ONLY star gained anywhere besides ending 1's relight, and it must feel like a gift, not a grind.
// It spends 1000 stardust, sets fossilStarIgnited commit-once IN THE SAME DISPATCH, and ticks starsRemaining
// UP by one (clamped at STARTING_STARS=8128 via the same relight-clamp path the starCounter uses), all
// atomic. A second call is a SAME-reference no-op (no double star, no double spend); a call without the cost
// or before an ending is chosen is a SAME-reference no-op too. Farm-proof by construction (the ignited flag
// blocks re-grant; the stardust is actually spent).
//
// THE CHOICE (soft-lock-free): once ignited, you may fight a newborn star in the cave (a short transient
// fight mirroring a starEater phase — the coreDefense/boarding stat model over the equipped hand weapon) OR
// step back and let it burn up through the beanstalk. EITHER path reaches the same +1 tick + the glowing-
// ceiling bookend; the fight is pure flavor (a last dance), never a gate. Stepping back — or leaving without
// igniting at all — is ALWAYS allowed. The transient fight is NEVER persisted (the shipDuel idiom); only the
// ignited flag persists, and it persists whether you fought or stepped back.
//
// The engine reads no content FLAG value: it re-declares the ending-choice + ignited literals in lock-step
// with content/flags' ENDING_CHOSEN_FLAG / FOSSIL_STAR_IGNITED_FLAG (the moonStrata idiom, ADR §3). It MAY
// reuse sibling engine derivations (starCounter.STARTING_STARS, the loadout weapon) + import content CONFIG
// data (the fossil-star tuning), all ADR §3-allowed.

/**
 * Kept in lock-step with content/flags.ENDING_CHOSEN_FLAG (the STRING recording which ending was taken —
 * lives in the strings namespace; the engine re-declares the literal rather than importing the content value,
 * ADR §3, the moonStrata idiom). The fossil accepts stardust ONLY post-game (some ending chosen).
 */
const ENDING_CHOSEN_KEY = 'endingChosen'

/**
 * Kept in lock-step with content/flags.FOSSIL_STAR_IGNITED_FLAG (the moonStrata idiom). Set commit-once by
 * igniteFossilStar in the same dispatch that spends the stardust and ticks the one star up. Farm-proof: a
 * second ignite is a SAME-reference no-op (no double star, no double spend).
 */
const FOSSIL_STAR_IGNITED_FLAG = 'fossilStarIgnited'

/** Whether an ending has already been chosen — reads the endingChosen string (post-game gate). Strict. */
function endingChosen(state: GameState): boolean {
  return typeof state.strings[ENDING_CHOSEN_KEY] === 'string'
}

/** Whether the fossil star has already been ignited (the epilogue's one mutation has fired). Strict === true. */
export function fossilStarIgnited(state: GameState): boolean {
  return state.flags[FOSSIL_STAR_IGNITED_FLAG] === true
}

/**
 * Whether the fossil will accept the stardust RIGHT NOW: post-game (an ending chosen), not already ignited,
 * and 1000 stardust in hand. A pure predicate the fossil-chamber screen reads to enable the ignite button.
 * Never true on the main spine (endingChosen is unset until Act 4's choice), so it can never block progress.
 */
export function canAwakenFossil(state: GameState): boolean {
  return (
    endingChosen(state) &&
    !fossilStarIgnited(state) &&
    state.stardust.current >= FOSSIL_STAR_COST
  )
}

/**
 * Ignite the fossil star: the epilogue's one mutation, mirroring observationDeck.witnessStarDie but +1 (the
 * ONLY up-tick besides ending 1). Spends FOSSIL_STAR_COST (1000) stardust, sets the ignited flag, AND ticks
 * starsRemaining UP by one (clamped at STARTING_STARS via the relight-clamp path), all in ONE atomic dispatch
 * so the beat is commit-once. Fires only when canAwakenFossil holds; every other call (not post-game, already
 * ignited, or short the stardust) returns the SAME reference — no double star, no double spend. Immutable.
 */
export function igniteFossilStar(state: GameState): GameState {
  if (!canAwakenFossil(state)) return state
  const spent = spendResource(state.stardust, FOSSIL_STAR_COST)
  // spendResource never returns null here (canAwakenFossil already checked the balance), but fall back
  // defensively to leave stardust untouched rather than crash if it were somehow non-finite.
  return {
    ...state,
    stardust: spent ?? state.stardust,
    starsRemaining: Math.min(STARTING_STARS, state.starsRemaining + 1),
    flags: { ...state.flags, [FOSSIL_STAR_IGNITED_FLAG]: true },
  }
}

// --- the optional newborn-star fight (a short transient sim mirroring a starEater phase) ----------------
//
// Once ignited, the CHOICE: dance with the thing you woke, or step back. The fight is a lean STRIKE/STEADY
// range bout over the equipped hand weapon (the coreDefense/boarding stat model, minus the egg — you are the
// only thing at stake, and losing costs nothing but the fight itself). It NEVER persists and NEVER gates the
// tick: the ignited flag already carries the +1, so the fight is pure flavor. Grid-searched (the engine test)
// so bare hands LOSE inside the clock while a forged blade wins — a last, honest dance, not a wall.

/** Your fighting hand as the newborn-star fight reads it off the equipped weapon (or bare hands). Pure. */
export interface NewbornWeapon {
  readonly damage: number
  /** Swings per exchange (a fast weapon strikes twice). */
  readonly strikes: number
}

export type NewbornAction = 'strike' | 'steady'
export type NewbornOutcome = 'won' | 'lost' | null

export interface NewbornState {
  readonly yourHp: number
  readonly yourMaxHp: number
  readonly starHp: number
  readonly starMaxHp: number
  /** Exchanges resolved so far (the newborn flares out at NEWBORN_MAX_TURNS — you held it long enough). */
  readonly turn: number
  readonly weapon: NewbornWeapon
}

/** Read your fighting hand off the equipped weapon (or bare hands). A fast weapon strikes twice. Pure. */
export function deriveNewbornWeapon(state: GameState): NewbornWeapon {
  const w = meleeWeapon(state)[0]!
  return { damage: w.damage, strikes: w.cooldownMs < NEWBORN_FAST_COOLDOWN_MS ? 2 : 1 }
}

/** A fresh newborn-star dance: you at full, the star at its HP, your fighting hand off the equipped weapon. */
export function createNewbornFight(state: GameState): NewbornState {
  return {
    yourHp: NEWBORN_PLAYER_HP,
    yourMaxHp: NEWBORN_PLAYER_HP,
    starHp: NEWBORN_HP,
    starMaxHp: NEWBORN_HP,
    turn: 0,
    weapon: deriveNewbornWeapon(state),
  }
}

/**
 * The fight's result, or null while it is still on. The star-down check comes FIRST: dropping it on the same
 * exchange its flare also lands still WINS (the killing blow beats simultaneity — the kraken/boarding/core
 * tiebreak). Then you gone, or the clock run out (you could not hold it) is a loss. Checked on the resolved
 * state.
 */
export function newbornOutcome(state: NewbornState): NewbornOutcome {
  if (state.starHp <= 0) return 'won'
  if (state.yourHp <= 0) return 'lost'
  if (state.turn >= NEWBORN_MAX_TURNS) return 'lost'
  return null
}

/**
 * Resolve one exchange. STRIKE: deal NEWBORN_STRIKE_FACTOR x damage x strikes, but take the newborn's full
 * flare (NEWBORN_SHOT). STEADY: deal only NEWBORN_STEADY_FACTOR x damage x strikes, but shield against the
 * flare (no damage taken). The dance is trading big open swings against holding your ground — an all-strike
 * line races the star down but bleeds you out first (grid-searched: bare-hands all-strike LOSES), a forged
 * blade with a measured mix wins. Pure — a no-op (SAME reference) once the fight is over.
 */
export function resolveNewborn(state: NewbornState, action: NewbornAction): NewbornState {
  if (newbornOutcome(state) !== null) return state

  const strike = NEWBORN_STRIKE_FACTOR * state.weapon.damage * state.weapon.strikes
  const steady = NEWBORN_STEADY_FACTOR * state.weapon.damage * state.weapon.strikes

  let starHp = state.starHp
  let yourHp = state.yourHp

  if (action === 'strike') {
    starHp -= strike
    yourHp -= NEWBORN_SHOT // the open swing lets the flare land
  } else {
    starHp -= steady // measured: shielded from the flare, but a smaller bite
  }

  return { ...state, starHp, yourHp, turn: state.turn + 1 }
}

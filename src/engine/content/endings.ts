import type { GameState } from '@/engine/types/GameState'
import { spendResource } from '@/engine/types/Resource'
import { starEaterDefeated } from '@/engine/content/starEater'
import { EAT_IT_THRESHOLD } from '@/content/sun/endings'

// The endings (Act 4 — the choice, DESIGN §16/§200-204). Pure & immutable. After the star-eater is driven off
// the player is offered a finite, poignant choice — the series tradition (CB1/CB2's endings). This module owns
// the pure decision logic; the terminal presentation lives in the coverage-excluded screen.
//
// The choice is COMMIT-ONCE: chooseEnding is gated on the endingChosen string being UNSET and is a no-op (SAME
// reference) once it is set, so no ending can be re-triggered or farmed. Each ending records WHICH choice was
// made (the endingChosen string) and applies its persistent effect in ONE atomic dispatch (the witnessStarDie
// idiom), all via the EXISTING starsRemaining + starCounter machinery — no new resource, no schema bump.
//  - ending 1 (LET IT HATCH): sets endingChosen='hatch' + the starsRelighting flag; the starCounter then ticks
//    UP toward 8128 — the only up-tick in the whole game, the sky slowly refilling (§200/§202).
//  - ending 2 (FEED THE SUN): sets endingChosen='feed' + the starCounterFrozen flag AND zeroes candies.current
//    (sacrifice the literal save hoard, §203) in the SAME dispatch; the counter freezes forever (§201).
//  - ending 3 (EAT IT): shown-but-deferred to the next slice (the NG+ dark-save reset). Its option is enabled
//    only once lifetimeCandiesEaten > EAT_IT_THRESHOLD (§22-open content config); chooseEat is a no-op stub
//    here so the screen can wire the button without the dark-save round-trip yet.
//
// The engine reads no content FLAG value: it re-declares the ending-choice + branch-flag literals in lock-step
// with content/flags' ENDING_CHOSEN_FLAG / ENDING_HATCH / ENDING_FEED / ENDING_EAT / STARS_RELIGHTING_FLAG /
// STAR_COUNTER_FROZEN_FLAG (the moonStrata idiom, ADR §3). It MAY import content CONFIG data (EAT_IT_THRESHOLD).

/** content/flags.ENDING_CHOSEN_FLAG — the STRING (not a flag) recording which ending was taken. */
const ENDING_CHOSEN_KEY = 'endingChosen'

/** content/flags.ENDING_HATCH / ENDING_FEED / ENDING_EAT — the three terminal ending ids. */
const ENDING_HATCH = 'hatch'
const ENDING_FEED = 'feed'
const ENDING_EAT = 'eat'

/** content/flags.STARS_RELIGHTING_FLAG — ending 1: the descent inverts and the stars come back (up-tick). */
const STARS_RELIGHTING_FLAG = 'starsRelighting'

/** content/flags.STAR_COUNTER_FROZEN_FLAG — ending 2: the descent stops forever. */
const STAR_COUNTER_FROZEN_FLAG = 'starCounterFrozen'

/** The three terminal endings the player may choose. ('eat' is shown-but-deferred this slice.) */
export type Ending = 'hatch' | 'feed' | 'eat'

/**
 * Whether an ending has already been chosen — reads the endingChosen string. Once set the choice is locked
 * (commit-once): every chooseEnding call is a SAME-reference no-op. Strict presence check.
 */
export function endingChosen(state: GameState): boolean {
  return typeof state.strings[ENDING_CHOSEN_KEY] === 'string'
}

/** Which ending was chosen, or null if none yet. ('hatch' | 'feed' | 'eat'.) */
export function chosenEnding(state: GameState): Ending | null {
  const v = state.strings[ENDING_CHOSEN_KEY]
  if (v === ENDING_HATCH || v === ENDING_FEED || v === ENDING_EAT) return v
  return null
}

/**
 * Whether the choice screen is open: the star-eater has been driven off AND no ending has been taken yet. A
 * pure predicate the screen reads; once an ending is chosen this goes false forever (the choice is terminal).
 */
export function canChoose(state: GameState): boolean {
  return starEaterDefeated(state) && !endingChosen(state)
}

/**
 * Whether ending 3 (EAT IT) is offered as a SELECTABLE option: only once the player has eaten more than the
 * §22-open threshold of candies over their lifetime (the deadpan gate — you cannot eat the box until you have
 * eaten enough to think like it). The other two endings are always offered while canChoose holds; this only
 * governs whether the third button is enabled. Pure derivation over the existing lifetime stat.
 */
export function canEatIt(state: GameState): boolean {
  return state.lifetimeCandiesEaten > EAT_IT_THRESHOLD
}

// --- ending 1: LET IT HATCH (the counter ticks UP — the only up-tick in the game) ----------------------

/**
 * Choose ending 1: record endingChosen='hatch' AND set the starsRelighting flag in ONE atomic dispatch
 * (commit-once). The starCounter then inverts toward 8128 (the dragon ascends burning and relights the eaten
 * stars). A no-op returning the SAME reference once any ending is already chosen — it can never re-fire.
 */
export function chooseHatch(state: GameState): GameState {
  if (endingChosen(state)) return state
  return {
    ...state,
    strings: { ...state.strings, [ENDING_CHOSEN_KEY]: ENDING_HATCH },
    flags: { ...state.flags, [STARS_RELIGHTING_FLAG]: true },
  }
}

// --- ending 2: FEED THE SUN (zero the hoard, freeze the counter forever) --------------------------------

/**
 * Choose ending 2: record endingChosen='feed', set the starCounterFrozen flag, AND zero candies.current
 * (sacrifice the literal save hoard, §203) — all in ONE atomic dispatch (commit-once). The starCounter then
 * freezes forever, up or down. A no-op returning the SAME reference once any ending is already chosen — the
 * candy-zero + freeze can never be re-run. spendResource(all) zeroes current without touching lifetime totals
 * (lifetimeCandiesEaten survives NG+); if the hoard is already empty spendResource returns the same numbers.
 */
export function chooseFeed(state: GameState): GameState {
  if (endingChosen(state)) return state
  const zeroed = spendResource(state.candies, state.candies.current)
  return {
    ...state,
    // spendResource never returns null here (amount === current), but fall back defensively to leave candies
    // untouched rather than crash if the hoard were somehow non-finite.
    candies: zeroed ?? state.candies,
    strings: { ...state.strings, [ENDING_CHOSEN_KEY]: ENDING_FEED },
    flags: { ...state.flags, [STAR_COUNTER_FROZEN_FLAG]: true },
  }
}

// --- ending 3: EAT IT (shown-but-deferred — the NG+ dark-save reset is the next slice) ------------------

/**
 * Choose ending 3 (EAT IT): record endingChosen='eat'. The NG+ dark-save reset (engine/state/newGamePlus) is
 * the NEXT slice; this stub only latches the choice commit-once so the screen can wire the (threshold-gated)
 * button now. A no-op returning the SAME reference once any ending is already chosen.
 */
export function chooseEat(state: GameState): GameState {
  if (endingChosen(state)) return state
  return { ...state, strings: { ...state.strings, [ENDING_CHOSEN_KEY]: ENDING_EAT } }
}

/**
 * Dispatch the chosen ending. A SAME-reference no-op once any ending is already set (every effect is gated on
 * the commit-once endingChosen string, so nothing can be re-triggered or farmed). Pure & immutable.
 */
export function chooseEnding(state: GameState, ending: Ending): GameState {
  if (endingChosen(state)) return state
  if (ending === ENDING_HATCH) return chooseHatch(state)
  if (ending === ENDING_FEED) return chooseFeed(state)
  return chooseEat(state)
}

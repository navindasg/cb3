import type { GameState } from '@/engine/types/GameState'
import { spendResource } from '@/engine/types/Resource'
import { starEaterDefeated } from '@/engine/content/starEater'
import { beginDarkSave } from '@/engine/state/newGamePlus'
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
//  - ending 3 (EAT IT): sets endingChosen='eat' + the darkRun flag, then begins the NG+ DARK SAVE in the SAME
//    dispatch (§204/§286/§367) — a fresh, inverted, fully-loadable state (engine/state/newGamePlus.beginDarkSave)
//    that opens on "You have 8,100 stars" and ticks DOWN. Offered only once lifetimeCandiesEaten > EAT_IT_THRESHOLD
//    (§22-open content config). This ENDS the game (and starts the next loop). The secret completion (§367) is
//    carrying the counter back to 8128 (newGamePlus.darkRunComplete).
//
// The engine reads no content FLAG value: it re-declares the ending-choice + branch-flag literals in lock-step
// with content/flags' ENDING_CHOSEN_FLAG / ENDING_HATCH / ENDING_FEED / ENDING_EAT / STARS_RELIGHTING_FLAG /
// STAR_COUNTER_FROZEN_FLAG / DARK_RUN_FLAG (the moonStrata idiom, ADR §3). It MAY import content CONFIG data
// (EAT_IT_THRESHOLD) and engine siblings (newGamePlus.beginDarkSave).
//
// Ending 4 (the fossil-star epilogue, DESIGN §309/§16.4) is DEFERRED + signposted as polish: it would read
// stardust + the fossil and is not wired here.

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

/** content/flags.DARK_RUN_FLAG — ending 3: the NG+ dark save (the §367 inverted opening / light remix). */
const DARK_RUN_FLAG = 'darkRun'

/** The three terminal endings the player may choose ('hatch' | 'feed' | 'eat'). */
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

/**
 * Whether ending 3 (EAT IT) can be CHOSEN right now: the star-eater is driven off, no ending is committed yet,
 * AND the lifetime-candies threshold is passed (§204). canChoose && canEatIt, named for the choice. The screen
 * enables the third option on this; chooseEat begins the dark save when it holds. Pure derivation.
 */
export function canEatSun(state: GameState): boolean {
  return canChoose(state) && canEatIt(state)
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

// --- ending 3: EAT IT (the NG+ dark save — the round-trip that ENDS the game) ---------------------------

/**
 * Choose ending 3 (EAT IT): you eat the sun, and the NG+ DARK SAVE begins (§204/§286/§367). In ONE atomic
 * dispatch this records the choice (endingChosen='eat') AND the §367 inversion (the darkRun flag) AND begins a
 * fresh, inverted, fully-loadable dark save (engine/state/newGamePlus.beginDarkSave): a black-screen restart in
 * the SAME world, opening on "You have 8,100 stars," the counter ticking DOWN from 8100 (the inverted opening,
 * a light remix — NOT a second full game). Lifetime stats survive (grandma's wrapper still scales). A no-op
 * returning the SAME reference once any ending is already chosen — it can never re-fire / re-roll the dark save.
 *
 * The implementation order matters for commit-once: we latch the choice on the PREVIOUS state first (so the gate
 * reads 'eat' as committed), but the RETURNED state is the fresh dark save built by beginDarkSave — which carries
 * the darkRun flag + the endingChosen='eat' string forward so a stray re-entry on the dark save is still gated
 * (endingChosen holds). beginDarkSave starts from a fresh default + carries lifetime + sets darkRun, then we
 * stamp endingChosen='eat' onto THAT so the commit-once read holds on the new state too.
 */
export function chooseEat(state: GameState): GameState {
  if (endingChosen(state)) return state
  // The eaten sun: a brand-new dark save (fresh default + carried lifetime + the inverted opening), with the
  // choice + the §367 flag latched onto it so the commit-once gate (endingChosen) holds on the dark save itself
  // and no ending can be re-triggered / the dark save re-rolled. beginDarkSave already sets darkRun; we add the
  // ending string here so chosenEnding(dark) === 'eat' (the screen reads it; the choice is terminal).
  const dark = beginDarkSave(state)
  return {
    ...dark,
    strings: { ...dark.strings, [ENDING_CHOSEN_KEY]: ENDING_EAT },
    flags: { ...dark.flags, [DARK_RUN_FLAG]: true },
  }
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

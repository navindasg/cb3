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
//  - ending 3 (EAT IT): returns the fresh NG+ DARK SAVE built by newGamePlus.beginDarkSave (§204/§286/§367) — a
//    fresh, inverted, fully-loadable state that opens on "You have 8,100 stars" and ticks DOWN, carrying the
//    darkRun flag (beginDarkSave sets it) but NOT endingChosen. Offered only once lifetimeCandiesEaten >
//    EAT_IT_THRESHOLD (§22-open content config). This ENDS the light game and starts the next loop. Leaving
//    endingChosen UNSET is deliberate: the dark run must be able to reach its own choice again to relight the
//    counter to 8128 — the §287/§367 secret completion (newGamePlus.darkRunComplete). Farm-proofing is intact
//    because the dark save's starEaterDefeated=false already shuts canChoose/canEatSun.
//
// The engine reads no content FLAG value: it re-declares the ending-choice + branch-flag literals in lock-step
// with content/flags' ENDING_CHOSEN_FLAG / ENDING_HATCH / ENDING_FEED / ENDING_EAT / STARS_RELIGHTING_FLAG /
// STAR_COUNTER_FROZEN_FLAG (the moonStrata idiom, ADR §3; ending 3's darkRun flag is owned by newGamePlus,
// which chooseEat returns from). It MAY import content CONFIG data
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

// (ending 3's darkRun flag is owned + set by engine/state/newGamePlus.beginDarkSave, which chooseEat returns
//  directly; it is intentionally NOT re-stamped here — see chooseEat.)

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
 * Choose ending 3 (EAT IT): you eat the sun, and the NG+ DARK SAVE begins (§204/§286/§367). Returns the fresh,
 * inverted, fully-loadable dark save built by engine/state/newGamePlus.beginDarkSave: a black-screen restart in
 * the SAME world, opening on "You have 8,100 stars," the counter ticking DOWN from 8100 (the inverted opening,
 * a light remix — NOT a second full game). Lifetime stats survive (grandma's wrapper still scales). beginDarkSave
 * already sets the §367 darkRun flag. A no-op returning the SAME reference once any ending is already chosen — it
 * can never re-fire / re-roll the dark save.
 *
 * We DELIBERATELY do NOT stamp endingChosen='eat' onto the dark save. The dark run must be able to reach its own
 * choice again: a player who replays the dark loop to the star-eater and re-beats it (re-setting starEaterDefeated)
 * gets canChoose back, can pick 'let it hatch', and relight the counter toward 8128 — the §287/§367 SECRET
 * COMPLETION (newGamePlus.darkRunComplete). Stamping 'eat' forward would lock endingChosen forever and make that
 * completion unreachable. Farm-proofing is unaffected: the fresh dark save carries starEaterDefeated=false, so
 * canChoose (= starEaterDefeated && !endingChosen) and canEatSun are ALREADY shut on it regardless of endingChosen.
 */
export function chooseEat(state: GameState): GameState {
  if (endingChosen(state)) return state
  // The eaten sun: a brand-new dark save (fresh default + carried lifetime + the inverted 8100 opening + the §367
  // darkRun flag, all set by beginDarkSave). endingChosen is intentionally LEFT UNSET on the dark save so the dark
  // run can reach its own choice again and relight the counter (the §287 secret completion). Commit-once still
  // holds on THIS state: the guard above returns SAME-ref for any re-entry on an already-chosen state.
  return beginDarkSave(state)
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

import type { GameState } from '@/engine/types/GameState'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { STARTING_STARS } from '@/engine/content/starCounter'

// New Game Plus — the dark save (Act 4 — ending 3, EAT IT, DESIGN §204/§286/§367). You eat the sun; the light
// goes out; the game starts over in the SAME world, inverted. This is a PURE reducer (prev) -> a fresh, fully
// loadable GameState — not a partial patch and not a mid-transition shim. It is dispatched/persisted through the
// normal session path (dispatch -> save -> reload into the dark opener), so it must be a REAL state: it round-
// trips through export -> import -> migrate(v8) -> validate using ONLY existing fields + flags/numbers/strings
// (the z.record passthroughs), with NO schema bump (CURRENT_SCHEMA_VERSION stays 8) and NO new resource.
//
// The dark run is a light REMIX, not a second full game (§367): the opening line inverts ("You have 8,100
// stars" instead of "You have 1 candy"), the dialogue is the dark variant the darkRun flag gates, and the star
// counter — which the player spent eighteen hours watching fall — now opens already falling, from 8100, on a
// fresh save with no progress. The one thing that survives is the LIFETIME: grandma's "wrapper" still scales
// off lifetimeCandiesEaten, the only thing the box could not eat.
//
// ADR §3: the engine never imports a content FLAG value. It re-declares the darkRun + telescopeOwned literals
// here in lock-step with content/flags.DARK_RUN_FLAG and the telescope item's saveFlag (the moonStrata idiom);
// it MAY import the engine CONFIG constant STARTING_STARS from starCounter (an engine sibling, not content).

/** content/flags.DARK_RUN_FLAG — set on the fresh dark save; flips the opener/dialogue into the §367 inversion. */
const DARK_RUN_FLAG = 'darkRun'

/** The telescope item's saveFlag (re-declared in lock-step with content/items — the moonStrata idiom). Set on the
 * dark save so the star counter is visible AND already descending from the very first frame (no telescope to buy
 * again — the player has already seen the sky; the dark run opens with it falling). */
const TELESCOPE_FLAG = 'telescopeOwned'

/** numbers key the star-counter descent is anchored to. Stamped to the dark save's accumulatedGameTimeMs (0 on a
 * fresh save) so the DEFAULT descending branch ticks DOWN from THE_DARK_OPENING_STARS without re-anchoring drift. */
const TELESCOPE_BOUGHT_AT_KEY = 'telescopeBoughtAtMs'

/**
 * The inverted opening count (DESIGN §286/§367). The light run opened on "You have 1 candy" and the sky stood at
 * 8128; the dark run opens already falling, the sky at 8100 — twenty-eight stars already gone, the way you left
 * it. The counter ticks DOWN from here on the default descending branch. Content data, not logic.
 */
export const THE_DARK_OPENING_STARS = 8100

/**
 * Begin the dark save (ending 3 — EAT IT). A PURE reducer over the victory state: start from a fresh default
 * save, then carry forward ONLY what survives being eaten — the lifetime totals (grandma's wrapper still scales)
 * and the run counter (this is the next loop) — and stamp the inverted opening: the darkRun flag, the telescope
 * already owned + anchored so the counter opens falling, starsRemaining = THE_DARK_OPENING_STARS, and the EXISTING
 * ngPlusCarryover scaffold populated. The result is a real, loadable, round-tripping state (no schema bump): it
 * uses only existing fields + flag/number passthroughs, so export -> import -> migrate(v8) -> validate returns the
 * same playable dark save. Immutable: builds an entirely new object; never mutates prev.
 */
export function beginDarkSave(prev: GameState): GameState {
  const fresh = createDefaultSave()
  const nGPlusRun = prev.nGPlusRun + 1
  return {
    ...fresh,
    // The next loop's run index (drives the §367 remix / any per-loop tuning downstream).
    nGPlusRun,
    // Lifetime survives NG+ — the only thing the box could not eat (grandma's "wrapper" still scales off it).
    lifetimeCandiesEaten: prev.lifetimeCandiesEaten,
    lifetimeCandiesThrown: prev.lifetimeCandiesThrown,
    // The inverted opening: the sky opens already falling, from 8100.
    starsRemaining: THE_DARK_OPENING_STARS,
    // The dark-run flag (the §367 light remix) + the telescope already owned, anchored to this save's accumulated
    // time (0 on a fresh save) so the DEFAULT descending starCounter branch ticks DOWN from 8100 with no drift.
    flags: { ...fresh.flags, [DARK_RUN_FLAG]: true, [TELESCOPE_FLAG]: true },
    numbers: { ...fresh.numbers, [TELESCOPE_BOUGHT_AT_KEY]: fresh.accumulatedGameTimeMs },
    // The EXISTING NG+ carry-over scaffold (the snapshot the next loop carries from this one).
    ngPlusCarryover: {
      lifetimeCandiesEaten: prev.lifetimeCandiesEaten,
      starsRemaining: THE_DARK_OPENING_STARS,
      nGPlusRun,
    },
  }
}

/**
 * The §287/§367 secret completion: a dark run whose counter has been carried all the way back UP to the full sky
 * (8128). Reachable — not dead code — because chooseEat leaves endingChosen UNSET on the dark save: a player who
 * replays the dark loop to the star-eater and re-beats it (re-setting starEaterDefeated) can reach the choice
 * again, pick 'let it hatch' (which sets starsRelighting), and let the counter tick UP toward 8128 (the only
 * up-tick in the game). Signposted, not a routine win — the long way round, in the dark. A tiny derived
 * predicate; strict darkRun === true. Pure.
 */
export function darkRunComplete(state: GameState): boolean {
  return state.flags[DARK_RUN_FLAG] === true && state.starsRemaining >= STARTING_STARS
}

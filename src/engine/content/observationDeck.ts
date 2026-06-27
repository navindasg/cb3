import type { GameState } from '@/engine/types/GameState'

// The observation deck (Act 3 — Increment 5, the stage-4 reward, DESIGN §15/§189). Pure & immutable, the
// commit-once idiom of the squirrel's acorn / the kraken crown: a scripted beat that fires its one mutation
// exactly once and refuses to re-fire (SAME reference forever after). This is the emotional core — the
// player WATCHES a star die. witnessStarDie removes EXACTLY one star from starsRemaining and stamps the
// star-eater-sighted flag IN THE SAME DISPATCH, so the first-view can never be replayed for value (and there
// is nothing to farm: a star is a COST, not loot — you are watching something be taken).
//
// The deck's reach is the dysonStage4Done flag literal, re-declared here in lock-step with content/flags'
// DYSON_STAGE_DONE_FLAGS[3] and the star-eater-sighted flag with STAR_EATER_SIGHTED_FLAG (the moonStrata
// idiom — the engine never imports a content FLAG value, ADR §3). The accompanying star-counter
// acceleration lives in engine/content/starCounter; this module owns only the deck's open-gate, the
// sighted-flag read, and the one-shot star-death dispatch.

/**
 * Kept in lock-step with content/flags.DYSON_STAGE_DONE_FLAGS[3] (content owns the named array; the engine
 * re-declares the literal rather than importing the content value — ADR §3, the moonStrata idiom).
 */
const DYSON_STAGE4_DONE_FLAG = 'dysonStage4Done'

/**
 * Kept in lock-step with content/flags.STAR_EATER_SIGHTED_FLAG (the moonStrata idiom). Set by
 * witnessStarDie in the same dispatch that removes the one star; gates the scripted first-view.
 */
const STAR_EATER_SIGHTED_FLAG = 'starEaterSighted'

/** Whether the observation deck is open — gated on the fourth dyson strut (the observation gantry) raised. */
export function deckOpen(state: GameState): boolean {
  return state.flags[DYSON_STAGE4_DONE_FLAG] === true
}

/** Whether the player has already watched a star go out (the first-view has fired) — reads the flag. */
export function starEaterSighted(state: GameState): boolean {
  return state.flags[STAR_EATER_SIGHTED_FLAG] === true
}

/**
 * Watch a star go out: the scripted first-view on the deck. Removes EXACTLY one star from starsRemaining
 * (clamped at 0 — never negative) AND sets the star-eater-sighted flag, both in the SAME returned state, so
 * the beat is atomic and commit-once. Fires only when the deck is open and it has NOT already fired; every
 * other call (deck shut, or already sighted) returns the SAME reference. Immutable. starsRemaining only ever
 * decreases here, so there is nothing to farm — a star is a cost, not a reward.
 */
export function witnessStarDie(state: GameState): GameState {
  if (!deckOpen(state)) return state
  if (starEaterSighted(state)) return state
  return {
    ...state,
    starsRemaining: Math.max(0, state.starsRemaining - 1),
    flags: { ...state.flags, [STAR_EATER_SIGHTED_FLAG]: true },
  }
}

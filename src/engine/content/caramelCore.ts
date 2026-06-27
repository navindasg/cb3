import type { GameState } from '@/engine/types/GameState'
import { setNumber } from '@/engine/state/reducers'
import { CORE_STAGE_KEY, DRAGON_STAGE } from '@/content/sun/caramelCore'

// The caramel-core reveal (Act 4 — quest 12, DESIGN §15/§196/§285). Pure & immutable, mirroring
// engine/content/observationDeck + hollowCore: a non-combat reveal SECTION that the §15 larval-star spine
// LOCKS into place. No fight, no resource, no RNG — just a short march of pure transitions through the
// stages (molten caramel -> the last shell-layer -> the egg -> the half-hatched solar dragon). The stage
// cursor lives in the numbers namespace (CORE_STAGE_KEY) so a reload mid-reveal is safe (the hollowCore
// idiom); the "reached the dragon" beat lives in two flags, set TOGETHER in one dispatch (the witnessStarDie
// commit-once idiom — SAME reference forever after). The reveal is a scene, not a gate: once reached it is
// always re-viewable, and it grants nothing to farm (no resource, no loot).
//
// Reach (coreOpen) is the photosphereCleared flag literal, re-declared here in lock-step with content/flags'
// PHOTOSPHERE_CLEARED_FLAG; the two reveal flags are re-declared in lock-step with CARAMEL_CORE_REACHED_FLAG
// / SOLAR_DRAGON_MET_FLAG (the moonStrata idiom — the engine never imports a content FLAG value, ADR §3). It
// MAY import content CONFIG data (the stage cursor key + the final-stage index — data, not logic).

/**
 * Kept in lock-step with content/flags.PHOTOSPHERE_CLEARED_FLAG (the moonStrata idiom — the engine
 * re-declares the literal rather than importing the content value, ADR §3). The reveal opens once the
 * photosphere descent has reached the core (Quest 11).
 */
const PHOTOSPHERE_CLEARED_FLAG = 'photosphereCleared'

/**
 * Kept in lock-step with content/flags.CARAMEL_CORE_REACHED_FLAG (the moonStrata idiom). Set by approachCore
 * in the SAME dispatch that reaches the dragon stage — TOGETHER with the solar-dragon flag (commit-once).
 */
const CARAMEL_CORE_REACHED_FLAG = 'caramelCoreReached'

/**
 * Kept in lock-step with content/flags.SOLAR_DRAGON_MET_FLAG (the moonStrata idiom). Set TOGETHER with
 * CARAMEL_CORE_REACHED_FLAG on the dragon-stage transition; it always implies caramelCoreReached.
 */
const SOLAR_DRAGON_MET_FLAG = 'solarDragonMet'

/**
 * Whether the caramel-core reveal is open — gated on the photosphere descent having reached the core
 * (Quest 11's commit-once cleared flag). A pure derivation the screen reads. Strict === true.
 */
export function coreOpen(state: GameState): boolean {
  return state.flags[PHOTOSPHERE_CLEARED_FLAG] === true
}

/**
 * The reveal's current stage cursor (0 .. DRAGON_STAGE), read from the numbers ledger. Floored + clamped
 * into range so a corrupt/over-large value can never index past the last stage. Defaults to 0 (molten).
 */
export function coreStage(state: GameState): number {
  const raw = Math.floor(state.numbers[CORE_STAGE_KEY] ?? 0)
  if (raw < 0) return 0
  if (raw > DRAGON_STAGE) return DRAGON_STAGE
  return raw
}

/** Whether the reveal has reached the half-hatched solar dragon (the final stage) — reads the flag. Strict ===. */
export function caramelCoreReached(state: GameState): boolean {
  return state.flags[CARAMEL_CORE_REACHED_FLAG] === true
}

/** Whether the solar dragon has been met (set TOGETHER with caramelCoreReached) — reads the flag. Strict ===. */
export function solarDragonMet(state: GameState): boolean {
  return state.flags[SOLAR_DRAGON_MET_FLAG] === true
}

/** Whether the cursor sits at the final stage — the dragon is in view (the screen reads this to show the words). */
export function atDragon(state: GameState): boolean {
  return coreStage(state) >= DRAGON_STAGE
}

/**
 * Go one stage closer. A pure immutable transition that advances the cursor by EXACTLY one (it cannot skip),
 * gated on the prior stage. The call that reaches the dragon stage (DRAGON_STAGE) sets BOTH reveal flags in
 * the SAME returned state, atomically — commit-once, the witnessStarDie idiom. Once at the dragon stage every
 * further call is a no-op returning the SAME reference (the reveal is re-viewable but grants nothing to farm:
 * no resource, no loot). Also a no-op (SAME reference) while the core is shut. Immutable.
 */
export function approachCore(state: GameState): GameState {
  if (!coreOpen(state)) return state

  const stage = coreStage(state)
  if (stage >= DRAGON_STAGE) return state // already at the dragon — the commit-once no-op

  const next = stage + 1
  if (next < DRAGON_STAGE) {
    // Mid-march: just step the cursor one stage closer.
    return setNumber(state, CORE_STAGE_KEY, next)
  }

  // The step that reaches the dragon: advance the cursor AND set both reveal flags in ONE dispatch.
  return {
    ...state,
    numbers: { ...state.numbers, [CORE_STAGE_KEY]: next },
    flags: { ...state.flags, [CARAMEL_CORE_REACHED_FLAG]: true, [SOLAR_DRAGON_MET_FLAG]: true },
  }
}

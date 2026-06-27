import type { GameState } from '@/engine/types/GameState'
import { hullAtGate } from '@/engine/content/galleonUpgrade'
import { PEPPERMINT_GATE_AMOUNT } from '@/content/planet/mintPlanet'
import { bathysphereBuilt } from '@/engine/content/bathysphere'

// Act-gate predicates (DESIGN §171/§184) — pure derivations the act transitions read to know the player
// is ready. Kept tiny; the engine reads flag literals in lock-step with content/flags (the moonStrata
// idiom), so no content FLAG value is imported (ADR §3). It MAY read content CONFIG data (the §184
// peppermint threshold) and reuse a sibling engine predicate (hullAtGate) — both allowed.

/** content/flags.CELESTIAL_NAVIGATION_FLAG — learned at the lunar lighthouse (the galleon prereq). */
const CELESTIAL_NAVIGATION_FLAG = 'celestialNavigationLearned'

/** content/flags.FISHBOWL_HELM_FORGED_FLAG — first vacuum gear, the blacksmith's capstone. */
const FISHBOWL_HELM_FORGED_FLAG = 'fishbowlHelmForged'

/** content/flags.DYSON_STAGE_DONE_FLAGS[4] — the descent port raised (the final dyson stage). */
const DYSON_STAGE5_DONE_FLAG = 'dysonStage5Done'

/**
 * Whether the Act-1 gate is cleared: celestial navigation learned AND the fishbowl helm forged
 * (DESIGN §171). Both halves are required; the helm's forge entry is itself gated on navigation, so
 * in practice the helm flag implies both — but this reads both for clarity and for Act-2 to consume.
 */
export function act1GateCleared(state: GameState): boolean {
  return (
    state.flags[CELESTIAL_NAVIGATION_FLAG] === true &&
    state.flags[FISHBOWL_HELM_FORGED_FLAG] === true
  )
}

/**
 * Whether the Act-2 gate is cleared (DESIGN §184): the galleon's hull fitted to tier 3 (jawbreaker-
 * plated) AND 10,000 peppermint banked. The hull half reuses galleonUpgrade.hullAtGate; the peppermint
 * half is the mint planet's tail-end grind. The hook Act 3 (the dyson scaffold / the sun) reads.
 */
export function act2GateCleared(state: GameState): boolean {
  return hullAtGate(state) && state.peppermint.current >= PEPPERMINT_GATE_AMOUNT
}

/**
 * Whether the Act-3 gate is cleared (DESIGN §5/§190): the dyson scaffold's final stage raised (the descent
 * port — dysonStage5Done, read as a flag literal in lock-step with content/flags) AND the peppermint
 * bathysphere built (reuses bathysphere.bathysphereBuilt, a sibling engine predicate). Both halves are
 * required; the bathysphere's build is itself gated on the descent port being open, so in practice the
 * build flag implies the stage flag — but this reads both for clarity (mirroring act2GateCleared) and as
 * the Act-4 descent hook. The §194 audio cue is the Act-4 payoff; this predicate does not fire it.
 */
export function act3GateCleared(state: GameState): boolean {
  return state.flags[DYSON_STAGE5_DONE_FLAG] === true && bathysphereBuilt(state)
}

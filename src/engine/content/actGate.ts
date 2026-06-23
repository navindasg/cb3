import type { GameState } from '@/engine/types/GameState'

// Act-gate predicates (DESIGN §171) — pure derivations over flags, the hook Act 2 reads to know the
// player is ready to set sail. Kept tiny and content-agnostic; the engine reads the flag literals in
// lock-step with content/flags (the moonStrata idiom), so no content value is imported (ADR §3).

/** content/flags.CELESTIAL_NAVIGATION_FLAG — learned at the lunar lighthouse (the galleon prereq). */
const CELESTIAL_NAVIGATION_FLAG = 'celestialNavigationLearned'

/** content/flags.FISHBOWL_HELM_FORGED_FLAG — first vacuum gear, the blacksmith's capstone. */
const FISHBOWL_HELM_FORGED_FLAG = 'fishbowlHelmForged'

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

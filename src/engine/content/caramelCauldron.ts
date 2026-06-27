import type { GameState } from '@/engine/types/GameState'
import { spendResource, addResource } from '@/engine/types/Resource'
import { BOIL_CANDY_COST, CARAMEL_PER_BOIL } from '@/content/recipes/caramelBoil'

// The caramel cauldron (Act 3 — Increment 0, DESIGN §111). Pure & immutable, mirroring the spend/add
// shape of mintPlanet.harvestMint. Caramel is a RESOURCE_KEY that has had ZERO source until now; this
// gives the existing key its FIRST source, landed BEFORE any Act-3 cost draws on it (soft-lock-proof
// ordering). A strict 1:1 sink: 100 candies in, 1 caramel out — a pure converter of a resource already
// paid for, so it is NOT a farm (no loot, no flag, no transient sim). The boil button lives on the
// EXISTING village cauldron screen; only the resources move.

/** Whether you can boil a batch of caramel right now — enough candies in hand. */
export function canBoilCaramel(state: GameState): boolean {
  return state.candies.current >= BOIL_CANDY_COST
}

export interface BoilResult {
  readonly ok: boolean
  readonly state: GameState
  readonly reason?: 'unaffordable'
}

/**
 * Boil one batch: spend BOIL_CANDY_COST candies, bank CARAMEL_PER_BOIL caramel. Fails (SAME reference,
 * ok:false) when candies are short — spendResource returns null rather than overdrafting, so nothing is
 * touched. Immutable. The candy goes in sweet and comes out slow and dark.
 */
export function boilCaramel(state: GameState): BoilResult {
  const candies = spendResource(state.candies, BOIL_CANDY_COST)
  if (!candies) return { ok: false, state, reason: 'unaffordable' }

  return { ok: true, state: { ...state, candies, caramel: addResource(state.caramel, CARAMEL_PER_BOIL) } }
}

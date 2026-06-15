import type { GameState, ResourceKey } from '@/engine/types/GameState'
import type { ProducerDef } from '@/engine/types/defs'
import { addResource } from '@/engine/types/Resource'
import { computeOfflineCatchup, type OfflineCatchupResult } from '@/engine/loop/offline'
import { productionRate } from '@/engine/loop/production'

export interface CatchupOptions {
  capMs: number
}

/**
 * Credit production missed while the game was closed/backgrounded, for `elapsedMs` of real time,
 * using each producer's rate at the moment of return (linear). Mirrors the foreground tick, which
 * sums producers by resource — so EVERY produced resource accrues offline (candies, and from Act 1
 * the cumulus-commons cotton candy, and whatever later passive sources land), never just candies.
 * The time clamp + cap + Schrödinger ×2 depend only on elapsed/box, not on the rate, so each
 * resource shares them.
 *
 * Offline time does NOT advance accumulatedGameTimeMs — that counter is "active play time" and
 * drives scripted timers (the comet, tavern rumours); time spent away must not skip those.
 *
 * The returned `result` is the CANDY catch-up (the headline "you were away" figure); other
 * resources are credited onto the state but not broken out in the result.
 */
export function applyOfflineCatchup(
  state: GameState,
  elapsedMs: number,
  producers: readonly ProducerDef[],
  options: CatchupOptions,
): { state: GameState; result: OfflineCatchupResult } {
  const creditFor = (resource: ResourceKey): OfflineCatchupResult =>
    computeOfflineCatchup({
      elapsedMs,
      ratePerSec: productionRate(state, producers, resource),
      boxClosed: state.boxClosed,
      capMs: options.capMs,
    })

  // Candies are credited unconditionally (preserving the prior behaviour + the headline result).
  const result = creditFor('candies')
  let next: GameState = { ...state, candies: addResource(state.candies, result.gained) }

  // Every OTHER resource with a producer accrues too; skip inert ones (rate 0) so we don't churn
  // a fresh resource object for a delta of zero.
  const others = new Set<ResourceKey>(producers.map((p) => p.resource))
  others.delete('candies')
  for (const resource of others) {
    const credit = creditFor(resource)
    if (credit.gained === 0) continue
    next = { ...next, [resource]: addResource(next[resource], credit.gained) }
  }

  return { state: next, result }
}

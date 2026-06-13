import type { GameState, ResourceKey } from '@/engine/types/GameState'
import type { ProducerDef } from '@/engine/types/defs'

/** Sum the per-second production rate for one resource across all producers. */
export function productionRate(
  state: GameState,
  producers: readonly ProducerDef[],
  resource: ResourceKey,
): number {
  let rate = 0
  for (const producer of producers) {
    if (producer.resource === resource) rate += producer.getRate(state)
  }
  return rate
}

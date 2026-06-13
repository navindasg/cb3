import type { GameState } from '@/engine/types/GameState'
import type { ProducerDef } from '@/engine/types/defs'
import { addResource } from '@/engine/types/Resource'
import { computeOfflineCatchup, type OfflineCatchupResult } from '@/engine/loop/offline'
import { productionRate } from '@/engine/loop/production'

export interface CatchupOptions {
  capMs: number
}

/**
 * Credit candy production missed while the game was closed/backgrounded, for
 * `elapsedMs` of real time, using the candy rate at the moment of return (linear).
 *
 * Offline time does NOT advance accumulatedGameTimeMs — that counter is "active
 * play time" and drives scripted timers (the comet, tavern rumours); time spent
 * away must not skip those. Only candies accrue.
 */
export function applyOfflineCatchup(
  state: GameState,
  elapsedMs: number,
  producers: readonly ProducerDef[],
  options: CatchupOptions,
): { state: GameState; result: OfflineCatchupResult } {
  const ratePerSec = productionRate(state, producers, 'candies')
  const result = computeOfflineCatchup({
    elapsedMs,
    ratePerSec,
    boxClosed: state.boxClosed,
    capMs: options.capMs,
  })
  return {
    state: { ...state, candies: addResource(state.candies, result.gained) },
    result,
  }
}

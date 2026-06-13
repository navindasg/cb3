import type { GameState, ResourceKey } from '@/engine/types/GameState'
import type { ProducerDef } from '@/engine/types/defs'
import { addResource } from '@/engine/types/Resource'

/**
 * The pure simulation step. Returns a NEW state advanced by `dtMs` of game time.
 *
 * Reads no wall clock — the amount of time always arrives via `dtMs`, so the same
 * (state, dtMs, producers) always yields the same result. That makes the entire
 * economy unit-testable with plain numbers, no fake timers (ADR-001 D4).
 */
export function tick(
  state: GameState,
  dtMs: number,
  producers: readonly ProducerDef[],
): GameState {
  const dtSec = dtMs / 1000

  const deltas = new Map<ResourceKey, number>()
  for (const producer of producers) {
    const gained = producer.getRate(state) * dtSec
    if (gained !== 0) {
      deltas.set(producer.resource, (deltas.get(producer.resource) ?? 0) + gained)
    }
  }

  // Build the next state once (fresh object — input `state` is never mutated),
  // then populate the changed resources on the clone.
  const next: GameState = { ...state, accumulatedGameTimeMs: state.accumulatedGameTimeMs + dtMs }
  for (const [key, delta] of deltas) {
    next[key] = addResource(next[key], delta)
  }
  return next
}

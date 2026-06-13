import type { GameState } from '@/engine/types/GameState'
import type { ProducerDef } from '@/engine/types/defs'
import { tick } from '@/engine/loop/tick'
import { fireSeedEvent } from '@/engine/content/seedEvent'
import { reconcileStars } from '@/engine/content/starCounter'

// ONE lifecycle pass per committed sim step (Block H wiring). It runs the economy tick, then
// the scripted-time content reconcilers in a STABLE order so two systems that both touch
// starsRemaining stay deterministic:
//   1) tick(state, dt)              — production + accumulatedGameTimeMs advance
//   2) fireSeedEvent(state)         — the once-only act gate (a SEPARATE direct -1 star)
//   3) reconcileStars(state)        — the accumulated-time star descent (the other -1 path)
// Both seed-event and reconcile decrement starsRemaining; running them in this fixed order in
// the same pass keeps the result reproducible, and the host persists AFTER the whole pass.
// (The beanstalk cloud reveal is NOT detected here: it is a player action — feedBeanstalk
// returns reachedClouds:true — surfaced by the host at the moment of feeding, not on a tick.)
// Pure & immutable: returns a NEW state plus the i18n event keys to surface this pass.

export interface LifecycleResult {
  /** The state after the full pass (production + scripted reconcilers). */
  readonly state: GameState
  /** i18n keys for one-shot narrative beats raised this pass (the seed landing). */
  readonly events: readonly string[]
}

/**
 * Advance one lifecycle pass by `dtMs`. Surfaces the once-only seed-event narrative as i18n
 * event keys for the host to show, and runs the two star-decrement paths in a stable order.
 */
export function runLifecyclePass(
  state: GameState,
  producers: readonly ProducerDef[],
  dtMs: number,
): LifecycleResult {
  const events: string[] = []

  // 1) economy + game-time advance.
  let next = tick(state, dtMs, producers)

  // 2) the act gate: a one-off direct -1 to starsRemaining; idempotent via its guard flag.
  const seed = fireSeedEvent(next)
  next = seed.state
  if (seed.fired) {
    events.push('beanstalk.seedLands', 'beanstalk.seedAppears')
  }

  // 3) the accumulated-time star descent: a SEPARATE -1 path on the same field.
  next = reconcileStars(next)

  return { state: next, events }
}

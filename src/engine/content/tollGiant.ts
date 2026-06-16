import type { GameState } from '@/engine/types/GameState'
import { spendResource } from '@/engine/types/Resource'
import { setFlag } from '@/engine/state/reducers'

// The toll giant (Act 1, the cumulus commons bridge — the CB-series troll-bridge homage). He sits
// on the only bridge upward and will, politely, take a large pile of candies to let you pass; the
// 100k toll is one of Act 1's first big candy sinks. (Fighting him is intentionally brutal this
// early and is deferred — paying is the intended route.) Pure & immutable, like engine/shop/
// purchase: compute from state, return the next state; the SAME reference when unaffordable.

/** The candy toll the giant charges to open the bridge upward (DESIGN §8 Act 1). */
export const TOLL_GIANT_COST = 100_000

export interface TollResult {
  /** True when the toll was paid and the bridge opened. */
  readonly ok: boolean
  /** The state after paying (new on success, the SAME reference otherwise). */
  readonly state: GameState
  /** Why it failed (present only when not ok). */
  readonly reason?: 'unaffordable' | 'alreadyPaid'
}

/**
 * Pay the toll giant `cost` candies and set `paidFlag`. No-op (same reference) when already paid
 * or unaffordable — spendResource returns null rather than overdrafting, so candies are never
 * negative and lifetime totals are untouched.
 */
export function payToll(state: GameState, cost: number, paidFlag: string): TollResult {
  if (state.flags[paidFlag] === true) return { ok: false, state, reason: 'alreadyPaid' }
  const candies = spendResource(state.candies, cost)
  if (!candies) return { ok: false, state, reason: 'unaffordable' }
  return { ok: true, state: setFlag({ ...state, candies }, paidFlag) }
}

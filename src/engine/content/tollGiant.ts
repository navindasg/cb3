import type { GameState } from '@/engine/types/GameState'
import { spendResource } from '@/engine/types/Resource'
import { setFlag } from '@/engine/state/reducers'

// The toll giant (Act 1, the cumulus commons bridge — the CB-series troll-bridge homage). He sits
// on the only bridge upward and will, politely, take a large pile of candies to let you pass; the
// 100k toll is one of Act 1's first big candy sinks. (Fighting him is intentionally brutal this
// early and is deferred — paying is the intended route.) Pure & immutable, like engine/shop/
// purchase: compute from state, return the next state; the SAME reference when unaffordable.
//
// Phase 5 (§18) adds the MERCY secret: try your luck against him and lose, and the giant — who
// warned you, who would have paid himself — feels a little bad about it and knocks the toll down
// a permanent notch. A curiosity that rewards a counter-intuitive act (lose on purpose), never a
// gate: you can always just pay the full toll. The discount is a one-time flag; there is no farm.
//
// It takes TWO deliberate losses. The FIRST just gets you flattened (the §19 death line plays: "Not
// today. Pay the toll."); only sizing him up AGAIN, having already tried and lost, reads as on-purpose
// enough to earn the giant's pity and the discount. This keeps the deadpan death beat wired AND makes
// the curiosity a real, deliberate act rather than a trivial first-click optimization.

/** The candy toll the giant charges to open the bridge upward (DESIGN §8 Act 1). */
export const TOLL_GIANT_COST = 100_000

/**
 * content/flags: the flag set the first time you size up a fight with the toll giant and lose —
 * he lowers the toll out of politeness. engine re-declares the literal in lock-step (ADR §3).
 */
export const TOLL_MERCY_FLAG = 'tollGiantMercy'

/**
 * content/flags: set on the FIRST loss (you tried, you lost, the death line played). Sizing him up
 * a second time — with this already set — is what earns the mercy discount. engine re-declares the
 * literal in lock-step (ADR §3).
 */
export const TOLL_SIZED_UP_FLAG = 'tollGiantSizedUp'

/** The permanent fraction knocked off the toll once the giant has shown you mercy (10%). */
export const TOLL_MERCY_DISCOUNT = 0.1

/** Whether the giant has shown mercy (the toll is permanently discounted). */
export function hasTollMercy(state: GameState): boolean {
  return state.flags[TOLL_MERCY_FLAG] === true
}

/**
 * The candies actually owed right now: the base toll, less the 10% mercy discount when the giant
 * has shown mercy (floored to a whole candy). Pure — a plain read of state.
 */
export function currentTollCost(state: GameState, base: number = TOLL_GIANT_COST): number {
  return hasTollMercy(state) ? Math.floor(base * (1 - TOLL_MERCY_DISCOUNT)) : base
}

export interface MercyResult {
  /** True when this call was the one that earned the giant's mercy (the second, deliberate loss). */
  readonly ok: boolean
  /** True when this call was the FIRST loss — no mercy yet; the caller shows the §19 death line. */
  readonly firstLoss: boolean
  /** The state after the loss (a fresh sized-up marker, the mercy award, or SAME ref when done). */
  readonly state: GameState
}

/**
 * Lose to the toll giant on purpose. It takes TWO deliberate losses:
 *  - already merciful → SAME reference (nothing to farm; ok=false, firstLoss=false).
 *  - not yet sized up → set the sized-up marker only (you tried and lost); ok=false, firstLoss=true,
 *    so the caller plays the deadpan §19 death line ("Not today. Pay the toll.").
 *  - already sized up → NOW earn the mercy flag + discount; ok=true, firstLoss=false.
 * The discount is a one-time flag; there is no farm. Immutable throughout.
 */
export function takeTollLoss(state: GameState): MercyResult {
  if (hasTollMercy(state)) return { ok: false, firstLoss: false, state }
  if (state.flags[TOLL_SIZED_UP_FLAG] !== true) {
    return { ok: false, firstLoss: true, state: setFlag(state, TOLL_SIZED_UP_FLAG) }
  }
  return { ok: true, firstLoss: false, state: setFlag(state, TOLL_MERCY_FLAG) }
}

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

import type { GameState } from '@/engine/types/GameState'
import type { PaddockConfig } from '@/engine/types/defs'
import { spendResource } from '@/engine/types/Resource'
import { setNumber } from '@/engine/state/reducers'

// The cloud-sheep paddock (Act 1, §6) — the cumulus commons' passive cotton-candy economy.
// Buying a sheep spends candies (the price climbs per head) and bumps the head-count number;
// the cottonCandy producer (content/producers/cottonCandy) reads that count to set its rate.
// Pure & immutable, mirroring engine/shop/purchase: compute from state, return the next state.

/** The number of cloud sheep currently owned (0 when the paddock is empty). */
export function cloudSheepCount(state: GameState, config: PaddockConfig): number {
  return Math.max(0, Math.floor(state.numbers[config.countKey] ?? 0))
}

/** Candy price of the NEXT sheep, given how many are already owned. Integer, climbing per head. */
export function cloudSheepPrice(count: number, config: PaddockConfig): number {
  const owned = Math.max(0, Math.floor(count))
  return Math.floor(config.basePrice * config.priceGrowth ** owned)
}

export interface BuyResult {
  /** True when a sheep was bought. */
  readonly ok: boolean
  /** The state after the purchase (new on success, the SAME reference otherwise). */
  readonly state: GameState
  /** Why the purchase failed (present only when `ok` is false). */
  readonly reason?: 'unaffordable'
}

/**
 * Buy one cloud sheep: pay the climbing candy price, then increment the head-count. Returns the
 * SAME state reference (ok: false) when the next sheep is unaffordable. Lifetime totals untouched
 * (spending never shrinks them; addResource only grows on positive deltas).
 */
export function buyCloudSheep(state: GameState, config: PaddockConfig): BuyResult {
  const count = cloudSheepCount(state, config)
  const price = cloudSheepPrice(count, config)
  const candies = spendResource(state.candies, price)
  if (!candies) return { ok: false, state, reason: 'unaffordable' }
  const paid: GameState = { ...state, candies }
  return { ok: true, state: setNumber(paid, config.countKey, count + 1) }
}

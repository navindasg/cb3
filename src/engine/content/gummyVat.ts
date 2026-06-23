import type { GameState } from '@/engine/types/GameState'
import { spendResource } from '@/engine/types/Resource'
import { setNumber } from '@/engine/state/reducers'
import {
  GUMMY_WORM_COUNT_KEY,
  GUMMY_CANDY_COST,
  GUMMY_LICORICE_COST,
  ROCK_CANDY_PER_GUMMY_PER_SEC,
} from '@/content/gummy/molds'

// The gummy vat (Act 1 — the gummy army v1, DESIGN §12). Pure & immutable, mirroring engine/shop/
// purchase + engine/content/moonStrata: compute from state, return the next state, no-op returns the
// SAME reference. You grow a worm gummy by spending candies + a licorice essence; the count drives a
// passive rock-candy producer (content/producers/rockCandy). All progress lives in numbers.

/**
 * Kept in lock-step with content/flags.WORM_MOLD_OWNED_FLAG (content owns the named constant — the
 * moonStrata idiom). The vat opens once you hold the worm mold to press; the engine reads the literal
 * here rather than importing a content value, so the layering stays clean (ADR §3).
 */
const WORM_MOLD_FLAG = 'wormMoldOwned'

export function gummyWormCount(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[GUMMY_WORM_COUNT_KEY] ?? 0))
}

/** Whether the vat is available — you hold the worm mold (the Quest-4 drop) to press gummy into. */
export function gummyVatOpen(state: GameState): boolean {
  return state.flags[WORM_MOLD_FLAG] === true
}

/** Passive rock candy the burrowers mine per second (the producer reads the same product). */
export function gummyMiningRate(state: GameState): number {
  return gummyWormCount(state) * ROCK_CANDY_PER_GUMMY_PER_SEC
}

/** Whether a worm gummy can be grown now (vat open and both inputs affordable). */
export function canGrowGummy(state: GameState): boolean {
  return (
    gummyVatOpen(state) &&
    state.candies.current >= GUMMY_CANDY_COST &&
    state.licorice.current >= GUMMY_LICORICE_COST
  )
}

export interface GrowResult {
  readonly ok: boolean
  readonly state: GameState
  readonly reason?: 'noMold' | 'unaffordable'
}

/**
 * Grow one licorice worm gummy: spend candies + a licorice essence, increment the count. Fails (SAME
 * reference) without the worm mold, or when either input is short (spendResource returns null rather
 * than overdrafting). Immutable.
 */
export function growGummy(state: GameState): GrowResult {
  if (!gummyVatOpen(state)) return { ok: false, state, reason: 'noMold' }

  const candies = spendResource(state.candies, GUMMY_CANDY_COST)
  if (!candies) return { ok: false, state, reason: 'unaffordable' }
  const licorice = spendResource(state.licorice, GUMMY_LICORICE_COST)
  if (!licorice) return { ok: false, state, reason: 'unaffordable' }

  const paid: GameState = { ...state, candies, licorice }
  return { ok: true, state: setNumber(paid, GUMMY_WORM_COUNT_KEY, gummyWormCount(state) + 1) }
}

import type { GameState } from '@/engine/types/GameState'
import { spendResource } from '@/engine/types/Resource'
import { setNumber } from '@/engine/state/reducers'
import { flavorFusionLearned } from '@/engine/content/sourPlanet'
import {
  GUMMY_WORM_COUNT_KEY,
  GUMMY_FUSED_COUNT_KEY,
  GUMMY_CANDY_COST,
  GUMMY_LICORICE_COST,
  GUMMY_FUSED_CANDY_COST,
  GUMMY_FUSED_LICORICE_COST,
  GUMMY_FUSED_SOUR_COST,
  ROCK_CANDY_PER_GUMMY_PER_SEC,
  ROCK_CANDY_PER_FUSED_GUMMY_PER_SEC,
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

/** The grown SOUR-FUSED worm-gummy count (Act 2 — flavor fusion). */
export function gummyFusedCount(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[GUMMY_FUSED_COUNT_KEY] ?? 0))
}

/** Whether the vat is available — you hold the worm mold (the Quest-4 drop) to press gummy into. */
export function gummyVatOpen(state: GameState): boolean {
  return state.flags[WORM_MOLD_FLAG] === true
}

/** Whether the vat can grow two-flavor (sour-fused) burrowers — fusion learned from the gummy folk. */
export function fusionUnlocked(state: GameState): boolean {
  return gummyVatOpen(state) && flavorFusionLearned(state)
}

/** Passive rock candy ALL the burrowers mine per second — plain + sour-fused (the producers read the
 * same products). The fused ones chew ~2.5× harder (sour = attack). */
export function gummyMiningRate(state: GameState): number {
  return (
    gummyWormCount(state) * ROCK_CANDY_PER_GUMMY_PER_SEC +
    gummyFusedCount(state) * ROCK_CANDY_PER_FUSED_GUMMY_PER_SEC
  )
}

/** Whether a plain worm gummy can be grown now (vat open and both inputs affordable). */
export function canGrowGummy(state: GameState): boolean {
  return (
    gummyVatOpen(state) &&
    state.candies.current >= GUMMY_CANDY_COST &&
    state.licorice.current >= GUMMY_LICORICE_COST
  )
}

/** Whether a sour-fused worm gummy can be grown now (fusion learned + all three inputs affordable). */
export function canGrowFused(state: GameState): boolean {
  return (
    fusionUnlocked(state) &&
    state.candies.current >= GUMMY_FUSED_CANDY_COST &&
    state.licorice.current >= GUMMY_FUSED_LICORICE_COST &&
    state.sour.current >= GUMMY_FUSED_SOUR_COST
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

export interface GrowFusedResult {
  readonly ok: boolean
  readonly state: GameState
  readonly reason?: 'locked' | 'unaffordable'
}

/**
 * Grow one SOUR-FUSED worm gummy: the same mold worked through TWO flavors (licorice + sour), spending
 * candies + a licorice essence + a sour essence and incrementing the fused count. Fails (SAME reference)
 * until fusion is learned, or when any input is short. Immutable.
 */
export function growFusedGummy(state: GameState): GrowFusedResult {
  if (!fusionUnlocked(state)) return { ok: false, state, reason: 'locked' }

  const candies = spendResource(state.candies, GUMMY_FUSED_CANDY_COST)
  if (!candies) return { ok: false, state, reason: 'unaffordable' }
  const licorice = spendResource(state.licorice, GUMMY_FUSED_LICORICE_COST)
  if (!licorice) return { ok: false, state, reason: 'unaffordable' }
  const sour = spendResource(state.sour, GUMMY_FUSED_SOUR_COST)
  if (!sour) return { ok: false, state, reason: 'unaffordable' }

  const paid: GameState = { ...state, candies, licorice, sour }
  return { ok: true, state: setNumber(paid, GUMMY_FUSED_COUNT_KEY, gummyFusedCount(state) + 1) }
}

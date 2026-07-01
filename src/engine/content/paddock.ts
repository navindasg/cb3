import type { GameState } from '@/engine/types/GameState'
import type { PaddockConfig } from '@/engine/types/defs'
import { spendResource } from '@/engine/types/Resource'
import { setNumber } from '@/engine/state/reducers'
import {
  WOLF_SHEAR_STREAK_INDEX_KEY,
  WOLF_SHEAR_STREAK_COUNT_KEY,
  SHEAR_TO_REVEAL,
} from '@/content/sky/cloudWolf'

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

// --- the cloud wolf's shear streak (Phase 5, hidden boss 1, DESIGN §17) -----------------------------------
// Shearing the SAME sheep over and over reveals the wolf. We track a STREAK: which sheep is being sheared in a
// row (its index) and how many times running. Shear the same one → the count climbs; shear a DIFFERENT one →
// the streak resets to (that sheep, 1). At SHEAR_TO_REVEAL the wolf is available. Pure/immutable; the streak
// numbers are cosmetic until they hit the threshold, and once cloudWolfAvailable is true it STAYS true
// (re-shearing another sheep does not un-reveal it) — the reveal is monotonic, the fight commit-once by flag.

/** How many times the current run-of-shears has hit the same sheep (0 when no streak is going). */
export function shearStreakCount(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[WOLF_SHEAR_STREAK_COUNT_KEY] ?? 0))
}

/** The index of the sheep the current streak is on (or -1 when no streak is going / not yet sheared). */
export function shearStreakIndex(state: GameState): number {
  const raw = state.numbers[WOLF_SHEAR_STREAK_INDEX_KEY]
  return raw === undefined ? -1 : Math.floor(raw)
}

/**
 * content/flags.CLOUD_WOLF_REVEALED_FLAG, re-declared here in lock-step (the moonStrata idiom, ADR §3 — the
 * engine never imports the content flag VALUE). Latched the moment the shear streak first reaches the
 * threshold, so the wolf stays revealed even after the streak resets (shearing another sheep afterward).
 */
const CLOUD_WOLF_REVEALED_FLAG = 'cloudWolfRevealed'

/** Whether the cloud wolf has been revealed — the same sheep was sheared SHEAR_TO_REVEAL times running. Reads
 * the LATCHED flag (set by shearSheep the turn the streak hits the threshold), so it is monotonic: shearing a
 * different sheep afterward resets the streak count but never un-reveals the wolf. The fight itself is further
 * gated commit-once by CLOUD_WOLF_DEFEATED_FLAG (the screen). */
export function cloudWolfAvailable(state: GameState): boolean {
  return state.flags[CLOUD_WOLF_REVEALED_FLAG] === true
}

/**
 * Shear the sheep at `index` (0-based). Bumps the streak if it is the SAME sheep as last time, else resets the
 * streak to (index, 1). When the streak reaches SHEAR_TO_REVEAL, LATCHES the reveal flag (once) so the wolf
 * stays available thereafter. Returns a new state; the streak numbers + the reveal flag ride the z.record
 * passthroughs (no schema bump). A pure counter — nothing to spend, nothing to farm: the reveal is a one-way
 * latch and the fight/drop are gated commit-once by the cleared flag.
 */
export function shearSheep(state: GameState, index: number): GameState {
  const i = Math.max(0, Math.floor(index))
  const sameSheep = shearStreakIndex(state) === i
  const nextCount = sameSheep ? shearStreakCount(state) + 1 : 1
  const withIndex = setNumber(state, WOLF_SHEAR_STREAK_INDEX_KEY, i)
  const bumped = setNumber(withIndex, WOLF_SHEAR_STREAK_COUNT_KEY, nextCount)
  if (nextCount < SHEAR_TO_REVEAL || bumped.flags[CLOUD_WOLF_REVEALED_FLAG] === true) return bumped
  return { ...bumped, flags: { ...bumped.flags, [CLOUD_WOLF_REVEALED_FLAG]: true } }
}

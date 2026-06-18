import type { GameState } from '@/engine/types/GameState'
import type { StratumDef, MoonPickDef } from '@/engine/types/defs'
import { addResource, spendResource } from '@/engine/types/Resource'
import { setNumber } from '@/engine/state/reducers'
import {
  MOON_PICK_TIER_KEY,
  MOON_STRATUM_KEY,
  MOON_DIGS_KEY,
  WORM_TUNNEL_MIN_STRATUM,
  WORM_MOLD_YIELD_MULT,
} from '@/content/moon/strata'

// Jawbreaker-moon strata mining (Act 1, §6/§8 — v1). Pure & immutable, mirroring engine/shop/
// purchase + engine/content/paddock: compute from state, return the next state. Mining a stratum
// yields rock candy and digs toward the next; a too-soft pick can't break the next layer (the
// tool-tier gate). Upgrading the pick spends its price lines. All progress lives in numbers.

/**
 * Kept in lock-step with content/flags.WORM_MOLD_OWNED_FLAG (content owns the named constant — the
 * beanstalk-thickened idiom). Owning the worm mold doubles every dig's haul; the engine reads the
 * literal here rather than importing a content value, so the layering stays clean (ADR §3).
 */
const WORM_MOLD_FLAG = 'wormMoldOwned'

export function moonPickTier(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[MOON_PICK_TIER_KEY] ?? 0))
}

function stratumIndex(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[MOON_STRATUM_KEY] ?? 0))
}

function digs(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[MOON_DIGS_KEY] ?? 0))
}

/** The stratum currently being mined, or null when every stratum has been cleared. */
export function currentStratum(state: GameState, strata: readonly StratumDef[]): StratumDef | null {
  return strata[stratumIndex(state)] ?? null
}

/** Digs sunk into the current stratum so far (for the HUD's progress readout). */
export function stratumProgress(state: GameState): number {
  return digs(state)
}

/**
 * Whether the moon worm's tunnels have opened — true once your digging has broken at least into the
 * cobalt stratum (you intersect the bore-holes the worm has chewed). Drives the moon screen's
 * worm-tunnel affordance; pure, derived from the existing mining-depth number (no new flag needed).
 */
export function wormTunnelsOpen(state: GameState): boolean {
  return stratumIndex(state) >= WORM_TUNNEL_MIN_STRATUM
}

/** Rock-candy yield multiplier from the worm mold's burrower boost — doubled while it is owned. */
export function miningYieldMultiplier(state: GameState): number {
  return state.flags[WORM_MOLD_FLAG] === true ? WORM_MOLD_YIELD_MULT : 1
}

/** The next pick upgrade available (tier === current + 1), or null at the top of the ladder. */
export function nextPick(state: GameState, picks: readonly MoonPickDef[]): MoonPickDef | null {
  const target = moonPickTier(state) + 1
  return picks.find((p) => p.tier === target) ?? null
}

/** Whether a dig would succeed now (a current stratum exists and the pick is strong enough). */
export function canMine(state: GameState, strata: readonly StratumDef[]): boolean {
  const stratum = currentStratum(state, strata)
  return stratum !== null && moonPickTier(state) >= stratum.requiredPickTier
}

/** Whether the next pick upgrade exists and every price line is affordable. */
export function canUpgradePick(state: GameState, picks: readonly MoonPickDef[]): boolean {
  const pick = nextPick(state, picks)
  return pick !== null && pick.price.every((line) => state[line.resource].current >= line.amount)
}

export interface MineResult {
  readonly ok: boolean
  readonly state: GameState
  /** Rock candy gained this dig (0 when the dig failed). */
  readonly gained: number
  /** True on the dig that broke through to the next stratum. */
  readonly advanced: boolean
  /** Why the dig failed (present only when not ok). */
  readonly reason?: 'pickTooWeak' | 'depleted'
}

/**
 * Mine one dig of the current stratum. Adds its rock-candy yield and advances the dig count;
 * breaking through (digs >= digsToClear) moves to the next stratum. Fails (SAME reference) when
 * every stratum is cleared, or when the pick tier is below the stratum's requirement.
 */
export function mineStratum(state: GameState, strata: readonly StratumDef[]): MineResult {
  const stratum = currentStratum(state, strata)
  if (!stratum) return { ok: false, state, gained: 0, advanced: false, reason: 'depleted' }
  if (moonPickTier(state) < stratum.requiredPickTier) {
    return { ok: false, state, gained: 0, advanced: false, reason: 'pickTooWeak' }
  }

  const gain = stratum.yieldPerDig * miningYieldMultiplier(state) // the worm mold doubles the haul
  const banked: GameState = { ...state, rockCandy: addResource(state.rockCandy, gain) }
  const sunk = digs(state) + 1
  const advanced = sunk >= stratum.digsToClear
  const next = advanced
    ? setNumber(setNumber(banked, MOON_STRATUM_KEY, stratumIndex(state) + 1), MOON_DIGS_KEY, 0)
    : setNumber(banked, MOON_DIGS_KEY, sunk)

  return { ok: true, state: next, gained: gain, advanced }
}

export interface PickUpgradeResult {
  readonly ok: boolean
  readonly state: GameState
  readonly reason?: 'maxTier' | 'unaffordable'
}

/**
 * Upgrade to the next pick tier, paying its price lines. No-op (SAME reference) at the top of the
 * ladder or when any price line is unaffordable (spendResource returns null rather than overdraft).
 */
export function upgradePick(state: GameState, picks: readonly MoonPickDef[]): PickUpgradeResult {
  const pick = nextPick(state, picks)
  if (!pick) return { ok: false, state, reason: 'maxTier' }

  let paid: GameState = state
  for (const line of pick.price) {
    const spent = spendResource(paid[line.resource], line.amount)
    if (!spent) return { ok: false, state, reason: 'unaffordable' }
    paid = { ...paid, [line.resource]: spent }
  }
  return { ok: true, state: setNumber(paid, MOON_PICK_TIER_KEY, pick.tier) }
}

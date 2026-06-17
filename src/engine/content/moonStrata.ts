import type { GameState } from '@/engine/types/GameState'
import type { StratumDef, MoonPickDef } from '@/engine/types/defs'
import { addResource, spendResource } from '@/engine/types/Resource'
import { setNumber } from '@/engine/state/reducers'
import {
  MOON_PICK_TIER_KEY,
  MOON_STRATUM_KEY,
  MOON_DIGS_KEY,
} from '@/content/moon/strata'

// Jawbreaker-moon strata mining (Act 1, §6/§8 — v1). Pure & immutable, mirroring engine/shop/
// purchase + engine/content/paddock: compute from state, return the next state. Mining a stratum
// yields rock candy and digs toward the next; a too-soft pick can't break the next layer (the
// tool-tier gate). Upgrading the pick spends its price lines. All progress lives in numbers.

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

  const banked: GameState = { ...state, rockCandy: addResource(state.rockCandy, stratum.yieldPerDig) }
  const sunk = digs(state) + 1
  const advanced = sunk >= stratum.digsToClear
  const next = advanced
    ? setNumber(setNumber(banked, MOON_STRATUM_KEY, stratumIndex(state) + 1), MOON_DIGS_KEY, 0)
    : setNumber(banked, MOON_DIGS_KEY, sunk)

  return { ok: true, state: next, gained: stratum.yieldPerDig, advanced }
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

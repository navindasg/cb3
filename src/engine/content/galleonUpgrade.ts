import type { GameState } from '@/engine/types/GameState'
import { spendResource } from '@/engine/types/Resource'
import { setNumber } from '@/engine/state/reducers'
import type { GalleonTier, GalleonTrack } from '@/content/ship/galleonUpgrade'
import { GALLEON_HULL_KEY, GALLEON_HULL_GATE_TIER } from '@/content/ship/galleonUpgrade'

// The galleon's outfitting (Act 2 — the shipwright's yard, DESIGN §13/§269). Pure & immutable,
// mirroring engine/content/moonStrata.upgradePick: compute from state, return the next state, a no-op
// returns the SAME reference. Each track's tier lives in a numbers key (default 1, the commissioned
// base). Upgrading spends the next tier's price lines and consumes its one-off item (storm-silk -> the
// sail) if it has one. Deferred tiers (their material not yet in the game) cannot be bought.

/** The current tier of a track (defaults to 1, the commissioned base). */
export function trackTier(state: GameState, key: string): number {
  return Math.max(1, Math.floor(state.numbers[key] ?? 1))
}

/** The next tier up a track, or null at the top. */
export function nextTier(state: GameState, track: GalleonTrack): GalleonTier | null {
  return track.tiers.find((t) => t.tier === trackTier(state, track.key) + 1) ?? null
}

/** Whether a one-off item this tier consumes is in hand (true when the tier consumes nothing). */
function hasRequiredItem(state: GameState, tier: GalleonTier): boolean {
  return tier.consumes ? state.flags[tier.consumes.flag] === true : true
}

/** Whether a tier's unlock milestone is reached (true when the tier has no flag gate). The flag string is
 * supplied by content (data, not an engine value) — the engine just reads it, so layering holds (ADR §3). */
function unlockFlagSet(state: GameState, tier: GalleonTier): boolean {
  return tier.unlockFlag ? state.flags[tier.unlockFlag] === true : true
}

/** Whether the next tier exists, is buildable (not deferred), its unlock milestone is reached, its item (if
 * any) is in hand, and every price line is affordable. */
export function canUpgrade(state: GameState, track: GalleonTrack): boolean {
  const tier = nextTier(state, track)
  return (
    tier !== null &&
    !tier.deferred &&
    unlockFlagSet(state, tier) &&
    hasRequiredItem(state, tier) &&
    (tier.price ?? []).every((line) => state[line.resource].current >= line.amount)
  )
}

/** Whether the galleon's hull is at the Act-2 gate tier (jawbreaker-plated) — half the §184 act gate. */
export function hullAtGate(state: GameState): boolean {
  return trackTier(state, GALLEON_HULL_KEY) >= GALLEON_HULL_GATE_TIER
}

export interface UpgradeResult {
  readonly ok: boolean
  readonly state: GameState
  readonly reason?: 'maxTier' | 'deferred' | 'locked' | 'missingItem' | 'unaffordable'
}

/**
 * Raise a track one tier: pay its price lines and consume its one-off item (clearing both the saveFlag
 * and the ownedItems entry — the keepsake becomes the fitting). No-op (SAME reference) at the top of
 * the track, on a deferred tier, before its unlock milestone (`locked`), without the required item, or
 * when any price line is unaffordable (spendResource returns null rather than overdraft). Immutable.
 */
export function upgradeGalleon(state: GameState, track: GalleonTrack): UpgradeResult {
  const tier = nextTier(state, track)
  if (!tier) return { ok: false, state, reason: 'maxTier' }
  if (tier.deferred) return { ok: false, state, reason: 'deferred' }
  if (!unlockFlagSet(state, tier)) return { ok: false, state, reason: 'locked' }
  if (!hasRequiredItem(state, tier)) return { ok: false, state, reason: 'missingItem' }

  let paid: GameState = state
  for (const line of tier.price ?? []) {
    const spent = spendResource(paid[line.resource], line.amount)
    if (!spent) return { ok: false, state, reason: 'unaffordable' }
    paid = { ...paid, [line.resource]: spent }
  }

  if (tier.consumes) {
    paid = {
      ...paid,
      flags: { ...paid.flags, [tier.consumes.flag]: false },
      ownedItems: { ...paid.ownedItems, [tier.consumes.itemId]: false },
    }
  }

  return { ok: true, state: setNumber(paid, track.key, tier.tier) }
}

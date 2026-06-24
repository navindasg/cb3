import type { PriceLine } from '@/engine/types/defs'

// The candied galleon's outfitting tracks (Act 2 — the shipwright's yard, DESIGN §13/§269-272). Pure
// data the engine (engine/content/galleonUpgrade) reads. Three tracks the player raises tier by tier:
// the HULL (hardtack -> ironbark -> jawbreaker-plated; tier 3 is half the Act-2 gate, §184), the SAILS
// (cotton candy -> storm-silk -> solar), and the CANNONS (gumball broadside -> pop rock guns -> nougat
// bombard). Tier 1 of each is the commissioned base. The stats these set are read by ship combat in a
// later slice (Sourbeard, §127); the tangible payoff NOW is consuming the storm-silk keepsake into the
// sail tier-2 and building toward the Act-2 hull gate. §22-open tuning.

/** numbers-namespace keys for the galleon's outfitting tiers (each defaults to 1, the commissioned base). */
export const GALLEON_HULL_KEY = 'galleonHull'
export const GALLEON_SAILS_KEY = 'galleonSails'
export const GALLEON_CANNON_KEY = 'galleonCannon'

/** Hull tier 3 (jawbreaker-plated) — the galleon half of the Act-2 gate (the other half is peppermint). */
export const GALLEON_HULL_GATE_TIER = 3

/** One tier in an upgrade track. Tier 1 is the base (no price). A tier may consume a one-off item
 * (the storm-silk keepsake -> the sail), or be `deferred` (shown locked until a later slice supplies
 * its material). */
export interface GalleonTier {
  readonly tier: number
  readonly name: string
  /** Cost to reach this tier from the previous one (absent on the base tier). */
  readonly price?: readonly PriceLine[]
  /** A one-off item this tier consumes — gated on its saveFlag, cleared (flag + ownedItems) on buy. */
  readonly consumes?: { readonly flag: string; readonly itemId: string }
  /** Shown but not yet buildable (its material lands in a later slice); `note` says why. */
  readonly deferred?: boolean
  readonly note?: string
}

/** A named outfitting track over a numbers key. */
export interface GalleonTrack {
  readonly key: string
  readonly label: string
  readonly tiers: readonly GalleonTier[]
}

const HULL_TIERS: readonly GalleonTier[] = [
  { tier: 1, name: 'hardtack hull' },
  { tier: 2, name: 'ironbark hull', price: [{ resource: 'rockCandy', amount: 400 }, { resource: 'candies', amount: 300_000 }] },
  {
    tier: 3,
    name: 'jawbreaker-plated hull',
    price: [{ resource: 'rockCandy', amount: 1_500 }, { resource: 'candies', amount: 1_500_000 }],
  },
]

const SAIL_TIERS: readonly GalleonTier[] = [
  { tier: 1, name: 'cotton-candy sails' },
  {
    tier: 2,
    name: 'storm-silk sails',
    price: [{ resource: 'cottonCandy', amount: 250 }],
    consumes: { flag: 'stormSilkOwned', itemId: 'stormSilk' }, // the thunderhead djinn's drop, become a sail
  },
  { tier: 3, name: 'solar sails', deferred: true, note: 'woven from a stage-3 dyson-scaffold reward (Act 3)' },
]

const CANNON_TIERS: readonly GalleonTier[] = [
  { tier: 1, name: 'gumball broadside' },
  {
    tier: 2,
    name: 'pop rock guns',
    price: [{ resource: 'popRocks', amount: 120 }, { resource: 'candies', amount: 500_000 }],
  },
  { tier: 3, name: 'the nougat bombard', deferred: true, note: 'a late-Act-2 forge commission' },
]

/** The three outfitting tracks, in the order the yard lists them. */
export const GALLEON_TRACKS: readonly GalleonTrack[] = [
  { key: GALLEON_HULL_KEY, label: 'hull', tiers: HULL_TIERS },
  { key: GALLEON_SAILS_KEY, label: 'sails', tiers: SAIL_TIERS },
  { key: GALLEON_CANNON_KEY, label: 'cannons', tiers: CANNON_TIERS },
]

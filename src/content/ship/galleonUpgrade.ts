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
 * (the storm-silk keepsake -> the sail), be `deferred` (shown locked until a later slice supplies its
 * material), or be gated behind an `unlockFlag` (priced + buildable, but only once a later milestone is
 * reached — e.g. the solar sails, gated on the stage-3 dyson reward). */
export interface GalleonTier {
  readonly tier: number
  readonly name: string
  /** Cost to reach this tier from the previous one (absent on the base tier). */
  readonly price?: readonly PriceLine[]
  /** A one-off item this tier consumes — gated on its saveFlag, cleared (flag + ownedItems) on buy. */
  readonly consumes?: { readonly flag: string; readonly itemId: string }
  /** A flag that must be set before this (priced) tier is buildable; absent ⇒ no flag gate. The flag is a
   * content-owned milestone (e.g. the stage-3 dyson reward) — the engine compares the same literal it is
   * given here (data, not an engine value), so layering holds (ADR §3). The `note` says what unlocks it. */
  readonly unlockFlag?: string
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
  {
    tier: 3,
    name: 'solar sails',
    // Act 3 — Increment 4: un-deferred. Woven from the stage-3 dyson reward (the star sea), so the price
    // draws the stardust the trawlers now sweep, plus candies. Gated on dysonStage3Done (the outer bracing
    // raised), so the sails surface in the yard only once the star sea is open. §22-open.
    price: [{ resource: 'stardust', amount: 200 }, { resource: 'candies', amount: 50_000_000 }],
    unlockFlag: 'dysonStage3Done',
    note: 'woven from the star sea — raise the dyson scaffold to stage 3 first',
  },
]

const CANNON_TIERS: readonly GalleonTier[] = [
  { tier: 1, name: 'gumball broadside' },
  {
    tier: 2,
    name: 'pop rock guns',
    price: [{ resource: 'popRocks', amount: 120 }, { resource: 'candies', amount: 500_000 }],
  },
  {
    tier: 3,
    name: 'the nougat bombard',
    // Act 4 — the star-eater finale (review): un-deferred. The §198 broadside phase reads the galleon's
    // maxed tiers, and that fight is only winnable with cannon t3 (the grid-searched balance), so the top
    // gun must be buildable. Mirrors the solar sails' un-defer (the t3 above): a real price + an unlockFlag.
    // Priced in the pop rocks the comet sweeps (the cannon's own ammo) plus candies, gated on dysonStage3Done
    // (the star sea — the same late milestone the solar sails open on), so the bombard surfaces in the yard
    // once the late-game economy is open and well before the finale. §22-open.
    price: [{ resource: 'popRocks', amount: 250 }, { resource: 'candies', amount: 80_000_000 }],
    unlockFlag: 'dysonStage3Done',
    note: 'a late forge commission — raise the dyson scaffold to stage 3 first',
  },
]

/** The three outfitting tracks, in the order the yard lists them. */
export const GALLEON_TRACKS: readonly GalleonTrack[] = [
  { key: GALLEON_HULL_KEY, label: 'hull', tiers: HULL_TIERS },
  { key: GALLEON_SAILS_KEY, label: 'sails', tiers: SAIL_TIERS },
  { key: GALLEON_CANNON_KEY, label: 'cannons', tiers: CANNON_TIERS },
]

import type { StratumDef, MoonPickDef } from '@/engine/types/defs'

// The jawbreaker moon's strata + pick ladder (Act 1 — strata mining v1). Pure data the engine
// (engine/content/moonStrata) reads. Each stratum is harder and yields more rock candy than the
// last, and is gated on a pick tier (DESIGN §8: "each colored layer breaks your current pick").
// You arrive holding the candy pick (tier 1, granted free); the iron pick and the rock candy drill
// are bought at the lunar outfitter. Yields/costs/depths are §22-open tuning knobs.

/** numbers-namespace keys for the moon's mining progress. */
export const MOON_PICK_TIER_KEY = 'moonPickTier'
export const MOON_STRATUM_KEY = 'moonStratum'
export const MOON_DIGS_KEY = 'moonDigs'

/** The pick tier the lunar outfitter hands every arrival for free (the candy pick). */
export const STARTER_PICK_TIER = 1

export const MOON_STRATA: readonly StratumDef[] = [
  { id: 'sugarCrust', displayKey: 'moon.stratum.sugarCrust', requiredPickTier: 1, yieldPerDig: 3, digsToClear: 6 },
  { id: 'cobaltCandy', displayKey: 'moon.stratum.cobaltCandy', requiredPickTier: 2, yieldPerDig: 8, digsToClear: 10 },
  { id: 'jawbreakerCore', displayKey: 'moon.stratum.jawbreakerCore', requiredPickTier: 3, yieldPerDig: 20, digsToClear: 14 },
]

// The buyable upgrades (tier 1, the candy pick, is the free starter — not listed here). Each pick's
// rock-candy cost is set BELOW what the stratum it unlocks past yields, so the moon funds itself
// and never soft-locks: the sugar crust yields 18 rock candy (3×6) → the iron pick costs 15; the
// cobalt stratum yields 80 (8×10) → the drill costs 60. Candy costs lean on the Act-1 hoard.
export const MOON_PICKS: readonly MoonPickDef[] = [
  {
    tier: 2,
    displayKey: 'moon.pick.ironPick',
    price: [
      { resource: 'candies', amount: 50_000 },
      { resource: 'rockCandy', amount: 15 },
    ],
  },
  {
    tier: 3,
    displayKey: 'moon.pick.rockCandyDrill',
    price: [
      { resource: 'candies', amount: 250_000 },
      { resource: 'rockCandy', amount: 60 },
    ],
  },
]

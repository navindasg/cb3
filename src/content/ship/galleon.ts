import type { ResourceKey } from '@/engine/types/GameState'

// The candied galleon — Act 2's opening commission (DESIGN §13/§177). The sky port's shipwright takes
// a materials commission; the player fills it over time, then names the ship and she is laid down at
// the dock. Pure data the engine (engine/content/galleonCommission) reads; ship combat, hull tiers,
// drift (zero-G), and the sail/hull UPGRADE tiers (storm-silk -> solar sails, the caramel-reinforced
// hull — DESIGN §13/§269) are later slices — this v1 establishes the hub, the major sink, and the
// naming beat (the §18 "Candy Box" consequence reads the stored name later).
//
// EVERY LINE DRAWS ON A RESOURCE THE PLAYER ALREADY PRODUCES at the Act-1 -> Act-2 boundary (candies,
// rock candy, licorice, cotton candy) — never an unobtainable one, so the commission can actually be
// completed. DESIGN §177 also lists caramel (the hull) as a material, but caramel has no source in
// the game yet; it joins the later hull-UPGRADE tier rather than gating the opening commission. The
// hull here is the moon's own jawbreaker plate (rock candy); the sails are cotton candy.
//
// SCALED v1 costs (~1/10 of the DESIGN §177 figures: 5M candies / 5k licorice / 1k jawbreaker plate /
// 2k cotton-candy sails) so the commission completes in a playtest at Act-1 income. Real balance is a
// §22-open knob, re-tuned once Act-2 income (the reef + drift) lands.

/** numbers-namespace key prefix for the per-resource contribution ledger (one key per line). */
export const GALLEON_CONTRIB_PREFIX = 'galleonContrib_'

/** strings-namespace key holding the name the player gives the galleon (the §18 "Candy Box" hook). */
export const GALLEON_NAME_KEY = 'galleonName'

/** One line of the commission: how much of a resource the shipwright needs, and what it becomes. */
export interface CommissionLine {
  readonly resource: ResourceKey
  /** Total required to complete this line. */
  readonly amount: number
  /** Display label for the line — the ship part this material becomes. */
  readonly part: string
}

/** The galleon commission (DESIGN §177, scaled v1). Order = the order the dock readout lists them. */
export const GALLEON_COMMISSION: readonly CommissionLine[] = [
  { resource: 'candies', amount: 500_000, part: "the shipwright's fee" },
  { resource: 'rockCandy', amount: 100, part: 'the jawbreaker-plated hull' },
  { resource: 'licorice', amount: 500, part: 'the rigging' },
  { resource: 'cottonCandy', amount: 200, part: 'the sails' },
]

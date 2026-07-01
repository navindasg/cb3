import type { ResourceKey } from '@/engine/types/GameState'
import type { PriceLine, ProducerDef } from '@/engine/types/defs'
import { CANDY_PRODUCERS } from '@/content/producers/candy'
import { COTTON_CANDY_PRODUCERS } from '@/content/producers/cottonCandy'
import { LICORICE_PRODUCERS } from '@/content/producers/licorice'
import { ROCK_CANDY_PRODUCERS } from '@/content/producers/rockCandy'
import { PEPPERMINT_PRODUCERS } from '@/content/producers/peppermint'
import { SOLAR_COLLECTOR_PRODUCERS } from '@/content/producers/solarCollector'
import { CARAMEL_PRODUCERS } from '@/content/producers/caramel'
import { STARDUST_PRODUCERS } from '@/content/producers/stardust'
import { DYSON_STAGES } from '@/content/sun/dysonScaffold'
import { GALLEON_TRACKS } from '@/content/ship/galleonUpgrade'
import { FORGE_ENTRIES } from '@/content/shops/forge'
import { SHOP_ENTRIES } from '@/content/shops/shop'
import { BALLOON_ENTRY } from '@/content/sky/balloon'
import { GALLEON_COMMISSION } from '@/content/ship/galleon'
import { MOON_PICKS } from '@/content/moon/strata'
import { OBSERVATORY_ENTRIES } from '@/content/shops/observatory'
import { HERMIT_SHOP } from '@/content/void/voidWhale'
import { DESCENT_COST } from '@/content/sun/photosphere'
import {
  CONDENSER_ROCK_CANDY_COST,
  CONDENSER_CANDY_COST,
  MINT_HARVEST_CANDY_COST,
  PEPPERMINT_GATE_AMOUNT,
} from '@/content/planet/mintPlanet'
import { SOUR_TRADE_CANDY_COST } from '@/content/planet/sourPlanet'
import {
  GUMMY_CANDY_COST,
  GUMMY_LICORICE_COST,
  GUMMY_FUSED_CANDY_COST,
  GUMMY_FUSED_LICORICE_COST,
  GUMMY_FUSED_SOUR_COST,
  GUMMY_MINT_FUSED_CANDY_COST,
  GUMMY_MINT_FUSED_LICORICE_COST,
  GUMMY_MINT_FUSED_MINT_COST,
  WORK_CREW_CANDY_COST,
  WORK_CREW_LICORICE_COST,
} from '@/content/gummy/molds'
import { BATHYSPHERE_PRICE } from '@/content/sun/bathysphere'
import {
  SOLAR_COLLECTOR_CANDY_COST,
  SOLAR_COLLECTOR_ROCK_CANDY_COST,
  CARAMEL_COLLECTOR_CANDY_COST,
} from '@/content/sun/solarWorks'
import { STAR_TRAWLER_CANDY_COST, STAR_TRAWLER_CARAMEL_COST } from '@/content/sun/starSea'
import { FOSSIL_STAR_COST } from '@/content/mines/fossilStar'

// The objective balance audit (Phase 5 — DESIGN §5). A PURE analysis layer over the *finished* content
// graph: it walks the real producer/cost registries and derives objective facts the balance test asserts.
// It fixes nothing and tunes nothing — subjective pacing is the human playtest's job (§22-open). It only
// makes the economy's INVARIANTS machine-checkable so a future edit that reintroduces the caramel-soft-lock
// class (a cost priced in a resource with no faucet yet, an act gate you cannot reach, a dead exploit) fails
// a test instead of shipping.
//
// Layering (ADR §3): this is engine LOGIC over content CONFIG DATA (producer defs, price lines, gate costs
// — all plain records). It imports content config, which is allowed; it imports NO content FLAG value and no
// render glue. The result is a set of pure derivations the test drives; there is no screen and no state
// mutation.

// --- resource sources -----------------------------------------------------------------------------------
// A resource is "obtainable" if it has a live SOURCE: either a passive producer (a ProducerDef whose getRate
// can exceed 0) OR an active faucet (a manual conversion / a transient-sim drop the player can perform). The
// passive set is derived from the real producer registries below; the active set is the hand-authored ledger
// of every manual/drop faucet, each annotated with where it lives (so the ledger is auditable, not magic).

/** Every passive producer the bootstrap wires (the tick sums getRate over these, keyed by resource). */
export const ALL_PRODUCERS: readonly ProducerDef[] = [
  ...CANDY_PRODUCERS,
  ...COTTON_CANDY_PRODUCERS,
  ...LICORICE_PRODUCERS,
  ...ROCK_CANDY_PRODUCERS,
  ...PEPPERMINT_PRODUCERS,
  ...SOLAR_COLLECTOR_PRODUCERS,
  ...CARAMEL_PRODUCERS,
  ...STARDUST_PRODUCERS,
]

/** The resources that carry a passive producer (a ProducerDef targets them). */
export function passivelySourcedResources(): ReadonlySet<ResourceKey> {
  return new Set(ALL_PRODUCERS.map((p) => p.resource))
}

/**
 * A hand-authored, hand-audited ledger of every ACTIVE (non-producer) resource faucet in the game — the
 * manual conversions and the transient-sim drops. Each entry names WHERE the faucet lives so the ledger can
 * be spot-checked against the code. This is the second half of "obtainable": a resource with no producer is
 * still fine if the player can actively make/win it (rock candy is mined by hand long before the burrowers
 * exist; caramel is boiled before the collectors; sour/mint/pop-rocks/stardust are traded or won).
 */
export interface ActiveFaucet {
  readonly resource: ResourceKey
  /** Human-readable provenance — the module + verb that produces this resource on demand. */
  readonly where: string
}

export const ACTIVE_FAUCETS: readonly ActiveFaucet[] = [
  // candies: the field patch pours from the first frame (a producer too), plus eating/throwing loops.
  { resource: 'candies', where: 'the field patch (baseline income, always flowing)' },
  // rock candy: mined by hand at the jawbreaker-moon strata long before any burrower exists.
  { resource: 'rockCandy', where: 'engine/content/moonStrata.dig (manual mining)' },
  // caramel: boiled from candies at the village cauldron before the solar collectors scale it.
  { resource: 'caramel', where: 'engine/content/caramelCauldron.boil (candies -> caramel)' },
  // sour: traded from the gummy folk on the sour planet (candies -> sour, a fusion input).
  { resource: 'sour', where: 'engine/content/sourPlanet.tradeForSour (candies -> sour)' },
  // mint: harvested from the frozen frost wyrm's breath on the mint planet (candies -> mint).
  { resource: 'mint', where: 'engine/content/mintPlanet.harvestMint (candies -> mint)' },
  // pop rocks: shaken loose by catching the comet (the lead-the-target harpoon).
  { resource: 'popRocks', where: 'render/cometScreens catch dispatch (comet catch reward)' },
  // stardust: shaken loose alongside pop rocks on the same comet catch (before the star-sea trawlers).
  { resource: 'stardust', where: 'render/cometScreens catch dispatch (comet catch reward)' },
  // chocolate: won from the space squirrel's riddles (content/reef/squirrel.chocolateReward) + quest drops.
  { resource: 'chocolate', where: 'engine/content/squirrel riddle rewards (chocolateReward on each solve)' },
  // lollipops: dropped by the gummy-worm cellar quest (onWinDrops) + the Act-0 thrown-candy field economy.
  { resource: 'lollipops', where: 'content/quests/gummyWormCellar onWinDrops + the thrown-candy field economy' },
]

/** Every resource with an active (manual/drop) faucet. */
export function activelySourcedResources(): ReadonlySet<ResourceKey> {
  return new Set(ACTIVE_FAUCETS.map((f) => f.resource))
}

/** A resource is obtainable if it has a passive producer OR an active faucet. Pure. */
export function isResourceObtainable(resource: ResourceKey): boolean {
  return passivelySourcedResources().has(resource) || activelySourcedResources().has(resource)
}

// --- the gate chain -------------------------------------------------------------------------------------
// The spine's costs, gathered as ordered "gates". Each gate belongs to an act (0..3) and lists every cost
// line that must be paid to clear it. The audit asserts: (a) every cost line's resource is obtainable, and
// (b) each gate's resources were already obtainable at the point the gate is reached (the caramel-soft-lock
// class — no gate priced in a resource whose faucet only opens LATER in the same or a later act).
//
// "Act reached" is encoded by `act`: a gate in act N may only draw resources whose first faucet exists by
// act N. The faucet-availability act ledger (FAUCET_ACT below) makes that check objective.

export interface Gate {
  readonly id: string
  /** The act this gate belongs to (0 = the garden, 1 = the sky/moon, 2 = the voyage/planets, 3 = the sun). */
  readonly act: number
  readonly cost: readonly PriceLine[]
}

/**
 * The act by which each resource first has ANY live faucet (passive or active). Hand-authored from the
 * content graph and asserted below to be self-consistent with the registries. Used to prove no gate is
 * priced in a resource that only becomes obtainable later (the caramel-soft-lock class).
 *   act 0: candies (field), caramel (village cauldron boil).
 *   act 1: rock candy (moon strata), cotton candy (cloud sheep), licorice (thickened beanstalk).
 *   act 2: pop rocks + stardust (the comet), sour (sour planet), peppermint + mint (mint planet).
 *   act 3: (no NEW resource — the sun arc scales existing ones via the collectors/trawlers).
 */
export const FAUCET_ACT: Readonly<Record<ResourceKey, number>> = {
  candies: 0,
  caramel: 0,
  chocolate: 1, // won from the squirrel's riddles / quest rewards (Act 1-2); not gate-critical
  lollipops: 0, // Act 0 field-expansion currency (thrown-candy economy)
  rockCandy: 1,
  cottonCandy: 1,
  licorice: 1,
  popRocks: 2,
  stardust: 2,
  sour: 2,
  peppermint: 2,
  mint: 2,
}

/** The ordered spine gates, gathered from the real cost constants (the audit walks these). */
export const SPINE_GATES: readonly Gate[] = [
  // Act 1 — the galleon hull to tier 2 (ironbark), fitted on Act-1 income before the reef. Rock candy + candies.
  // The Act-1 representative candy gate (~3e5): earned from the sky/moon economy, below the Act-2 sinks.
  {
    id: 'galleonHullT2',
    act: 1,
    cost: galleonTierCost('galleonHull', 2),
  },
  // Act 2 — the shipwright's commission that opens the voyage (the §177 fee + materials). Candies + rock
  // candy + licorice + cotton candy, all Act-1 resources spent at the Act-1 -> Act-2 boundary.
  {
    id: 'galleonCommission',
    act: 2,
    cost: GALLEON_COMMISSION.map((c) => ({ resource: c.resource, amount: c.amount })),
  },
  // Act 2 — the galleon hull to tier 3 (jawbreaker-plated): the §184 Act-2 gate half (engine/content/actGate
  // .act2GateCleared reads exactly this hull tier). Rock candy (moon) + candies (~1.5e6, the Act-2 candy peak).
  {
    id: 'galleonHullT3',
    act: 2,
    cost: galleonTierCost('galleonHull', 3),
  },
  // Act 2 — the §184 gate: 10,000 peppermint banked (mint planet) alongside the tier-3 hull.
  {
    id: 'act2PeppermintBank',
    act: 2,
    cost: [{ resource: 'peppermint', amount: PEPPERMINT_GATE_AMOUNT }],
  },
  // Act 2 — a peppermint condenser (the faucet that fills the §184 bank). Rock candy + candies.
  {
    id: 'peppermintCondenser',
    act: 2,
    cost: [
      { resource: 'rockCandy', amount: CONDENSER_ROCK_CANDY_COST },
      { resource: 'candies', amount: CONDENSER_CANDY_COST },
    ],
  },
  // Act 3 — the five dyson stages (candies + rock candy, folding caramel in from stage 2).
  ...DYSON_STAGES.map((s) => ({ id: `dyson${s.stage}`, act: 3, cost: s.price })),
  // Act 3 — a solar candy collector (the ~x100 income jump). Candies + rock candy.
  {
    id: 'solarCollector',
    act: 3,
    cost: [
      { resource: 'candies', amount: SOLAR_COLLECTOR_CANDY_COST },
      { resource: 'rockCandy', amount: SOLAR_COLLECTOR_ROCK_CANDY_COST },
    ],
  },
  // Act 3 — a solar caramel collector (scales caramel for the struts). Candies.
  {
    id: 'caramelCollector',
    act: 3,
    cost: [{ resource: 'candies', amount: CARAMEL_COLLECTOR_CANDY_COST }],
  },
  // Act 3 — a star trawler (scales stardust). Candies + caramel.
  {
    id: 'starTrawler',
    act: 3,
    cost: [
      { resource: 'candies', amount: STAR_TRAWLER_CANDY_COST },
      { resource: 'caramel', amount: STAR_TRAWLER_CARAMEL_COST },
    ],
  },
  // Act 3 — the peppermint bathysphere (the Act-3 gate half). Peppermint + mint + caramel.
  {
    id: 'bathysphere',
    act: 3,
    cost: BATHYSPHERE_PRICE,
  },
]

/** The fossil-star superboss cost — the post-game epilogue (ending 4). Stardust only. */
export const FOSSIL_STAR_GATE: Gate = {
  id: 'fossilStar',
  act: 3,
  cost: [{ resource: 'stardust', amount: FOSSIL_STAR_COST }],
}

/** Pull the price of a galleon tier out of the real track config (throws if it or its price is missing). */
function galleonTierCost(trackKey: string, tier: number): readonly PriceLine[] {
  const track = GALLEON_TRACKS.find((t) => t.key === trackKey)
  const found = track?.tiers.find((t) => t.tier === tier)
  if (!found?.price) throw new Error(`no priced tier ${tier} on galleon track ${trackKey}`)
  return found.price
}

// --- purchasable shop/forge/upgrade cost lines (for the "no cost on an unobtainable resource" sweep) ----
// Every priced ShopEntry / forge entry / galleon tier / pick tier, flattened to its cost lines. The audit
// sweeps these to assert NO priced thing anywhere in the game draws a resource with no faucet at all.

/** Flatten every priced content entry to its cost lines. The gate chain above is the ordered subset the
 * reachability walk uses; this is the EXHAUSTIVE sweep for the "obtainable resource" invariant — it covers
 * EVERY registry anywhere in the game where the player pays a resource to buy/build/trade/descend: the two
 * shops (village + observatory), the hermit's belly-shop, the forge, the balloon, the galleon commission +
 * upgrade tiers, the moon picks, the gummy vat (molds + fused molds + work-crews), the sour trade, the mint
 * harvest + condenser, the photosphere descent, the spine gates, and the fossil-star epilogue. If a future
 * edit prices a new thing in a resource with no faucet, it lands in this sweep and fails the no-orphan test. */
export function allPricedCostLines(): readonly PriceLine[] {
  const lines: PriceLine[] = []
  for (const e of SHOP_ENTRIES) lines.push(...e.price)
  for (const e of OBSERVATORY_ENTRIES) lines.push(...e.price)
  for (const e of HERMIT_SHOP) lines.push(...e.price)
  for (const e of FORGE_ENTRIES) lines.push(...e.price)
  lines.push(...BALLOON_ENTRY.price)
  // the galleon commission is CommissionLine[] (resource + amount + part); take only the price shape.
  for (const c of GALLEON_COMMISSION) lines.push({ resource: c.resource, amount: c.amount })
  for (const track of GALLEON_TRACKS) for (const t of track.tiers) if (t.price) lines.push(...t.price)
  for (const t of MOON_PICKS) lines.push(...t.price)
  // the gummy vat — growing a burrower (worm, sour-fused, mint-fused) + hiring a work-crew.
  lines.push({ resource: 'candies', amount: GUMMY_CANDY_COST })
  lines.push({ resource: 'licorice', amount: GUMMY_LICORICE_COST })
  lines.push({ resource: 'candies', amount: GUMMY_FUSED_CANDY_COST })
  lines.push({ resource: 'licorice', amount: GUMMY_FUSED_LICORICE_COST })
  lines.push({ resource: 'sour', amount: GUMMY_FUSED_SOUR_COST })
  lines.push({ resource: 'candies', amount: GUMMY_MINT_FUSED_CANDY_COST })
  lines.push({ resource: 'licorice', amount: GUMMY_MINT_FUSED_LICORICE_COST })
  lines.push({ resource: 'mint', amount: GUMMY_MINT_FUSED_MINT_COST })
  lines.push({ resource: 'candies', amount: WORK_CREW_CANDY_COST })
  lines.push({ resource: 'licorice', amount: WORK_CREW_LICORICE_COST })
  // the planet trades — sour essence (sour planet) + mint essence (mint planet), both candy-fed.
  lines.push({ resource: 'candies', amount: SOUR_TRADE_CANDY_COST })
  lines.push({ resource: 'candies', amount: MINT_HARVEST_CANDY_COST })
  // the peppermint condenser (rock candy + candies) — the module constants directly, not only via SPINE_GATES.
  lines.push({ resource: 'rockCandy', amount: CONDENSER_ROCK_CANDY_COST })
  lines.push({ resource: 'candies', amount: CONDENSER_CANDY_COST })
  // the Act-4 photosphere descent (mint coolant + peppermint plating), spent in full on descent start.
  lines.push(...DESCENT_COST)
  for (const g of SPINE_GATES) lines.push(...g.cost)
  lines.push(...FOSSIL_STAR_GATE.cost)
  return lines
}

/** Every distinct resource that ANY priced thing in the game consumes. */
export function allCostResources(): ReadonlySet<ResourceKey> {
  return new Set(allPricedCostLines().map((l) => l.resource))
}

// --- the wealth curve -----------------------------------------------------------------------------------
// DESIGN §5: the candy costs climb by orders of magnitude across the acts (Act 0 ~1e5, 1 ~1e7, 2 ~1e9, 3
// ~1e12). The audit derives the representative candy cost per act from the real gates and asserts the tiers
// hold — a regression that flattened the curve (e.g. an Act-3 gate priced like an Act-1 one) fails a test.

/** The representative (largest) candy cost line among a set of gates, or 0 if none draw candies. */
export function peakCandyCost(gates: readonly Gate[]): number {
  let peak = 0
  for (const g of gates) {
    for (const line of g.cost) {
      if (line.resource === 'candies' && line.amount > peak) peak = line.amount
    }
  }
  return peak
}

/** The order of magnitude (floor of log10) of a positive number; -Infinity for 0. */
export function orderOfMagnitude(n: number): number {
  return n > 0 ? Math.floor(Math.log10(n)) : -Infinity
}

/** The gates belonging to a given act. */
export function gatesForAct(act: number): readonly Gate[] {
  return SPINE_GATES.filter((g) => g.act === act)
}

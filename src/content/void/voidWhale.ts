import type { ShopEntry } from '@/engine/types/defs'

// The void whale (Phase 5 — hidden boss 4, DESIGN §17). The acorn of knowledge whispers a telescope
// coordinate that points at deliberately EMPTY space; plot a course out to nothing, and the nothing
// turns out to have a mouth. The whale swallows the galleon whole, and the fight — if you want one — is
// INSIDE it. But you do not have to fight. In its belly a hermit has made a small dry home of the ribs
// and the dark; he keeps the best gloves ever stitched and a book of black-licorice spells, and he would,
// on the whole, rather you took what you came for and left. The reward is the shop + the grimoire, not the
// kill. LEAVING IS ALWAYS ALLOWED — the whale is soft-lock-free by construction.
//
// Pure data the engine (engine/content/voidWhale) reads. Two shapes it consumes:
//   • the coordinate crossing (VOID_LEGS) — a SHORT plot-a-course out to empty space, mirroring the reef
//     voyage's leg/waypoint shape (engine/content/reefVoyage), so it survives reload + is behaviorally
//     testable. Gated on the acorn being owned (the squirrel's coordinate) — a curiosity, never a gate.
//   • the optional whale fight (a telegraph-and-sever bout reading your equipped hand weapon, mirroring
//     the sour kraken) — NOT required to claim the shop or the grimoire.
//
// The hermit's shop (HERMIT_SHOP) reuses the generic purchase handler (engine/shop/purchase): the gloves
// (best-in-game, the empty gloves slot at last) and the black-licorice grimoire, both bought once with
// candies. Unnamed (§22). Melancholy-calm.

// --- the coordinate crossing (plot a course to empty space) ---------------------------------------------

/** numbers-namespace keys for the void crossing's plotting progress (mirrors the reef voyage's keys). */
export const VOID_LEG_KEY = 'voidVoyageLeg' // legs plotted clean (0..VOID_LEGS.length)
export const VOID_WAYPOINT_KEY = 'voidVoyageWaypoint' // waypoints of the current leg plotted so far

/** A bearing on the crossing out to nowhere — an id the legs reference + a pure-ASCII display name. */
export interface VoidBearing {
  readonly id: string
  readonly name: string
}

/**
 * The bearings you choose from when plotting the course to the empty coordinate. Deliberately blank
 * places (the squirrel's acorn reads them off a map of nothing): a dark line, a cold bearing, the gap
 * between two stars. Decoys among them, like the reef's waypoints.
 */
export const VOID_BEARINGS: readonly VoidBearing[] = [
  { id: 'darkLine', name: 'the dark line' },
  { id: 'coldBearing', name: 'the cold bearing' },
  { id: 'starGap', name: 'the gap between two stars' },
  { id: 'noStar', name: 'where no star is' },
  { id: 'emptyMark', name: 'the empty mark' },
]

/**
 * The legs you plot to reach the empty coordinate, each longer than the last. A SHORT crossing (lengths
 * 2,3) — the acorn did the hard part; this is only steering. Each is an ordered list of VOID_BEARINGS ids.
 * §22-open tuning.
 */
export const VOID_LEGS: readonly (readonly string[])[] = [
  ['darkLine', 'coldBearing'],
  ['starGap', 'noStar', 'emptyMark'],
]

// --- the optional whale fight (telegraph-and-sever, reads the equipped hand weapon) ---------------------

/** Your HP for the whale fight — a flat pool (this fight reads no hull/armour, just the hand weapon). Tuned
 * (see the grid-search in the engine test) so bare hands lose, the mace's naive all-strike loses, and the
 * bow safe-wins by interception on a tight clock — the sour-kraken shape, re-flavored for the whale's teeth. */
export const WHALE_PLAYER_HP = 18

/** How many teeth close on you at once. Shatter them all and the whale gapes and lets you go. */
export const TOOTH_COUNT = 5

/** Each tooth's hit points. Tuned so the mace one-shots a tooth, the whip's double-strike does too, the bow
 * needs three plinks, and bare hands cannot clear five in time — the kraken's arm HP, held. */
export const TOOTH_HP = 5

/** The teeth's opening range bands (1 = at your face .. 5 = far back in the throat). Spread so reach matters
 * from the first turn: a short weapon can only reach the near teeth while the far ones grind forward. */
export const TOOTH_START_DIST: readonly number[] = [2, 3, 3, 4, 5]

/** The closest / farthest range bands. Teeth advance one band a turn and never pass your face (MIN). */
export const MIN_DIST = 1
export const MAX_DIST = 5

/** A tooth's crush by the band it strikes from (index by dist 1..5; index 0 unused). Closer crushes harder,
 * but even a far tooth bites hard enough that a short-reach weapon (which cannot intercept it) MUST brace
 * rather than eat it — the near-flat curve that gives the mace its naive-loses, brace-required shape. */
export const CRUSH_DMG_BY_DIST: readonly number[] = [0, 7, 6, 5, 4, 4]

/** Bracing halves the telegraphed tooth's crush (you set your feet against the gum instead of swinging). */
export const BRACE_MULT = 0.5

/** A weapon whose cooldown is under this (ms) strikes TWICE a turn — the licorice whip's niche (§4: fast). */
export const FAST_COOLDOWN_MS = 400

/** The throat starts to close for good at this turn — shatter every tooth before it, or you are swallowed
 * deeper (a loss). Tuned so the bow's slow chip is *just* fast enough with clean play. */
export const MAX_TURNS = 15

/** The whale's belly-hoard, freed once when it gapes and lets you go (granted by the screen on the FIRST
 * defeat only — farm-proof via the cleared flag, like the kraken's crown). The optional fight is a bonus;
 * the shop + the grimoire are the real reward, claimable without it. */
export const WHALE_CANDY = 3_000_000
export const WHALE_CHOCOLATE = 300

// --- the hermit's shop (the gloves + the grimoire) ------------------------------------------------------

/**
 * The hermit's shop, consumed by the generic purchase handler (engine/shop/purchase). Both are bought once
 * with candies (the hermit has no use for them; he trades to be polite). The gloves fill the empty gloves
 * slot at last; the grimoire's owned flag unlocks its spells (incl. eclipse). Priced modestly — the whale is
 * a curiosity, not a resource sink; the value is the gear + the grimoire, not the cost. Each entry hides once
 * bought (its owned flag), so the hermit stops offering what you already have.
 */
export const HERMIT_SHOP: readonly ShopEntry[] = [
  {
    itemId: 'hermitGloves',
    price: [{ resource: 'candies', amount: 200_000 }],
    unlock: (s) => s.ownedItems['hermitGloves'] !== true,
    speechKey: 'void.hermitGloves.thanks',
  },
  {
    itemId: 'blackLicoriceGrimoire',
    price: [{ resource: 'candies', amount: 500_000 }],
    unlock: (s) => s.ownedItems['blackLicoriceGrimoire'] !== true,
    speechKey: 'void.grimoire.thanks',
  },
]

/** How long a single eclipse holds the sky still, in accumulated game-time ms (the black grimoire's
 * 'eclipse' spell). ~30 minutes of game time — one full star's worth at the base rate — bought back from
 * the descent. §22-open tuning. */
export const ECLIPSE_DURATION_MS = 30 * 60 * 1000

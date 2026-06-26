// The sour kraken (Act 2 — an optional tail, DESIGN §10/§181). Pure config the kraken sim
// (engine/content/krakenFight) reads. Deep in the sour planet's corrosive gas turns the kraken — the
// octopus-king's homage (CB2 §10). This is the first Act-2 fight fought ON FOOT, on a drifting shell
// platform, so it reads your EQUIPPED HAND WEAPON (the forge ladder, §4): a weapon's REACH decides which
// tentacles you can sever, its DAMAGE how hard, and a fast weapon strikes TWICE a turn. Three real
// archetypes pay off differently — the mace one-shots but only what's close, the bow chips anything, the
// whip is the quick mid-reach middle. Bare-handed you cannot win; come armed.
//
// DELIBERATE MODEL CHOICE: a DISCRETE, deterministic, turn-based "telegraph-and-sever" sim (no RNG, no
// rAF) — the same family as the reef drift / comet chase / Sourbeard duel. Each turn the kraken telegraphs
// its next striking arm (its longest, winding up); you STRIKE the arm you can reach or BRACE. REACH is the
// defensive axis: swinging AT the telegraphed arm INTERCEPTS its blow (whether or not the blow kills it),
// so a long bow parries every arm and takes ~no damage but grinds slowly against the clock, while a short
// mace can only intercept what's at the rail — it must BRACE the far blows it cannot reach, or eat them.
// Every arm then advances one band closer. Win by severing every arm before the gas etches through you
// (MAX_TURNS) or an arm drags you under (HP 0). Grid-searched (see the engine test) so bare hands LOSE, the
// mace's naive all-strike LOSES (bracing is required), and the bow safe-wins on a tight clock.
//
// Deferred + signposted (not stubbed): the kraken CROWN's two enchantments (§235 — no enchant system
// exists yet; held as a trophy hat like the acorn/sextant keepsakes), and the deeper §10 gas zone. §22-open.

/** Your HP for the fight — a flat pool (this fight reads no hull/armour, just the hand weapon). Tuned so
 * the mace must brace and the bow's slow grind is survivable. */
export const KRAKEN_PLAYER_HP = 18

/** How many arms the kraken fights with. Sever them all and it withdraws into the deep. */
export const TENTACLE_COUNT = 5

/** Each arm's hit points. Tuned (see the grid-search in the engine test) so the mace one-shots an arm, the
 * whip's double-strike does too, the bow needs three plinks, and bare hands cannot clear five in time. */
export const TENTACLE_HP = 5

/** The arms' opening range bands (1 = at the rail .. 5 = far out in the gas). Spread so reach matters from
 * the first turn: a short weapon can only touch the near arms while the far ones wind up. */
export const TENTACLE_START_DIST: readonly number[] = [2, 3, 3, 4, 5]

/** The closest / farthest range bands. Arms advance one band a turn and never pass the rail (MIN). */
export const MIN_DIST = 1
export const MAX_DIST = 5

/** An arm's blow by the band it strikes from (index by dist 1..5; index 0 unused). Closer hits harder, but
 * even a far arm bites hard enough that a short-reach weapon (which cannot intercept it) MUST brace rather
 * than eat it. This near-flat curve is what gives the mace its naive-loses, brace-required shape. */
export const STRIKE_DMG_BY_DIST: readonly number[] = [0, 7, 6, 5, 4, 4]

/** Bracing halves the telegraphed arm's blow (you set your feet instead of swinging). */
export const BRACE_MULT = 0.5

/** A weapon whose cooldown is under this (ms) strikes TWICE a turn — the licorice whip's niche (§4: fast).
 * The forge's other weapons swing once; bare hands once. */
export const FAST_COOLDOWN_MS = 400

/** The gas etches through your gear at this turn — sever every arm before it, or you are forced off the
 * platform (a loss). Tuned so the bow's slow chip is *just* fast enough with clean play. */
export const MAX_TURNS = 15

/** The kraken's hoard, freed once when it withdraws (granted by the screen on the FIRST defeat only —
 * farm-proof via the cleared flag, like the squirrel's acorn). */
export const KRAKEN_CANDY = 2_000_000
export const KRAKEN_CHOCOLATE = 250

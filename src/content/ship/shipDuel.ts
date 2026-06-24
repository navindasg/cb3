// Captain Sourbeard & the Black Lollipop (Act 2 — quest 8, ship combat, DESIGN §127/§179). Pure config
// the duel sim (engine/content/shipDuel) reads. The candied galleon's first real fight, and the beat
// that finally READS the shipwright's-yard tiers (hull/sails/cannons, §13/§269 — built "inert until ship
// combat"): hull -> your HP, cannons -> your broadside damage, sails -> evasion + the veer-slip.
//
// DELIBERATE MODEL CHOICE: §127's "timing-based broadside exchanges" become a DISCRETE, deterministic,
// turn-based range duel (no RNG, no rAF) — the same family as the reef drift / comet sims. Each round you
// pick a maneuver; EVERY maneuver fires a broadside (no wasted turns), and the choice is purely the
// range-and-trade: press to close (more damage both ways), hold, or veer off (less damage, and your sails
// slip the foe's shot). A boarding TIMER (the Black Lollipop's crew swings across if you dither) makes
// committing to the exchange the win and running away a loss. Sourbeard is a RECURRING rival — beating
// him escalates the next encounter (§179: three times across the act, with a §17 consequence — deferred).
//
// Deferred + signposted (not stubbed): the boarding melee (drops to on-foot combat), the parrot pickpocket
// (gummy parrot, +crew morale), Sourbeard's tricorn hat (+crew morale — needs the crew system), and the
// three-defeats §17 consequence. All §22-open tuning.

/** numbers-namespace key: how many times Sourbeard has been beaten (0..MAX_DEFEATS). Drives the loot
 * gate (one grant per NEW defeat — farm-proof) and the foe's escalation. Rides the numbers passthrough. */
export const SOURBEARD_DEFEATS_KEY = 'sourbeardDefeats'

/** The recurring arc length (§179). After this many defeats the rival is retired for the slice (the §17
 * consequence is a later beat). */
export const MAX_DEFEATS = 3

/** Range bands the duel moves through: 0 = long, 1 = mid, 2 = point-blank. A broadside hits harder the
 * closer you are — for BOTH ships. */
export const RANGE_LONG = 0
export const RANGE_CLOSE = 2
export const RANGE_NAMES: readonly string[] = ['long', 'mid', 'point-blank']

/** Damage multiplier by range band. DELIBERATE asymmetry: point-blank is DANGEROUS — the foe's broadside
 * ramps harder up close (1.7x) than your own gain does (1.4x), so charging in is NOT free. The sweet spot
 * is mid range; you close only for a finishing shot (the killing blow draws no reply) or when your hull can
 * eat it. This is what makes the maneuver choice tactical rather than "always press" (§22-open tuning). */
export const YOUR_RANGE_MULT: readonly number[] = [0.8, 1.2, 1.4]
export const FOE_RANGE_MULT: readonly number[] = [0.5, 1.0, 1.7]

/** Your hull HP by hull tier (1..3): hardtack / ironbark / jawbreaker-plated. Index 0 is unused. */
export const HULL_HP: readonly number[] = [0, 52, 82, 112]
/** Your broadside base damage by cannon tier (1..3): gumball / pop rock guns / nougat bombard. The jump to
 * tier 2 (the comet's pop rock guns) is what lets you out-gun the Black Lollipop's escalated rematches. */
export const CANNON_DAMAGE: readonly number[] = [0, 10, 17, 24]
/** Incoming-damage multiplier by sail tier (1..3): cotton-candy / storm-silk / solar — lower is better. */
export const SAIL_EVASION: readonly number[] = [0, 1.0, 0.82, 0.64]
/** Sails at this tier or better fully SLIP the foe's shot when you veer off (else a veer halves it). */
export const SAIL_FULL_SLIP_TIER = 2

/** The Black Lollipop, escalating per prior defeat (a tougher ship each rematch — pushes you to the yard).
 * Encounter N (defeats = N-1): HP = base + N-1 growth, shot = base + N-1 growth. */
export const FOE_BASE_HP = 58
export const FOE_HP_PER_DEFEAT = 28
export const FOE_BASE_SHOT = 10
export const FOE_SHOT_PER_DEFEAT = 2

/** The duel opens at long range; the foe drifts one band closer every few rounds (you cannot kite for
 * ever); the crew boards you (a loss) if the Black Lollipop is not sunk within MAX_ROUNDS. */
export const START_RANGE = RANGE_LONG
export const FOE_CLOSE_EVERY = 3
export const MAX_ROUNDS = 7

/** Loot for a NEW defeat (granted once per defeat number — never re-farmed). Index by the defeat number
 * 1..MAX_DEFEATS; index 0 unused. Escalates with the harder rematches. */
export const DEFEAT_CANDY: readonly number[] = [0, 250_000, 600_000, 1_200_000]
export const DEFEAT_CHOCOLATE: readonly number[] = [0, 40, 90, 180]

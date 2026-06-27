import type { ResourceKey } from '@/engine/types/GameState'

// The photosphere descent sim's config (Act 4 — quest 11, DESIGN §5/§194/§196). Pure flavor + tuning the
// descent sim (engine/content/photosphere) reads. The bathysphere is lowered rung by rung into a floor of
// slow white fire; there is no enemy, only the star itself. Each rung the heat telegraphs as one of two
// hazards — a caramel FLARE (a sudden up-welling you must vent coolant to bleed) or a sugar-glass STORM (a
// scouring blast the plating can brace) — and you choose to VENT coolant or BRACE the plating against it.
// Vent the wrong hazard and you waste coolant you will need lower down; brace a flare and it cooks the hull.
//
// DELIBERATE MODEL CHOICE: a DISCRETE, deterministic, telegraphed hazard sim (no RNG, no rAF) — the same
// family as the kraken's telegraph-and-brace, the reef drift, the comet chase. The §194 gauntlet wants a
// READABLE march of dread (the glow ramping as you fall), not a coin-flip, so the hazard at each rung is
// fixed and shown a rung ahead. It is survivable IFF you enter with enough plating + coolant and read each
// telegraph correctly — grid-searched in the engine test (a fat entry survives with clean play; a thin one
// cannot, and naive all-brace/all-vent both run out). The resources it consumes are the ones Act 2/3 ground
// out: mint coolant + peppermint plating (never an unobtainable resource — the soft-lock-free rule).
//
// This slice stands up the descent SIM + the resource gate; the caramel-core reveal at the bottom is the
// next slice (reaching the core sets photosphereCleared, the clean hook). §22-open. Pure ASCII, no glyphs.

/** A descent hazard, telegraphed one rung ahead. A FLARE wants a coolant VENT; a STORM wants a plating BRACE. */
export type DescentHazard = 'flare' | 'storm'

/** One cost line of the descent batch (an existing resource key + the amount spent to seal the vessel). */
export interface DescentCostLine {
  readonly resource: ResourceKey
  readonly amount: number
}

/**
 * The coolant batch packed into the vessel before it will hold against a star — mint (the frost wyrm's cold
 * essence, harvested across Act 2). Spent in full on descent start; it becomes the sim's coolant pool, bled
 * a little every rung and a lot on a vented flare. Tuned (see the engine grid-search) so a clean read just
 * survives the rung count and a wasteful line runs dry before the core.
 */
export const MIN_COOLANT = 600

/**
 * The plating batch — peppermint (mined on the mint planet, the §184 resource). Spent in full on descent
 * start; it becomes the hull's heat tolerance (its "hp"). A braced storm passes cheaply; a braced flare (the
 * wrong read) cooks a chunk of plating. Tuned so the hull just survives a clean descent and a thin entry
 * cannot take the flares.
 */
export const MIN_PLATING = 400

/** The descent batch as cost lines (both existing resource keys — never an unobtainable resource). */
export const DESCENT_COST: readonly DescentCostLine[] = [
  { resource: 'mint', amount: MIN_COOLANT },
  { resource: 'peppermint', amount: MIN_PLATING },
]

/**
 * How many rungs the bathysphere is lowered before it reaches the core. Reach the last rung and you are at
 * the caramel core (the next slice's reveal). Tuned with the coolant/heat numbers so the gauntlet is a real
 * descent, not a formality.
 */
export const RUNG_COUNT = 12

/**
 * The fixed hazard at each rung (index 0 = the first rung down .. RUNG_COUNT-1 = the last before the core).
 * DETERMINISTIC and telegraphed a rung ahead — the player reads the next one and chooses vent/brace. The
 * mix forces both responses: a run of flares drains coolant, a run of storms wears plating, and the order
 * means you cannot pick one response for the whole descent (grid-searched: all-vent and all-brace both lose).
 */
export const RUNG_HAZARDS: readonly DescentHazard[] = [
  'storm',
  'flare',
  'storm',
  'flare',
  'flare',
  'storm',
  'flare',
  'storm',
  'flare',
  'flare',
  'storm',
  'flare',
]

// The hazard tuning below is GRID-SEARCHED (see the engine test's balance contract): at the full batch
// (MIN_COOLANT coolant + MIN_PLATING plating) a clean read just survives both gauges; naive all-vent and
// all-brace both run a gauge dry before the core; and a meaningfully thin entry (about half of either batch)
// is unsolvable even with perfect play — so BOTH resources you ground out are a binding constraint. The
// clean line ends near-flat on coolant and scorched on plating: the dread the screen narrates is real.

/** The baseline coolant the vessel bleeds every rung just holding against the ambient heat (the floor drain). */
export const RUNG_COOLANT_DRAIN = 14

/** The extra coolant a VENT costs (bleeding the hull to bite a flare). Venting a rung = drain + this. */
export const VENT_COOLANT_COST = 48

/** A FLARE's heat if you do NOT vent it (you braced instead): it cooks this much plating. The wrong read. */
export const FLARE_PLATING_DAMAGE = 130

/** A FLARE's heat if you DO vent it: mostly bled away, but a little still reaches the hull (a clean read). */
export const FLARE_VENTED_DAMAGE = 18

/** A STORM's heat if you BRACE it (the right read): the plating scatters most of it for a small bite. */
export const STORM_BRACED_DAMAGE = 30

/** A STORM's heat if you VENT instead (the wrong read): venting does nothing for a scouring blast — full bite. */
export const STORM_UNBRACED_DAMAGE = 95

/** The descent-port / sim backdrop — the photosphere as a floor of slow white fire, pure ASCII. */
export const PHOTOSPHERE_BACKDROP = [
  '                .  *   .      .   *',
  '          *   ~~~~~~~~~~~~~~~~~~~~~~~~   .',
  '        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '      ~~~~~~~~~~~~~~~  the photosphere  ~~~~~~~',
  '     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '         ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
].join('\n')

/** The descent blurb — the vessel lowered, the heat telegraphing a rung ahead, no bottom in sight. */
export const DESCENT_SIM_BLURB =
  'The bathysphere drops into the light a rung at a time. There is no dark down here and no floor you can see — only the star, telegraphing what it will do to you next. When the haze ahead curdles amber a caramel FLARE is coming: bleed coolant and VENT it, or it cooks the hull. When it whitens to grit a sugar-glass STORM is coming: BRACE the plating and it scatters. Vent a storm or brace a flare and you waste what you needed lower down.'

/** Shown on the rung the descent reaches the core — the clean hook into the caramel-core reveal (next slice). */
export const DESCENT_CORE_REACHED_BLURB =
  'The last rung pays out and the bathysphere stops, swaying, against something that is not light. The coolant gauge is nearly flat and the plating ticks as it cools, but you are down. Below the photosphere the white thins, and there is a shape in it — held, and very old, and not burning. You have reached the core.'

/** Shown when the coolant runs dry mid-descent — a forfeit, climb back and refit (more mint). */
export const DESCENT_COOLANT_OUT_BLURB =
  'The coolant gauge bottoms out with rungs still to go. The hull starts to sing the way metal sings just before it gives, and you haul the vessel back up into the cage on the last of the line. Pack more cold into it — more coolant — and come down again.'

/** Shown when the plating burns through mid-descent — a forfeit, climb back and refit (more peppermint). */
export const DESCENT_PLATING_OUT_BLURB =
  'A flare you braced instead of vented finds a seam, and the plating lets go in a sheet of white. You blow the descent and ride the vessel back up trailing smoke, alive and badly cooked. Lash more plating over the seams — more peppermint — before you try the star again.'

/** The retry note after a forfeit — the dread without a dead button. */
export const DESCENT_RETRY_LABEL = 'haul the vessel back up and refit'

/** The vent action label — bleed coolant to kill the telegraphed flare. */
export const VENT_LABEL = 'vent coolant (bleed the flare)'

/** The brace action label — set the plating against the telegraphed storm. */
export const BRACE_LABEL = 'brace the plating (scatter the storm)'

// The solar works on the dyson scaffold (Act 3 — Increment 2, the stage-1 reward, DESIGN §5/§111/§188).
// Pure config the solar-works engine (engine/content/solarWorks) reads. Once the first strut is raised
// (dysonStage1Done), the scaffold lets you hang two kinds of count-scaled COLLECTORS on the sun:
//
//   - SOLAR CANDY COLLECTORS — the biggest passive candy jump in the game. Each one drinks a sliver of
//     the star and pours out candy; a fleet takes you from Act 2's ~10k/s to ~1M+/s (§5 ~x100 income
//     jump, the engine that funds stages 2-5). Built with candies + a rock-candy strut (the Act-1 mining
//     economy tied into the cage).
//
//   - the SOLAR-CARAMEL COLLECTOR — a steadier, slower faucet of CARAMEL, complementing Increment 0's
//     manual cauldron boil (the never-soft-locking floor). Caramel feeds the escalating struts + the
//     bathysphere hull-seal + Act 4; this faucet keeps it ahead of the ~x10/stage costs without the
//     player babysitting the cauldron. Built with candies only (caramel itself stays a sink elsewhere).
//
// Both are gated 0 until dysonStage1Done (the engine predicate / the producers' getRate). All §22-open
// tuning. The crucible flavor (§111/§4): "A crucible the size of a county. It boils." The collectors hum;
// the counter keeps falling. You are harvesting a dying star to build the thing that will cage it.

// --- the numbers-namespace keys (the buildable counts) ------------------------------------------------

/** numbers key holding how many solar candy collectors you have built (default 0). */
export const SOLAR_COLLECTOR_KEY = 'solarCollectorCount'

/** numbers key holding how many solar-caramel collectors you have built (default 0). */
export const CARAMEL_COLLECTOR_KEY = 'caramelCollectorCount'

// --- solar candy collectors (the ~x100 candy jump) ----------------------------------------------------

/** Cost to hang one solar candy collector on the scaffold: candies + a rock-candy strut. Affordable from
 * Act-2 income (the point is the income jump that follows, not the wall). §22-open. */
export const SOLAR_COLLECTOR_CANDY_COST = 1_000_000
export const SOLAR_COLLECTOR_ROCK_CANDY_COST = 2_000

/** Candy each collector pours per second from the star. Tuned big: a small fleet (~100) clears ~1M/s, a
 * fair fleet pushes well past it — the §5 ~x100 jump from Act-2's ~10k/s that funds stages 2-5. §22-open. */
export const SOLAR_CANDY_PER_COLLECTOR_PER_SEC = 10_000

// --- the solar-caramel collector (the scaling caramel faucet) -----------------------------------------

/** Cost to hang one solar-caramel collector: candies only (caramel is a sink elsewhere — never gate its
 * own faucet on it). Pricier than a candy collector so caramel stays a deliberate, smaller stream. §22-open. */
export const CARAMEL_COLLECTOR_CANDY_COST = 5_000_000

/** Caramel each caramel-collector renders per second. A steady trickle sized to caramel's small sinks (the
 * struts' hull-seals, the bathysphere) — fast enough to outrun the ~x10/stage costs, slow enough that it
 * never floods. Complements Increment 0's manual boil floor (100 candies -> 1 caramel). §22-open. */
export const CARAMEL_PER_COLLECTOR_PER_SEC = 0.5

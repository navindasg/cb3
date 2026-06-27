// The star sea on the dyson scaffold (Act 3 — Increment 4, the stage-3 reward, DESIGN §3/§188). Pure config
// the star-sea engine (engine/content/starSea) reads. Once the outer bracing is raised (dysonStage3Done), the
// scaffold lets you launch STAR-TRAWLERS that sweep the vast shimmering field of star-stuff for STARDUST.
//
// Stardust has existed since Act 2 (schema v8 — harvested with pop rocks when you caught the comet) but had
// NO passive source: every grain came from a single transient comet catch. The star sea is its first FAUCET.
// Each trawler you launch drifts the comet's wake and brings back stardust on a steady trickle, exactly like
// the solar collectors drink the star or the condensers sublimate peppermint — a count-scaled passive
// producer. The stardust it lands funds the late dyson stages, the solar sails (the long-deferred galleon
// tier), and the peppermint bathysphere of the Act-3 gate.
//
// Built with candies + a caramel ballast (caramel has live faucets by now — Inc-0 boil floor + Inc-2 solar-
// caramel collector — so this never soft-locks). The trawler count lives in the numbers key `starTrawlerCount`
// (default 0). The producer (content/producers/stardust) reads stardustRate over the same count. All §22-open
// tuning. The voice is the bleakest-act's prettiest screen: a quiet, vast, mournful harvest of something dead.

// --- the numbers-namespace key (the buildable count) --------------------------------------------------

/** numbers key holding how many star-trawlers you have launched into the star sea (default 0). */
export const STAR_TRAWLER_KEY = 'starTrawlerCount'

// --- star-trawlers (the first passive stardust faucet) ------------------------------------------------

/** Cost to launch one star-trawler into the sea: candies + a caramel ballast. Caramel has live faucets by
 * Act 3 (the cauldron boil + the solar-caramel collector), so this never soft-locks. Priced as a real but
 * modest commitment — the sea is wide, and each sweep is its own small expedition. §22-open. */
export const STAR_TRAWLER_CANDY_COST = 50_000_000
export const STAR_TRAWLER_CARAMEL_COST = 100

/** Stardust each trawler sweeps from the sea per second. A slow, steady trickle — stardust is rare, a
 * gleaning of the dead, not a flood; sized so a fair fleet plates the bathysphere + funds the late stages
 * without ever pouring. Still far slower than the candy collectors, by design — this is the gleaning, not
 * the harvest. §22-open. */
export const STARDUST_PER_TRAWLER_PER_SEC = 0.25

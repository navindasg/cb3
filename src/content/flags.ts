// Content-owned save-flag string constants. Save flags name CONTENT state (zones unlocked,
// quests completed), so the flag *strings* are content, not engine, values. Content modules
// import these instead of reaching into engine runtime (ADR §3 layering: content imports only
// TYPES from engine, never engine values). The engine readers that consult these flags compare
// against the SAME string literal — kept in lock-step here as the single source of truth.

/** Set on beanstalk-climb victory; enables the elevator fast-travel forever after. */
export const BEANSTALK_ELEVATOR_FLAG = 'beanstalkElevator'

/** Set on forest victory; reveals the village on the overworld (its region's revealFlag). */
export const FOREST_CLEARED_FLAG = 'forestCleared'

/** Set when you first enter the village; reveals the sugar mines + the mountain on the overworld. */
export const VILLAGE_REACHED_FLAG = 'villageReached'

/** Set when the mine-gate sentinel is defeated; opens the sugar-mines descent proper. */
export const MINE_GATE_CLEARED_FLAG = 'mineGateCleared'

/** Set on sugar-mines victory; the mountain climb's win sets `mountainClimbed` to reveal the observatory. */
export const MOUNTAIN_CLIMBED_FLAG = 'mountainClimbed'

/**
 * Set when you first reach the cumulus commons (Act 1, via the beanstalk elevator). Reveals the
 * cotton-candy readout in the status bar — the new sky resource only surfaces once it's relevant.
 */
export const CLOUD_COMMONS_REACHED_FLAG = 'cloudCommonsReached'

/** Set when the toll giant is paid; opens the bridge upward and reveals the storm front. */
export const TOLL_GIANT_PAID_FLAG = 'tollGiantPaid'

/** Set when a fizzy lifting soda is brewed (the cauldron). The capability that survives the storm
 * front's updrafts — its quest is gated on this (DESIGN §11: "fizzy lifting soda — float"). */
export const FIZZY_LIFTING_SODA_FLAG = 'fizzyLiftingSodaKnown'

/** Set on storm-front victory (the thunderhead djinn falls). */
export const STORM_FRONT_CLEARED_FLAG = 'stormFrontCleared'

/** Set when the cotton-candy balloon is built (the item's saveFlag); reveals the jawbreaker moon. */
export const BALLOON_BUILT_FLAG = 'balloonBuilt'

/**
 * Set when the beanstalk thickens (fed past the thicken threshold) — engine/content/beanstalk's
 * feedBeanstalk writes the same literal in lock-step. Content owns this constant: the licorice
 * cuttings producer reads it, so the gate stays content-only (no engine-logic import — ADR §3).
 */
export const BEANSTALK_THICKENED_FLAG = 'beanstalkThickened'

/** Set on moon-worm victory (Quest 4 — the colossal gummy worm falls); the moon screen then shows
 * the tunnels as cleared and stops offering the fight. */
export const MOON_WORM_DEFEATED_FLAG = 'moonWormDefeated'

/**
 * Set when the worm mold is acquired (the item's saveFlag) — the moon-worm drop. While owned it
 * grants the strata-mining yield boost (DESIGN §12: the worm mold = burrower, mining boost).
 * engine/content/moonStrata reads the SAME literal in lock-step (the beanstalk-thickened idiom),
 * so the mining engine stays free of a content-value import (ADR §3 layering).
 */
export const WORM_MOLD_OWNED_FLAG = 'wormMoldOwned'

/**
 * Set when the hollow core's echo puzzle is solved (Quest 5 — you reach the moon's dead centre and
 * find the warm, empty chamber; lore §15.2 "something hatched and left"). engine/content/hollowCore
 * sets the SAME literal in lock-step on the solving call (the moonStrata idiom), so the puzzle's
 * "reached" state stays pure-engine and testable; the moon screen reads it to show the core forever
 * after as reached.
 */
export const HOLLOW_CORE_REACHED_FLAG = 'hollowCoreReached'

/**
 * Set when the lunar lighthouse cyclops's plot-a-course lesson is finished (DESIGN §167) — celestial
 * navigation learned, the prerequisite for the Act-2 candied galleon. engine/content/lighthouse sets
 * the SAME literal in lock-step on the learning call (the moonStrata idiom). Half of the Act-1 gate
 * (the other half is the blacksmith's fishbowl helm, §171).
 */
export const CELESTIAL_NAVIGATION_FLAG = 'celestialNavigationLearned'

/**
 * Set when the blacksmith forges the fishbowl helm (the item's saveFlag) — first vacuum gear, the
 * OTHER half of the Act-1 gate (DESIGN §171/§233). Its forge entry is gated on celestial navigation,
 * so this flag implies both halves are done. engine/content/actGate reads the SAME literal in
 * lock-step to derive act1GateCleared (the Act-2 hook). The helm's airtight protection lands in Act 2.
 */
export const FISHBOWL_HELM_FORGED_FLAG = 'fishbowlHelmForged'

/**
 * Set when the candied galleon is named + laid down at the sky port (DESIGN §13/§177) — the Act-2
 * opening commission is closed. engine/content/galleonCommission sets the SAME literal in lock-step
 * (the moonStrata idiom) when the player names a fully-funded commission; the engine never imports
 * this content value (ADR §3). Hull tiers / drift / ship combat build on this in later slices, and
 * the §18 "Candy Box" naming consequence reads the galleon name from the strings namespace.
 */
export const GALLEON_COMMISSIONED_FLAG = 'galleonCommissioned'

/**
 * Set when the candied galleon's first voyage is plotted clean and she reaches the rock candy reef
 * (DESIGN §178) — the brass sextant put to use. engine/content/reefVoyage sets the SAME literal in
 * lock-step (the moonStrata/lighthouse idiom) on the leg that completes the crossing; the engine
 * never imports this content value (ADR §3). Flips the reef screen from the crossing to the harvest.
 */
export const REEF_REACHED_FLAG = 'reefReached'

/**
 * Set when the rock candy reef's asteroid field is cleared in zero-G drift combat (DESIGN §125/§178).
 * The drift sim (engine/content/driftReef) is transient and never persists, so the reef screen sets
 * this flag when the field comes up empty; it reads it forever after to show the reef as harvested
 * (and to signpost the space squirrel's still-unreachable acorn capsule). The engine never imports
 * this content value (ADR §3) — the screen owns the persistence.
 */
export const REEF_DRIFT_CLEARED_FLAG = 'reefDriftCleared'

/**
 * Set the first time the comet is caught with the lead-the-target harpoon (Act 2 — "the comet passes",
 * DESIGN §175/§180). The comet sim (engine/content/cometChase) is transient and never persists, so the
 * comet screen sets this flag on the first catch; it grants a one-time pop-rock bonus and the lore beat
 * that a later pass could be RIDDEN (the deferred fast-travel + stardust). The recurring pop-rock faucet
 * is rate-limited by the once-per-pass cooldown (numbers.cometLastPass), not by this flag. The engine
 * never imports this content value (ADR §3) — the screen owns the persistence.
 */
export const COMET_FIRST_CAUGHT_FLAG = 'cometFirstCaught'

/**
 * Set when the gummy folk elder teaches you flavor fusion (Act 2 — the sour planet, DESIGN §181/§260).
 * First alien contact; the friendly gummy folk show you how to work two flavor essences into one gummy.
 * engine/content/sourPlanet sets the SAME literal in lock-step (the moonStrata idiom); the gummy vat
 * reads it to unlock growing two-flavor (sour-fused) burrowers. The engine never imports this content
 * value (ADR §3). The kraken, the other flavors/molds, and gummy combat/crew are later beats.
 */
export const FLAVOR_FUSION_FLAG = 'flavorFusionLearned'

/**
 * Set when you reach the heart of the ice labyrinth and free the frost wyrm (Act 2 — the mint planet,
 * quest 10, DESIGN §182/§285). The dragon that froze instead of igniting; breaking the peppermint-frost
 * from around it opens the peppermint fields. engine/content/mintPlanet sets the SAME literal in
 * lock-step (the moonStrata idiom); the planet screen reads it to flip from the labyrinth to the mining,
 * and the peppermint condenser producer keys its output to it. The engine never imports this content
 * value (ADR §3). The larval-star reveal is environmental, never stated (§285).
 */
export const FROST_WYRM_FREED_FLAG = 'frostWyrmFreed'

/**
 * Set when the sour kraken is beaten deep in the sour planet's gas (Act 2 — an optional tail, DESIGN
 * §10/§181). The telegraph-and-sever fight (engine/content/krakenFight) is TRANSIENT and never persists,
 * so the kraken screen sets this flag when the last arm is severed; it reads it forever after to grant the
 * kraken crown exactly once (farm-proof, like the squirrel's acorn) and to show the deep as calm. The
 * engine never imports this content value (ADR §3) — the screen owns the persistence. Gated behind first
 * contact (flavorFusionLearned), so you cannot stumble onto the boss before meeting the gummy folk.
 */
export const KRAKEN_DEFEATED_FLAG = 'krakenDefeated'

/**
 * Set when Captain Sourbeard is bested in the ON-FOOT boarding melee (Act 2 — quest 8's climax, DESIGN
 * §127/§179) — the third broadside no longer just sends him running; he grapples across and you fight him
 * man to man, and winning THAT retires the rival for good (the §17 three-defeats consequence). The boarding
 * sim (engine/content/boardingDuel) is TRANSIENT and never persists, so the Sourbeard screen sets this flag
 * when he goes down on deck; it reads it forever after to grant his tricorn + the gummy parrot exactly once
 * (farm-proof) and to show the Black Lollipop gone. The engine never imports this content value (ADR §3).
 * Gated behind the broadside arc (sourbeardDefeats >= 3), so the melee only opens at the third encounter.
 */
export const SOURBEARD_BOARDED_FLAG = 'sourbeardBoarded'

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

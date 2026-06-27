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

/**
 * Set the first time the sun is reached — by setting sail from the sky port or travelling up to the
 * top-of-map 'sun' overworld region (Act 3 — the dyson scaffold, DESIGN §186/§188). Reach is gated on the
 * EXISTING engine predicate act2GateCleared (hull t3 + 10k peppermint), so this flag is reveal-only: it
 * shows the 'sun' overworld region forever after, nothing more. The scaffold screen sets the SAME literal
 * in lock-step (the moonStrata idiom) on the first arrival; the engine never imports this content value
 * (ADR §3). The dyson stages themselves live in the dysonStage numbers ledger + their done-flags below.
 */
export const SUN_REACHED_FLAG = 'sunReached'

/**
 * The five dyson-scaffold stage done-flags (Act 3 — the 5-stage build machine, DESIGN §188). Each is set
 * when its stage is funded + raised at the scaffold; the next stage is gated on the previous flag (the
 * machine is strictly sequential, one-way). engine/content/dysonScaffold sets the SAME literals in
 * lock-step (the moonStrata idiom) — the engine re-declares these strings rather than importing the
 * content value (ADR §3). Each flag is also the unlock hook for that stage's reward slice (stage 1 ->
 * the solar collectors, stage 2 -> gummy work-crews, stage 3 -> the star sea, stage 4 -> the observation
 * deck, stage 5 -> the descent port / the bathysphere) and feeds the star-counter acceleration.
 */
export const DYSON_STAGE_DONE_FLAGS = [
  'dysonStage1Done',
  'dysonStage2Done',
  'dysonStage3Done',
  'dysonStage4Done',
  'dysonStage5Done',
] as const

/**
 * Set the first time the player witnesses a star go out on the observation deck (Act 3 — the stage-4
 * reward, DESIGN §15/§189). The deck opens with dysonStage4Done; the scripted first-view is gated on this
 * flag being UNSET. engine/content/observationDeck.witnessStarDie sets the SAME literal in lock-step (the
 * moonStrata idiom) in the same dispatch that removes EXACTLY one star — commit-once, farm-proof: a second
 * call returns the SAME reference and nothing is removed. The engine never imports this content value
 * (ADR §3). After it is set the deck re-renders as a static "the silhouette is closer now" scene; the
 * astronomer's grim line (the one place the game states the §15 truth) is gated on dysonStage4Done, not on
 * this — he is changed for good once the gantry is up.
 */
export const STAR_EATER_SIGHTED_FLAG = 'starEaterSighted'

/**
 * Set when the peppermint bathysphere is built at the descent port (Act 3 — the stage-5 reward, DESIGN
 * §5/§190/§196). The descent port opens with dysonStage5Done; building the bathysphere consumes peppermint
 * plating + mint coolant + a caramel hull-seal (all existing keys with live sources by now) and sets this
 * flag + the owned item, exactly once (a one-off craft — the build refuses to re-fire, SAME reference).
 * engine/content/bathysphere sets the SAME literal in lock-step (the moonStrata idiom — the engine never
 * imports this content value, ADR §3). engine/content/actGate reads it to derive act3GateCleared
 * (dysonStage5Done && this), the Act-4 descent hook; the §194 audio cue is the Act-4 payoff, not fired here.
 */
export const BATHYSPHERE_BUILT_FLAG = 'bathysphereBuilt'

/**
 * Set the instant the photosphere descent begins (Act 4 — quest 11, DESIGN §194). The descent button's
 * click handler (the user gesture) dispatches this flag in the SAME path that fires the game's ONLY
 * audio cue — so the flag stamps the moment sound first enters the game after ~18 silent hours. The
 * descent itself (the deterministic hazard sim) is wired in a later slice; this flag is the cue-fire
 * latch's "started" half. engine/content/photosphere reads the SAME literal in lock-step (the moonStrata
 * idiom — the engine never imports this content value, ADR §3).
 */
export const PHOTOSPHERE_DESCENT_STARTED_FLAG = 'photosphereDescentStarted'

/**
 * Set once the descent cue has played (Act 4 — quest 11, DESIGN §194). The fire-once latch's "played"
 * half: the pure predicate engine/content/photosphere.shouldPlayDescentCue is true ONLY while the descent
 * has started AND this flag is unset; the descent-button handler dispatches markDescentCuePlayed (which
 * sets this) in the same path it performs the sound, so the cue fires EXACTLY once and can never re-fire
 * or be farmed. engine/content/photosphere reads/sets the SAME literal in lock-step (the moonStrata idiom
 * — the engine never imports this content value, ADR §3). The SOUND lives in coverage-excluded render glue.
 */
export const DESCENT_CUE_PLAYED_FLAG = 'descentCuePlayed'

/**
 * Set once the photosphere descent reaches the caramel core (Act 4 — quest 11, DESIGN §5/§194/§196). The
 * commit-once "cleared" flag: it blocks re-descent for value (the descent sim is transient and pays no
 * resources, but the flag is the clean hook the caramel-core reveal opens on), and canDescend is false once
 * it is set. engine/content/photosphere sets the SAME literal in lock-step (the moonStrata idiom — the
 * engine never imports this content value, ADR §3). No schema bump: a flag rides the flags z.record.
 */
export const PHOTOSPHERE_CLEARED_FLAG = 'photosphereCleared'

/**
 * Set when the caramel-core reveal reaches its final stage (Act 4 — quest 12, DESIGN §15/§196/§285). The
 * §15 larval-star spine LOCKS into place here: the core is not a furnace but an EGG, and curled inside it the
 * half-hatched solar dragon keeps the light on because that is what the egg does. Set in the SAME dispatch as
 * SOLAR_DRAGON_MET_FLAG (commit-once, the witnessStarDie idiom) on the call that advances to the dragon stage.
 * engine/content/caramelCore sets the SAME literal in lock-step (the moonStrata idiom — the engine never
 * imports this content value, ADR §3). The reveal is a scene, not a gate: re-viewable, but it grants nothing
 * to farm (no resource, no loot). No schema bump: a flag rides the flags z.record.
 */
export const CARAMEL_CORE_REACHED_FLAG = 'caramelCoreReached'

/**
 * Set in the SAME dispatch as CARAMEL_CORE_REACHED_FLAG, when the reveal reaches the half-hatched solar
 * dragon (Act 4 — quest 12, DESIGN §278/§285). Implies caramelCoreReached (the two are always set together —
 * asserted in the engine test). The dragon speaks in single small words; this flag gates the "met" state the
 * screen reads to keep showing the dragon (and is the clean hook the star-eater arrival opens on).
 * engine/content/caramelCore sets the SAME literal in lock-step (the moonStrata idiom, ADR §3).
 */
export const SOLAR_DRAGON_MET_FLAG = 'solarDragonMet'

/**
 * Set when the star-eater is driven off in the three-phase finale (Act 4 — quest 13, DESIGN §198/§286). The
 * §198 climax that reuses all three fight engines: the broadside (maxed galleon tiers), the on-foot melee
 * (the equipped weapon), and the core defense (defending the egg). Each phase is TRANSIENT (an abandoned or
 * lost fight is forfeit, never persisted mid-fight — the shipDuel/boardingDuel idiom); this flag is the only
 * thing that persists, set commit-once in the SAME dispatch as the phase-3 clear (the witnessStarDie idiom —
 * a re-entry shows the aftermath / the choice, never a re-fightable loot source). engine/content/starEater
 * sets the SAME literal in lock-step (the moonStrata idiom — the engine never imports this content value,
 * ADR §3). It is the hook the choice screen (the ending, the next slice) opens on. No schema bump: a flag
 * rides the flags z.record.
 */
export const STAR_EATER_DEFEATED_FLAG = 'starEaterDefeated'

/**
 * Set the first time the eater's candy counter is surfaced — the §3/§286 reveal made EXACTLY once, at the
 * phase-2 -> phase-3 boundary of the finale ("You have 8,101 stars."). A one-shot PRESENTATION flag, never a
 * gate: the orchestrator reads it to know the reveal has been shown and never shows it twice (the eater
 * speaks in UI). engine/content/starEater sets the SAME literal in lock-step (the moonStrata idiom, ADR §3).
 * No schema bump: a flag rides the flags z.record.
 */
export const EATER_COUNTER_SHOWN_FLAG = 'eaterCounterShown'

/**
 * The string flag recording WHICH ending was chosen (Act 4 — the choice, DESIGN §16/§200-204). Lives in the
 * STRINGS namespace (not flags), set commit-once to one of 'hatch' / 'feed' / 'eat' — its presence gates the
 * choice itself (canChoose requires it UNSET) and gates each ending's persistent effect (the effect fires only
 * on the dispatch that sets it, never re-runnable / farmable). engine/content/endings reads/sets the SAME
 * literal in lock-step (the moonStrata idiom — the engine never imports this content value, ADR §3). No schema
 * bump: a string rides the strings z.record.
 */
export const ENDING_CHOSEN_FLAG = 'endingChosen'

/** The three terminal ending ids the ENDING_CHOSEN_FLAG string can hold. */
export const ENDING_HATCH = 'hatch'
export const ENDING_FEED = 'feed'
export const ENDING_EAT = 'eat'

/**
 * Set by ending 1 (LET IT HATCH) — the sun goes dark, the dragon ascends BURNING and relights the eaten stars
 * (DESIGN §200/§202). engine/content/starCounter reads the SAME literal in lock-step (the moonStrata idiom) to
 * switch the descent into an INVERTED relight branch: projectedStars / reconcileStars tick the count UP toward
 * STARTING_STARS=8128 (clamped there — the ONLY up-tick in the whole game), still on accumulatedGameTimeMs. Set
 * commit-once TOGETHER with the ending string by engine/content/endings.chooseHatch. No schema bump (a flag).
 */
export const STARS_RELIGHTING_FLAG = 'starsRelighting'

/**
 * Set by ending 2 (FEED THE SUN) — the dragon sleeps sated and the star-eater becomes its guardian; the sky
 * stops, up or down, forever (DESIGN §201/§203). engine/content/starCounter reads the SAME literal in lock-step
 * (the moonStrata idiom): when set, projectedStars returns starsRemaining unchanged and reconcileStars early-
 * returns the SAME reference (the descent freezes). Set commit-once TOGETHER with the ending string + the candy
 * hoard zeroed by engine/content/endings.chooseFeed. No schema bump (a flag rides the flags z.record).
 */
export const STAR_COUNTER_FROZEN_FLAG = 'starCounterFrozen'

import type { DeathMessage } from '@/engine/types/defs'

// Shared death-flavor lines keyed by damage source, with the mandatory 'generic' fallback
// (Block E note: omit it and the Scene returns an empty message). Quests reference subsets.

export const CANDY_BAT_DEATH: DeathMessage = {
  source: 'candyBat',
  message: 'death.candyBat',
}

export const SUGAR_GOLEM_DEATH: DeathMessage = {
  source: 'sugarGolem',
  message: 'death.sugarGolem',
}

export const GUMMY_WORM_DEATH: DeathMessage = {
  source: 'gummyWorm',
  message: 'death.gummyWorm',
}

export const GUMMY_SLIME_DEATH: DeathMessage = {
  source: 'gummySlime',
  message: 'death.gummySlime',
}

export const GUMMY_BEAR_DEATH: DeathMessage = {
  source: 'gummyBear',
  message: 'death.gummyBear',
}

export const GUMMY_APHID_DEATH: DeathMessage = {
  source: 'gummyAphid',
  message: 'death.gummyAphid',
}

export const CLOUD_RAT_DEATH: DeathMessage = {
  source: 'cloudRat',
  message: 'death.cloudRat',
}

export const MINE_SENTINEL_DEATH: DeathMessage = {
  source: 'mineSentinel',
  message: 'death.mineSentinel',
}

export const ROCK_IMP_DEATH: DeathMessage = {
  source: 'rockImp',
  message: 'death.rockImp',
}

export const STORM_SPRITE_DEATH: DeathMessage = {
  source: 'stormSprite',
  message: 'death.stormSprite',
}

export const THUNDERHEAD_DJINN_DEATH: DeathMessage = {
  source: 'thunderheadDjinn',
  message: 'death.thunderheadDjinn',
}

export const MOON_WORM_DEATH: DeathMessage = {
  source: 'moonWorm',
  message: 'death.moonWorm',
}

export const FALL_DEATH: DeathMessage = {
  source: 'fall',
  message: 'death.fall',
}

// --- Act 1 zone losses -----------------------------------------------------
// The toll-giant "not today" beat is a soft loss (you pay instead), but §19 wants
// a line for every loss SOURCE; the bridge stays open, so this is flavor only.

export const TOLL_GIANT_DEATH: DeathMessage = {
  source: 'tollGiantLoss',
  message: 'death.tollGiantLoss',
}

// --- Act 2 transient turn-based fights -------------------------------------

/** The reef drift-strand — out of gumballs, drifting (the §19 sample, centralized off reefScreens). */
export const REEF_DRIFT_DEATH: DeathMessage = {
  source: 'reefDrift',
  message: 'death.reefDrift',
}

/** Captain Sourbeard's broadside — a hull-buckling cannonball (§19 sample). */
export const SOURBEARD_CANNON_DEATH: DeathMessage = {
  source: 'sourbeardCannon',
  message: 'death.sourbeardCannon',
}

/** Captain Sourbeard's boarding melee — read like a book, on foot. */
export const SOURBEARD_BOARDING_DEATH: DeathMessage = {
  source: 'sourbeardBoarding',
  message: 'death.sourbeardBoarding',
}

/** The sour kraken — folded off the shell by an arm you could not reach. */
export const KRAKEN_DEATH: DeathMessage = {
  source: 'kraken',
  message: 'death.kraken',
}

/** The sour planet's corrosive gas — dissolved, politely (§19 sample). */
export const SOUR_DISSOLVE_DEATH: DeathMessage = {
  source: 'sourDissolve',
  message: 'death.sourDissolve',
}

// NOTE: no sourRain / sourPlanetFall / frostWyrm death lines — those beats are canonically
// NOT deaths (sour rain is a POSITIVE +resist achievement §335; the sour planet is a peaceful
// first-contact zone with no loss path; the frost wyrm is a tragic "not a fight" vigil, not
// combat). Author-ahead is fine for signposted future losses, but not for beats that contradict
// canon — so these three are intentionally absent from the registry.

/** The mint planet's ice labyrinth — folded back on itself (§19 sample). */
export const MINT_LABYRINTH_DEATH: DeathMessage = {
  source: 'mintLabyrinth',
  message: 'death.mintLabyrinth',
}

// --- Act 3-4 sun descent + the star-eater ----------------------------------

/** The photosphere descent — coolant or plating gives out in the white heat (§19 sample: the sun declines). */
export const PHOTOSPHERE_HEAT_DEATH: DeathMessage = {
  source: 'photosphereHeat',
  message: 'death.photosphereHeat',
}

/** The star-eater gets through — the cold long dark of it. */
export const STAR_EATER_DEATH: DeathMessage = {
  source: 'starEater',
  message: 'death.starEater',
}

/** The newborn star slips your grip (ending 4, the fossil-star dance) — a soft, costless loss; it still went up. */
export const FOSSIL_STAR_DEATH: DeathMessage = {
  source: 'fossilStar',
  message: 'death.fossilStar',
}

// --- storm + poignant generics ---------------------------------------------

/** The storm front takes you in (§19 sample) — the on-foot climb has its own sprite/djinn lines; this is the merge. */
export const STORM_MERGE_DEATH: DeathMessage = {
  source: 'stormMerge',
  message: 'death.stormMerge',
}

/** The understated grandma line (§19 sample) — the deadpan reminder she was the hero. */
export const GRANDMA_DUCK_DEATH: DeathMessage = {
  source: 'grandmaDuck',
  message: 'death.grandmaDuck',
}

// --- Phase-5 hidden bosses (author now so later boss slices attach here) ----
// These attach to the registry ahead of the boss increments (P5-06..P5-11) so a new
// boss never ships an un-messaged death; each boss slice WIRES its already-authored line.

/** The cloud wolf — the thing that was never a sheep (Phase 5, hidden boss 1, §17). */
export const CLOUD_WOLF_DEATH: DeathMessage = {
  source: 'cloudWolf',
  message: 'death.cloudWolf',
}

/** The void whale did not even notice (§19 sample). */
export const VOID_WHALE_DEATH: DeathMessage = {
  source: 'voidWhale',
  message: 'death.voidWhale',
}

/** Your reflection — it fights how you fight, and it does not blink (Phase 5, hidden boss 2, §17/§18). */
export const REFLECTION_DEATH: DeathMessage = {
  source: 'reflection',
  message: 'death.reflection',
}

/** The hallucination — you believed the numbers, and the numbers were lying (Phase 5, hidden boss 3, §17/§28). */
export const HALLUCINATION_DEATH: DeathMessage = {
  source: 'hallucination',
  message: 'death.hallucination',
}

export const GENERIC_DEATH: DeathMessage = {
  source: 'generic',
  message: 'death.generic',
}

/** Every death message, so the i18n completeness check stays data-driven as new foes are added. */
export const ALL_DEATH_MESSAGES: readonly DeathMessage[] = [
  CANDY_BAT_DEATH,
  SUGAR_GOLEM_DEATH,
  GUMMY_WORM_DEATH,
  GUMMY_SLIME_DEATH,
  GUMMY_BEAR_DEATH,
  GUMMY_APHID_DEATH,
  CLOUD_RAT_DEATH,
  MINE_SENTINEL_DEATH,
  ROCK_IMP_DEATH,
  STORM_SPRITE_DEATH,
  THUNDERHEAD_DJINN_DEATH,
  MOON_WORM_DEATH,
  FALL_DEATH,
  TOLL_GIANT_DEATH,
  REEF_DRIFT_DEATH,
  SOURBEARD_CANNON_DEATH,
  SOURBEARD_BOARDING_DEATH,
  KRAKEN_DEATH,
  SOUR_DISSOLVE_DEATH,
  MINT_LABYRINTH_DEATH,
  PHOTOSPHERE_HEAT_DEATH,
  STAR_EATER_DEATH,
  FOSSIL_STAR_DEATH,
  STORM_MERGE_DEATH,
  GRANDMA_DUCK_DEATH,
  CLOUD_WOLF_DEATH,
  VOID_WHALE_DEATH,
  REFLECTION_DEATH,
  HALLUCINATION_DEATH,
  GENERIC_DEATH,
]

/**
 * The bespoke (non-generic) death SOURCES §19 requires across Acts 0-4 plus the Phase-5 bosses.
 * The completeness test asserts each resolves to its OWN line (never the generic fallback), so a
 * new loss source can never silently fall through to "You died. You feel fine about it."
 */
export const BESPOKE_DEATH_SOURCES: readonly string[] = ALL_DEATH_MESSAGES.filter(
  (m) => m.source !== 'generic',
).map((m) => m.source)

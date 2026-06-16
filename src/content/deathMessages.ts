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

export const FALL_DEATH: DeathMessage = {
  source: 'fall',
  message: 'death.fall',
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
  FALL_DEATH,
  GENERIC_DEATH,
]

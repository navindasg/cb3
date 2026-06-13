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

export const GUMMY_APHID_DEATH: DeathMessage = {
  source: 'gummyAphid',
  message: 'death.gummyAphid',
}

export const CLOUD_RAT_DEATH: DeathMessage = {
  source: 'cloudRat',
  message: 'death.cloudRat',
}

export const FALL_DEATH: DeathMessage = {
  source: 'fall',
  message: 'death.fall',
}

export const GENERIC_DEATH: DeathMessage = {
  source: 'generic',
  message: 'death.generic',
}

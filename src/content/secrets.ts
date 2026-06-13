import type { SecretDef } from '@/engine/types/defs'

// Act 0 secrets as data (ADR §10 SecretDef). The fossil twitches only when fed EXACTLY one
// candy. The well pays interest on candies thrown into it (a +1 candy stub). The giant
// beanstalk leaf reveals a hammock when you hold exactly a single lollipop. Each is matched
// by engine/content/secrets against a player interaction.

/** The fossil at the bottom of the sugar mines: feed it EXACTLY 1 candy and it twitches. */
export const FOSSIL_TWITCH: SecretDef = {
  id: 'fossilTwitch',
  trigger: { kind: 'feedExactly', resource: 'candies', count: 1 },
  setsFlag: 'fossilTwitched',
  revealKey: 'secret.fossilTwitch.reveal',
}

/** The village well: throwing candies in pays a token +1 candy "interest" (stub). */
export const WELL_INTEREST: SecretDef = {
  id: 'wellInterest',
  trigger: { kind: 'throwAt', target: 'well' },
  setsFlag: 'wellInterestFound',
  revealKey: 'secret.wellInterest.reveal',
  reward: { resource: 'candies', amount: 1 },
}

/** The giant leaf on the beanstalk: hold exactly ONE lollipop and a hammock unfurls. */
export const SINGLE_LOLLIPOP_LEAF: SecretDef = {
  id: 'singleLollipopLeaf',
  trigger: { kind: 'holdExactly', resource: 'lollipops', count: 1 },
  setsFlag: 'hammockFound',
  revealKey: 'secret.singleLollipopLeaf.reveal',
}

export const ACT0_SECRETS: readonly SecretDef[] = [FOSSIL_TWITCH, WELL_INTEREST, SINGLE_LOLLIPOP_LEAF]

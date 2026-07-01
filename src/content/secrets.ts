import type { SecretDef } from '@/engine/types/defs'
import { GALLEON_NAME_KEY } from '@/content/ship/galleon'
import { CANDY_BOX_FIGUREHEAD } from '@/content/items/items'

// Act 0 secrets as data (ADR §10 SecretDef). The fossil twitches only when fed EXACTLY one
// candy. The well pays interest on candies thrown into it (a +1 candy stub). The giant
// beanstalk leaf reveals a hammock when you hold exactly a single lollipop. Each is matched
// by engine/content/secrets against a player interaction. Later Acts add their own batches
// (Phase 5, §18): the sun-poke gag, the galleon-name figurehead — same runner, more data.

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

// --- Phase 5 interaction secrets, batch A (DESIGN §18) ---------------------------------------------
// The absurd, dry, cosmetic-first curiosities of the late game. Each rides the SAME secret runner as the
// Act-0 three; only the trigger kinds are new (countAtLeast, nameEquals). None blocks progress.

/** numbers-namespace key holding how many times the sun has been poked (bumped by the scaffold screen). */
export const SUN_POKES_KEY = 'sunPokes'

/** How many pokes it takes before the sun (or its keeper) asks you, dryly, to stop. */
export const SUN_POKE_LIMIT = 10

/**
 * Poke the sun ten times → 'please stop poking the sun.' A running gag with a hard stop: the scaffold
 * screen bumps numbers.sunPokes on each poke and feeds a countAtLeast interaction; this fires exactly once
 * at ten (the setsFlag latch) and confers the deadpan "sun poker" status. Cosmetic — grants nothing to farm.
 */
export const SUN_POKER: SecretDef = {
  id: 'sunPoker',
  trigger: { kind: 'countAtLeast', counterKey: SUN_POKES_KEY, count: SUN_POKE_LIMIT },
  setsFlag: 'sunPokerFound',
  revealKey: 'secret.sunPoker.reveal',
}

/**
 * Name the galleon 'Candy Box' → the secret aniwey-smiley figurehead. The quiet homage to the game this one
 * descends from: named after Candy Box, she reveals a tiny carved smiley on her bow (purely cosmetic — the
 * carved smiley on her dock art, no stat). The naming path feeds a nameEquals interaction that reads the
 * stored galleon name case/space-normalized, so 'candy box' / 'CANDY BOX' / 'Candy  Box' all count.
 */
export const CANDY_BOX_FIGUREHEAD_SECRET: SecretDef = {
  id: 'candyBoxFigurehead',
  trigger: { kind: 'nameEquals', stringKey: GALLEON_NAME_KEY, value: 'candy box' },
  setsFlag: 'candyBoxFigureheadOwned',
  revealKey: 'secret.figurehead.reveal',
  grantsItemId: CANDY_BOX_FIGUREHEAD.id,
}

/** The Phase-5 batch-A interaction secrets (the sun-poke gag + the galleon-name figurehead). */
export const BATCH_A_SECRETS: readonly SecretDef[] = [SUN_POKER, CANDY_BOX_FIGUREHEAD_SECRET]

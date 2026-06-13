import type { ProducerDef } from '@/engine/types/defs'

// Candy producers as data (ADR §10 ProducerDef). The tick sums getRate() over the registry,
// so a new candy source is a new record — never an engine edit. Act 0's sources: grandma's
// candy recipes (once you have the wooden spoon she keeps baking) and field expansions
// purchased with lollipops. Each rate derives purely from current state.

/** Grandma bakes a slow trickle of candy once you carry her wooden spoon. */
const GRANDMA_RECIPES: ProducerDef = {
  id: 'grandmaRecipes',
  resource: 'candies',
  getRate: (s) => (s.flags['spoonOwned'] === true ? 0.5 : 0),
}

/** Each field expansion (a number-namespace counter) adds a steady candy yield. */
const FIELD_EXPANSIONS: ProducerDef = {
  id: 'fieldExpansions',
  resource: 'candies',
  getRate: (s) => (s.numbers['fieldExpansions'] ?? 0) * 0.25,
}

export const CANDY_PRODUCERS: readonly ProducerDef[] = [GRANDMA_RECIPES, FIELD_EXPANSIONS]

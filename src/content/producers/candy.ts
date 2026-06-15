import type { ProducerDef } from '@/engine/types/defs'

// Candy producers as data (ADR §10 ProducerDef). The tick sums getRate() over the registry,
// so a new candy source is a new record — never an engine edit. Act 0's sources: your field
// grows a baseline trickle from the very first moment (the CB1/CB2 candy-box idiom — candies
// always flow), grandma keeps baking a little extra once you carry her wooden spoon, and each
// field expansion (bought with lollipops) adds a steady yield. Each rate is pure over state.

/** Your field grows candy on its own from the start — the baseline income (never gated). */
const FIELD_PATCH: ProducerDef = {
  id: 'fieldPatch',
  resource: 'candies',
  getRate: () => 0.5,
}

/** Grandma bakes a little extra candy once you carry her wooden spoon (on top of the field). */
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

export const CANDY_PRODUCERS: readonly ProducerDef[] = [
  FIELD_PATCH,
  GRANDMA_RECIPES,
  FIELD_EXPANSIONS,
]

import type { GameState } from '@/engine/types/GameState'
import type { CauldronEntry, RecipeDef } from '@/engine/types/defs'
import { addResource } from '@/engine/types/Resource'
import { matchRecipe } from '@/engine/cauldron/recipeMatcher'

// Applies a cauldron brew: match the action log against the recipe registry, then award the
// matched recipe's output (a resource quantity and/or a flag). Pure & immutable — a fresh
// state on success, the SAME reference when nothing brews (signal effects skip via Object.is).

export interface BrewResult {
  /** True when a recipe matched and brewed. */
  readonly brewed: boolean
  /** The state after brewing (new on success, same reference otherwise). */
  readonly state: GameState
  /** The recipe that matched (for the reveal line); present only when brewed. */
  readonly recipe?: RecipeDef
}

/**
 * Brew from a raw action log: the first recipe whose matcher accepts the log wins. Its
 * resource output is added (lifetime totals updated via addResource) and its outputFlag set.
 */
export function brew(
  state: GameState,
  log: readonly CauldronEntry[],
  recipes: readonly RecipeDef[],
): BrewResult {
  const recipe = matchRecipe(recipes, log)
  if (!recipe) return { brewed: false, state }

  let next: GameState = state
  if (recipe.output) {
    const quantity = recipe.quantity ?? 1
    next = { ...next, [recipe.output]: addResource(next[recipe.output], quantity) }
  }
  if (recipe.outputFlag) {
    next = { ...next, flags: { ...next.flags, [recipe.outputFlag]: true } }
  }
  return { brewed: true, state: next, recipe }
}

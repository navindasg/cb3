import type { RecipeDef } from '@/engine/types/defs'

// Cauldron recipes as DECLARATIVE matcher data (resolved decision 1). Each matcher is a tree
// of combinators interpreted by engine/cauldron/recipeMatcher — content authors pure data,
// never a closure, so layering holds. Syrup of health is Phase 1's first recipe: add a candy,
// stir, heat, add a lollipop — in that order — and exactly one lollipop goes in.

export const SYRUP_OF_HEALTH: RecipeDef = {
  id: 'syrupOfHealth',
  displayKey: 'recipe.syrupOfHealth.name',
  output: 'chocolate', // Phase 1 stand-in resource for "a health syrup vial"
  quantity: 1,
  outputFlag: 'knowsSyrupOfHealth',
  // The whole log must (a) follow the sequence add-candy → stir → heat → add-lollipop and
  // (b) contain EXACTLY ONE lollipop addition. `all` composes the order constraint with the
  // whole-log exactlyOne count — so a stray second lollipop spoils the brew.
  matcher: {
    kind: 'all',
    specs: [
      {
        kind: 'inOrder',
        steps: [
          { kind: 'action', action: 'add', subject: 'candy' },
          { kind: 'action', action: 'stir' },
          { kind: 'action', action: 'heat' },
          { kind: 'action', action: 'add', subject: 'lollipop' },
        ],
      },
      { kind: 'exactlyOne', step: { kind: 'action', action: 'add', subject: 'lollipop' } },
    ],
  },
}

export const CAULDRON_RECIPES: readonly RecipeDef[] = [SYRUP_OF_HEALTH]

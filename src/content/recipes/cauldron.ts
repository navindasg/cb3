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

// Fizzy lifting soda (DESIGN §11) — the float draught. Brewing it sets the capability flag the
// storm front's updrafts demand (FIZZY_LIFTING_SODA_FLAG). A distinct sequence from the syrup:
// TWO candies, then heat, then stir (boil it, then whisk the fizz in). It naturally stays disjoint
// from the syrup recipe — matchRecipe is first-match-wins and the syrup (listed first) demands a
// lollipop, so a lollipop-free fizzy log never satisfies it. No resource output; the worth is the
// flag.
export const FIZZY_LIFTING_SODA: RecipeDef = {
  id: 'fizzyLiftingSoda',
  displayKey: 'recipe.fizzyLiftingSoda.name',
  output: null,
  outputFlag: 'fizzyLiftingSodaKnown',
  matcher: {
    kind: 'inOrder',
    steps: [
      { kind: 'action', action: 'add', subject: 'candy' },
      { kind: 'action', action: 'add', subject: 'candy' },
      { kind: 'action', action: 'heat' },
      { kind: 'action', action: 'stir' },
    ],
  },
}

export const CAULDRON_RECIPES: readonly RecipeDef[] = [SYRUP_OF_HEALTH, FIZZY_LIFTING_SODA]

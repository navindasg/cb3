import type { CauldronEntry } from '@/engine/types/defs'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { brew } from '@/engine/cauldron/brew'
import { CAULDRON_RECIPES } from '@/content/recipes/cauldron'

const syrupLog: readonly CauldronEntry[] = [
  { action: 'add', subject: 'candy' },
  { action: 'stir' },
  { action: 'heat' },
  { action: 'add', subject: 'lollipop' },
]

// fizzy lifting soda: two candies, heat, then stir (no lollipop).
const fizzyLog: readonly CauldronEntry[] = [
  { action: 'add', subject: 'candy' },
  { action: 'add', subject: 'candy' },
  { action: 'heat' },
  { action: 'stir' },
]

describe('brew', () => {
  it('brews the matching recipe: adds the output and sets the output flag', () => {
    const state = createDefaultSave()
    const result = brew(state, syrupLog, CAULDRON_RECIPES)
    expect(result.brewed).toBe(true)
    expect(result.recipe?.id).toBe('syrupOfHealth')
    expect(result.state.chocolate.current).toBe(1) // syrup output quantity
    expect(result.state.flags['knowsSyrupOfHealth']).toBe(true)
  })

  it('returns the same state reference when nothing matches', () => {
    const state = createDefaultSave()
    const result = brew(state, [{ action: 'nonsense' }], CAULDRON_RECIPES)
    expect(result.brewed).toBe(false)
    expect(result.state).toBe(state)
  })

  it('does not mutate the input state', () => {
    const state = createDefaultSave()
    brew(state, syrupLog, CAULDRON_RECIPES)
    expect(state.chocolate.current).toBe(0)
    expect(state.flags['knowsSyrupOfHealth']).toBeUndefined()
  })

  it('brews the fizzy lifting soda: sets its flag, no resource output', () => {
    const state = createDefaultSave()
    const result = brew(state, fizzyLog, CAULDRON_RECIPES)
    expect(result.brewed).toBe(true)
    expect(result.recipe?.id).toBe('fizzyLiftingSoda')
    expect(result.state.flags['fizzyLiftingSodaKnown']).toBe(true)
  })

  it('keeps the two recipes disjoint (syrup needs a lollipop; fizzy must not become syrup)', () => {
    const fromSyrup = brew(createDefaultSave(), syrupLog, CAULDRON_RECIPES)
    const fromFizzy = brew(createDefaultSave(), fizzyLog, CAULDRON_RECIPES)
    expect(fromSyrup.recipe?.id).toBe('syrupOfHealth')
    expect(fromFizzy.recipe?.id).toBe('fizzyLiftingSoda')
    // The fizzy log (no lollipop) never satisfies the syrup recipe.
    expect(fromFizzy.state.flags['knowsSyrupOfHealth']).toBeUndefined()
  })
})

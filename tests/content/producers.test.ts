import { createDefaultSave } from '@/engine/state/defaultSave'
import { tick } from '@/engine/loop/tick'
import { productionRate } from '@/engine/loop/production'
import { CANDY_PRODUCERS } from '@/content/producers/candy'
import type { GameState } from '@/engine/types/GameState'

describe('candy producers', () => {
  it('produce nothing at the start (no spoon, no field expansions)', () => {
    expect(productionRate(createDefaultSave(), CANDY_PRODUCERS, 'candies')).toBe(0)
  })

  it('grandma bakes candy once the spoon is owned', () => {
    const withSpoon: GameState = { ...createDefaultSave(), flags: { spoonOwned: true } }
    expect(productionRate(withSpoon, CANDY_PRODUCERS, 'candies')).toBe(0.5)
  })

  it('field expansions add a per-expansion yield', () => {
    const expanded: GameState = { ...createDefaultSave(), numbers: { fieldExpansions: 4 } }
    expect(productionRate(expanded, CANDY_PRODUCERS, 'candies')).toBe(1) // 4 * 0.25
  })

  it('the tick sums producer rates over real game time', () => {
    const state: GameState = {
      ...createDefaultSave(),
      flags: { spoonOwned: true },
      numbers: { fieldExpansions: 2 },
    }
    // rate = 0.5 + 2*0.25 = 1 candy/s; one second of game time → +1 candy.
    const after = tick(state, 1000, CANDY_PRODUCERS)
    expect(after.candies.current).toBeCloseTo(state.candies.current + 1)
  })
})

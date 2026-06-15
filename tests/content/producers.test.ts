import { createDefaultSave } from '@/engine/state/defaultSave'
import { tick } from '@/engine/loop/tick'
import { productionRate } from '@/engine/loop/production'
import { CANDY_PRODUCERS } from '@/content/producers/candy'
import type { GameState } from '@/engine/types/GameState'

describe('candy producers', () => {
  it('your field grows a baseline trickle from the very start (no spoon needed)', () => {
    expect(productionRate(createDefaultSave(), CANDY_PRODUCERS, 'candies')).toBe(0.5)
  })

  it('grandma bakes a little extra once the spoon is owned (on top of the field)', () => {
    const withSpoon: GameState = { ...createDefaultSave(), flags: { spoonOwned: true } }
    expect(productionRate(withSpoon, CANDY_PRODUCERS, 'candies')).toBe(1) // 0.5 field + 0.5 grandma
  })

  it('field expansions add a per-expansion yield on top of the baseline', () => {
    const expanded: GameState = { ...createDefaultSave(), numbers: { fieldExpansions: 4 } }
    expect(productionRate(expanded, CANDY_PRODUCERS, 'candies')).toBe(1.5) // 0.5 + 4 * 0.25
  })

  it('the tick sums producer rates over real game time', () => {
    const state: GameState = {
      ...createDefaultSave(),
      flags: { spoonOwned: true },
      numbers: { fieldExpansions: 2 },
    }
    // rate = 0.5 field + 0.5 grandma + 2*0.25 = 1.5 candy/s; one second → +1.5 candy.
    const after = tick(state, 1000, CANDY_PRODUCERS)
    expect(after.candies.current).toBeCloseTo(state.candies.current + 1.5)
  })
})

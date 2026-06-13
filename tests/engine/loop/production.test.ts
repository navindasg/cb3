import { productionRate } from '@/engine/loop/production'
import { createDefaultSave } from '@/engine/state/defaultSave'
import type { ProducerDef } from '@/engine/types/defs'

describe('productionRate', () => {
  const state = createDefaultSave()

  it('sums producers for the requested resource only', () => {
    const producers: ProducerDef[] = [
      { id: 'a', resource: 'candies', getRate: () => 1 },
      { id: 'b', resource: 'candies', getRate: () => 4 },
      { id: 'c', resource: 'lollipops', getRate: () => 9 },
    ]
    expect(productionRate(state, producers, 'candies')).toBe(5)
    expect(productionRate(state, producers, 'lollipops')).toBe(9)
    expect(productionRate(state, producers, 'rockCandy')).toBe(0)
  })

  it('is zero with no producers', () => {
    expect(productionRate(state, [], 'candies')).toBe(0)
  })
})

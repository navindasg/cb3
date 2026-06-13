import { createDefaultSave } from '@/engine/state/defaultSave'
import { eatCandies, throwCandies, setFlag, setNumber } from '@/engine/state/reducers'
import { addResource } from '@/engine/types/Resource'
import type { GameState } from '@/engine/types/GameState'

function withCandies(n: number): GameState {
  const s = createDefaultSave()
  return { ...s, candies: addResource(s.candies, n - s.candies.current) }
}

describe('eatCandies', () => {
  it('moves candies from the balance into lifetimeCandiesEaten', () => {
    const after = eatCandies(withCandies(10), 3)
    expect(after.candies.current).toBe(7)
    expect(after.lifetimeCandiesEaten).toBe(3)
  })

  it('does nothing when unaffordable (same reference)', () => {
    const s = withCandies(2)
    expect(eatCandies(s, 5)).toBe(s)
  })

  it('ignores non-positive counts', () => {
    const s = withCandies(5)
    expect(eatCandies(s, 0)).toBe(s)
    expect(eatCandies(s, -1)).toBe(s)
  })

  it('does not shrink lifetimeAccumulated (eaten candies were still earned)', () => {
    const s = withCandies(10)
    const after = eatCandies(s, 10)
    expect(after.candies.lifetimeAccumulated).toBe(s.candies.lifetimeAccumulated)
  })

  it('does not mutate the input state', () => {
    const s = withCandies(10)
    eatCandies(s, 5)
    expect(s.candies.current).toBe(10)
    expect(s.lifetimeCandiesEaten).toBe(0)
  })
})

describe('throwCandies', () => {
  it('moves candies into lifetimeCandiesThrown', () => {
    const after = throwCandies(withCandies(5), 2)
    expect(after.candies.current).toBe(3)
    expect(after.lifetimeCandiesThrown).toBe(2)
  })

  it('does nothing when unaffordable or non-positive (same reference)', () => {
    const s = withCandies(1)
    expect(throwCandies(s, 5)).toBe(s)
    expect(throwCandies(s, 0)).toBe(s)
  })
})

describe('setFlag / setNumber', () => {
  it('setFlag sets immutably', () => {
    const s = createDefaultSave()
    const after = setFlag(s, 'telescopeOwned')
    expect(after.flags['telescopeOwned']).toBe(true)
    expect(s.flags['telescopeOwned']).toBeUndefined()
  })

  it('setFlag returns the same reference when unchanged', () => {
    const s = setFlag(createDefaultSave(), 'x', true)
    expect(setFlag(s, 'x', true)).toBe(s)
  })

  it('setNumber stores a namespace value', () => {
    const after = setNumber(createDefaultSave(), 'candiesFedToBeanstalk', 250)
    expect(after.numbers['candiesFedToBeanstalk']).toBe(250)
  })

  it('setNumber returns the same reference when unchanged', () => {
    const s = setNumber(createDefaultSave(), 'scrollY', 40)
    expect(setNumber(s, 'scrollY', 40)).toBe(s)
  })
})

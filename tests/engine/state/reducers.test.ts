import { createDefaultSave } from '@/engine/state/defaultSave'
import {
  eatCandies,
  eatAllCandies,
  throwCandies,
  equip,
  unequip,
  setFlag,
  setNumber,
  setString,
} from '@/engine/state/reducers'
import { MAX_HP_KEY } from '@/engine/state/recomputeCaches'
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

  it('heals current HP by the number of candies eaten, clamped to the max', () => {
    const hurt: GameState = { ...withCandies(10), playerHpCurrent: 4 }
    const after = eatCandies(hurt, 3) // +3 HP -> 7, still below the 10 cap
    expect(after.playerHpCurrent).toBe(7)
    // Eating more than the deficit tops out exactly at the (freshly recomputed) max.
    const fed = eatCandies(hurt, 10)
    expect(fed.playerHpCurrent).toBe(10)
  })

  it('raises the max-HP ceiling as the lifetime eaten crosses the threshold, in one transition', () => {
    const hurt: GameState = { ...withCandies(50), playerHpCurrent: 1 }
    const after = eatCandies(hurt, 50) // lifetime 50 -> maxHp 11; heal 1+50 -> clamps to 11
    expect(after.numbers[MAX_HP_KEY]).toBe(11)
    expect(after.playerHpCurrent).toBe(11)
  })
})

describe('eatAllCandies', () => {
  it('eats the whole current stack at once (CB2 "eat all")', () => {
    const after = eatAllCandies(withCandies(7))
    expect(after.candies.current).toBe(0)
    expect(after.lifetimeCandiesEaten).toBe(7)
  })

  it('is a no-op (same reference) with no candies', () => {
    const s = withCandies(0)
    expect(eatAllCandies(s)).toBe(s)
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

  it('throws a batch of ten by default (CB2), and only when affordable', () => {
    const after = throwCandies(withCandies(10))
    expect(after.candies.current).toBe(0)
    expect(after.lifetimeCandiesThrown).toBe(10)
    const poor = withCandies(9)
    expect(throwCandies(poor)).toBe(poor)
  })
})

describe('equip / unequip', () => {
  function withOwned(...ids: string[]): GameState {
    const s = createDefaultSave()
    const ownedItems = Object.fromEntries(ids.map((id) => [id, true]))
    return { ...s, ownedItems }
  }

  it('equips an owned item into its slot', () => {
    const after = equip(withOwned('woodenSpoon'), 'weapon', 'woodenSpoon')
    expect(after.equipped.weapon).toBe('woodenSpoon')
  })

  it('refuses to equip an item the player does not own (same reference)', () => {
    const s = withOwned()
    expect(equip(s, 'weapon', 'ironSword')).toBe(s)
  })

  it('is a no-op when the item is already equipped (same reference)', () => {
    const s = equip(withOwned('woodenSpoon'), 'weapon', 'woodenSpoon')
    expect(equip(s, 'weapon', 'woodenSpoon')).toBe(s)
  })

  it('unequips a slot and is a no-op on an empty slot', () => {
    const equipped = equip(withOwned('woodenSpoon'), 'weapon', 'woodenSpoon')
    const bare = unequip(equipped, 'weapon')
    expect(bare.equipped.weapon).toBeNull()
    expect(unequip(bare, 'weapon')).toBe(bare)
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

  it('setString stores a namespace value immutably', () => {
    const s = createDefaultSave()
    const after = setString(s, 'galleonName', 'the Sweet Tooth')
    expect(after.strings['galleonName']).toBe('the Sweet Tooth')
    expect(s.strings['galleonName']).toBeUndefined()
  })

  it('setString returns the same reference when unchanged', () => {
    const s = setString(createDefaultSave(), 'galleonName', 'Candy Box')
    expect(setString(s, 'galleonName', 'Candy Box')).toBe(s)
  })
})

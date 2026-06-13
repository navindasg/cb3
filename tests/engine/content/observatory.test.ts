import { createDefaultSave } from '@/engine/state/defaultSave'
import { createResource } from '@/engine/types/Resource'
import { buyTelescope } from '@/engine/content/observatory'
import { OBSERVATORY_ENTRIES } from '@/content/shops/observatory'
import { ITEM_MAP } from '@/content/items/items'
import { starCounterVisible, projectedStars, MS_PER_STAR } from '@/engine/content/starCounter'
import type { GameState } from '@/engine/types/GameState'

const telescopeEntry = OBSERVATORY_ENTRIES.find((e) => e.itemId === 'telescope')!

function rich(over: Partial<GameState> = {}): GameState {
  return { ...createDefaultSave(), candies: createResource(2000), ...over }
}

describe('buyTelescope wiring', () => {
  it('purchases the telescope and reveals the star counter', () => {
    const state = rich()
    expect(starCounterVisible(state)).toBe(false)
    const result = buyTelescope(state, telescopeEntry, ITEM_MAP)
    expect(result.ok).toBe(true)
    expect(starCounterVisible(result.state)).toBe(true)
    expect(result.state.flags['telescopeOwned']).toBe(true)
  })

  it('stamps telescopeBoughtAtMs at the current accumulated game time', () => {
    const state = rich({ accumulatedGameTimeMs: 7 * MS_PER_STAR })
    const result = buyTelescope(state, telescopeEntry, ITEM_MAP)
    expect(result.state.numbers['telescopeBoughtAtMs']).toBe(7 * MS_PER_STAR)
    // Immediately after purchase no time has elapsed since the stamp → full count.
    expect(projectedStars(result.state)).toBe(8128)
  })

  it('the counter then decrements on accumulated time after purchase', () => {
    const bought = buyTelescope(rich({ accumulatedGameTimeMs: 7 * MS_PER_STAR }), telescopeEntry, ITEM_MAP)
    // Advance accumulated game time by 4 stars' worth.
    const later: GameState = {
      ...bought.state,
      accumulatedGameTimeMs: bought.state.accumulatedGameTimeMs + 4 * MS_PER_STAR,
    }
    expect(projectedStars(later)).toBe(8124)
  })

  it('returns the purchase failure unchanged when unaffordable', () => {
    const broke = { ...createDefaultSave(), candies: createResource(0) }
    const result = buyTelescope(broke, telescopeEntry, ITEM_MAP)
    expect(result.ok).toBe(false)
    expect(result.state).toBe(broke)
  })
})

import { createDefaultSave } from '@/engine/state/defaultSave'
import { purchase } from '@/engine/shop/purchase'
import { BALLOON_ENTRY } from '@/content/sky/balloon'
import { ITEM_MAP } from '@/content/items/items'
import { BALLOON_BUILT_FLAG } from '@/content/flags'
import type { GameState } from '@/engine/types/GameState'

const stocked = (cotton: number, lic: number): GameState => ({
  ...createDefaultSave(),
  cottonCandy: { current: cotton, lifetimeAccumulated: cotton, historicalMax: cotton },
  licorice: { current: lic, lifetimeAccumulated: lic, historicalMax: lic },
})

describe('the cotton-candy balloon (the cotton-candy sink)', () => {
  it('costs cotton candy AND licorice', () => {
    const resources = BALLOON_ENTRY.price.map((l) => l.resource).sort()
    expect(resources).toEqual(['cottonCandy', 'licorice'])
  })

  it('builds when both resources are affordable: spends both, sets balloonBuilt', () => {
    const cottonCost = BALLOON_ENTRY.price.find((l) => l.resource === 'cottonCandy')!.amount
    const licCost = BALLOON_ENTRY.price.find((l) => l.resource === 'licorice')!.amount
    const before = stocked(cottonCost + 10, licCost + 5)
    const result = purchase(before, BALLOON_ENTRY, ITEM_MAP)
    expect(result.ok).toBe(true)
    expect(result.state.flags[BALLOON_BUILT_FLAG]).toBe(true)
    expect(result.state.ownedItems['cottonCandyBalloon']).toBe(true)
    expect(result.state.cottonCandy.current).toBe(10)
    expect(result.state.licorice.current).toBe(5)
  })

  it('refuses (same reference) when licorice is short even if cotton candy is plenty', () => {
    const cottonCost = BALLOON_ENTRY.price.find((l) => l.resource === 'cottonCandy')!.amount
    const before = stocked(cottonCost + 1000, 0)
    const result = purchase(before, BALLOON_ENTRY, ITEM_MAP)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
  })
})

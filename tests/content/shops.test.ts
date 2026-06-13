import { createDefaultSave } from '@/engine/state/defaultSave'
import { createResource } from '@/engine/types/Resource'
import { purchase, canPurchase } from '@/engine/shop/purchase'
import { ITEM_MAP } from '@/content/items/items'
import { SHOP_ENTRIES } from '@/content/shops/shop'
import { FORGE_ENTRIES } from '@/content/shops/forge'
import { OBSERVATORY_ENTRIES } from '@/content/shops/observatory'
import type { GameState } from '@/engine/types/GameState'

const find = (entries: typeof SHOP_ENTRIES, itemId: string) =>
  entries.find((e) => e.itemId === itemId)!

function rich(over: Partial<GameState> = {}): GameState {
  return { ...createDefaultSave(), candies: createResource(5000), rockCandy: createResource(20), ...over }
}

describe('village shop (escalating, gated)', () => {
  it('sells the leather hat outright', () => {
    const result = purchase(rich(), find(SHOP_ENTRIES, 'leatherHat'), ITEM_MAP)
    expect(result.ok).toBe(true)
    expect(result.state.candies.current).toBe(5000 - 30)
    expect(result.state.equipped.hat).toBe('leatherHat')
  })

  it('gates the grimoire behind owning the hat', () => {
    const grimoire = find(SHOP_ENTRIES, 'beginnerGrimoire')
    expect(canPurchase(rich(), grimoire)).toBe(false)
    expect(purchase(rich(), grimoire, ITEM_MAP).reason).toBe('locked')
    const withHat = rich({ flags: { leatherHatOwned: true } })
    expect(canPurchase(withHat, grimoire)).toBe(true)
  })
})

describe('forge weapon ladder (generic purchase handler)', () => {
  it('gates the wooden sword behind the spoon', () => {
    const sword = find(FORGE_ENTRIES, 'woodenSword')
    expect(canPurchase(rich(), sword)).toBe(false)
    const withSpoon = rich({ flags: { spoonOwned: true } })
    const result = purchase(withSpoon, sword, ITEM_MAP)
    expect(result.ok).toBe(true)
    expect(result.state.equipped.weapon).toBe('woodenSword')
  })

  it('the iron sword costs candies AND rock candy and gates behind the wooden sword', () => {
    const iron = find(FORGE_ENTRIES, 'ironSword')
    const ready = rich({ flags: { woodenSwordOwned: true } })
    const result = purchase(ready, iron, ITEM_MAP)
    expect(result.ok).toBe(true)
    expect(result.state.candies.current).toBe(5000 - 400)
    expect(result.state.rockCandy.current).toBe(20 - 5)
  })

  it('blocks the iron sword without enough rock candy (atomic, candies untouched)', () => {
    const ready = rich({ flags: { woodenSwordOwned: true }, rockCandy: createResource(1) })
    const result = purchase(ready, find(FORGE_ENTRIES, 'ironSword'), ITEM_MAP)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(ready) // no partial deduction
  })
})

describe('observatory shop', () => {
  it('sells the grimoire and the telescope', () => {
    expect(purchase(rich(), find(OBSERVATORY_ENTRIES, 'beginnerGrimoire'), ITEM_MAP).ok).toBe(true)
    expect(purchase(rich(), find(OBSERVATORY_ENTRIES, 'telescope'), ITEM_MAP).ok).toBe(true)
  })
})

describe('every shop entry references a registered item with a non-empty price', () => {
  const all = [...SHOP_ENTRIES, ...FORGE_ENTRIES, ...OBSERVATORY_ENTRIES]
  it.each(all.map((e) => [e.itemId, e] as const))('%s is well-formed', (_id, entry) => {
    expect(ITEM_MAP.has(entry.itemId)).toBe(true)
    expect(entry.price.length).toBeGreaterThan(0)
    for (const line of entry.price) expect(line.amount).toBeGreaterThan(0)
  })
})

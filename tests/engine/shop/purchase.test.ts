import type { GameState } from '@/engine/types/GameState'
import type { ItemDef, ShopEntry } from '@/engine/types/defs'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { createResource } from '@/engine/types/Resource'
import { canPurchase, purchase, grantItem } from '@/engine/shop/purchase'

const spoon: ItemDef = {
  id: 'woodenSpoon',
  displayKey: 'item.spoon.name',
  descKey: 'item.spoon.desc',
  ascii: '/',
  saveFlag: 'spoonOwned',
  slot: 'weapon',
}

const telescope: ItemDef = {
  id: 'telescope',
  displayKey: 'item.telescope.name',
  descKey: 'item.telescope.desc',
  ascii: 'T',
  saveFlag: 'telescopeOwned',
}

const items = new Map<string, ItemDef>([
  [spoon.id, spoon],
  [telescope.id, telescope],
])

const spoonEntry: ShopEntry = {
  itemId: 'woodenSpoon',
  price: [{ resource: 'candies', amount: 30 }],
  speechKey: 'shop.spoon.thanks',
}

function richState(): GameState {
  return { ...createDefaultSave(), candies: createResource(100), lollipops: createResource(5) }
}

describe('purchase', () => {
  it('blocks the purchase when funds are insufficient and keeps the same state', () => {
    const state = { ...createDefaultSave(), candies: createResource(10) }
    const result = purchase(state, spoonEntry, items)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(state) // unchanged reference
  })

  it('deducts the exact cost, sets the saveFlag, grants and equips the item', () => {
    const state = richState()
    const result = purchase(state, spoonEntry, items)
    expect(result.ok).toBe(true)
    expect(result.speechKey).toBe('shop.spoon.thanks')
    expect(result.state.candies.current).toBe(70) // 100 - 30
    expect(result.state.flags.spoonOwned).toBe(true)
    expect(result.state.ownedItems.woodenSpoon).toBe(true)
    expect(result.state.equipped.weapon).toBe('woodenSpoon')
  })

  it('does not equip a slotless item, only marks it owned', () => {
    const state = richState()
    const entry: ShopEntry = {
      itemId: 'telescope',
      price: [{ resource: 'candies', amount: 50 }],
      speechKey: 'obs.telescope.thanks',
    }
    const result = purchase(state, entry, items)
    expect(result.ok).toBe(true)
    expect(result.state.flags.telescopeOwned).toBe(true)
    expect(result.state.ownedItems.telescope).toBe(true)
    expect(result.state.equipped.weapon).toBeNull()
  })

  it('pays multiple price lines and bails atomically when one is unaffordable', () => {
    const entry: ShopEntry = {
      itemId: 'telescope',
      price: [
        { resource: 'candies', amount: 50 },
        { resource: 'lollipops', amount: 99 }, // only 5 available
      ],
      speechKey: 'obs.telescope.thanks',
    }
    const state = richState()
    const result = purchase(state, entry, items)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(state) // candies NOT deducted despite the first line being payable
  })

  it('respects the unlock gate', () => {
    const entry: ShopEntry = {
      ...spoonEntry,
      unlock: (s) => s.flags.metGrandma === true,
    }
    const locked = purchase(richState(), entry, items)
    expect(locked.ok).toBe(false)
    expect(locked.reason).toBe('locked')

    const unlocked = purchase(
      { ...richState(), flags: { metGrandma: true } },
      entry,
      items,
    )
    expect(unlocked.ok).toBe(true)
  })

  it('reports an unknown item id without touching state', () => {
    const entry: ShopEntry = { ...spoonEntry, itemId: 'ghost' }
    const state = richState()
    const result = purchase(state, entry, items)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unknownItem')
    expect(result.state).toBe(state)
  })

  it('does not mutate the input state on a successful purchase', () => {
    const state = richState()
    const before = state.candies.current
    purchase(state, spoonEntry, items)
    expect(state.candies.current).toBe(before)
    expect(state.flags.spoonOwned).toBeUndefined()
  })

  it('canPurchase mirrors affordability and the unlock gate', () => {
    expect(canPurchase(richState(), spoonEntry)).toBe(true)
    expect(canPurchase({ ...createDefaultSave(), candies: createResource(0) }, spoonEntry)).toBe(
      false,
    )
    const gated: ShopEntry = { ...spoonEntry, unlock: () => false }
    expect(canPurchase(richState(), gated)).toBe(false)
  })

  it('grantItem is immutable and equips by slot', () => {
    const state = createDefaultSave()
    const next = grantItem(state, spoon)
    expect(next).not.toBe(state)
    expect(state.equipped.weapon).toBeNull()
    expect(next.equipped.weapon).toBe('woodenSpoon')
  })
})

import { createDefaultSave } from '@/engine/state/defaultSave'
import { createResource } from '@/engine/types/Resource'
import { shopRows, visibleShopRows } from '@/engine/shop/shopView'
import { ITEM_MAP } from '@/content/items/items'
import { FORGE_ENTRIES } from '@/content/shops/forge'
import { grantItem } from '@/engine/shop/purchase'
import { WOODEN_SWORD } from '@/content/items/items'
import type { GameState } from '@/engine/types/GameState'

function withSpoon(over: Partial<GameState> = {}): GameState {
  const base = createDefaultSave()
  return { ...base, flags: { ...base.flags, spoonOwned: true }, ...over }
}

const row = (rows: ReturnType<typeof shopRows>, id: string) => rows.find((r) => r.item.id === id)!

describe('shopRows', () => {
  it('drops entries whose item is missing from the registry', () => {
    const rows = shopRows(createDefaultSave(), [{ itemId: 'ghost', price: [{ resource: 'candies', amount: 1 }], speechKey: 'x' }], ITEM_MAP)
    expect(rows).toHaveLength(0)
  })

  it('marks a row locked when its unlock gate is unmet', () => {
    // No spoon yet → the wooden sword (gated on spoonOwned) is locked.
    const rows = shopRows(createDefaultSave(), FORGE_ENTRIES, ITEM_MAP)
    expect(row(rows, 'woodenSword').locked).toBe(true)
  })

  it('marks a row unlocked + affordability once the gate is met', () => {
    const rows = shopRows(withSpoon({ candies: createResource(150) }), FORGE_ENTRIES, ITEM_MAP)
    const sword = row(rows, 'woodenSword') // 100 candies
    const whip = row(rows, 'licoriceWhip') // 200 candies
    expect(sword.locked).toBe(false)
    expect(sword.affordable).toBe(true)
    expect(whip.locked).toBe(false)
    expect(whip.affordable).toBe(false) // only 150 candies, the whip is 200
  })

  it('marks an owned item owned', () => {
    const owned = grantItem(withSpoon(), WOODEN_SWORD)
    expect(row(shopRows(owned, FORGE_ENTRIES, ITEM_MAP), 'woodenSword').owned).toBe(true)
  })

  it('treats a multi-resource price as affordable only when EVERY line is covered', () => {
    // The iron sword costs candies AND rock candy; plenty of candies but no rock candy → not affordable.
    const ready = withSpoon({ flags: { spoonOwned: true, woodenSwordOwned: true }, candies: createResource(5000) })
    expect(row(shopRows(ready, FORGE_ENTRIES, ITEM_MAP), 'ironSword').affordable).toBe(false)
  })
})

describe('visibleShopRows', () => {
  it('hides locked-and-unowned rows but shows unlocked ones', () => {
    const visible = visibleShopRows(withSpoon(), FORGE_ENTRIES, ITEM_MAP).map((r) => r.item.id)
    // spoon owned → sword/bow/whip visible; iron sword (needs wooden sword) + mace (needs rock candy) hidden.
    expect(visible).toContain('woodenSword')
    expect(visible).toContain('candyCaneBow')
    expect(visible).toContain('licoriceWhip')
    expect(visible).not.toContain('ironSword')
    expect(visible).not.toContain('jawbreakerMace')
  })

  it('keeps an owned row visible even if its gate would now hide it', () => {
    // Own the iron sword but (contrived) without the wooden-sword gate flag set.
    const owned = grantItem(createDefaultSave(), ITEM_MAP.get('ironSword')!)
    const visible = visibleShopRows(owned, FORGE_ENTRIES, ITEM_MAP).map((r) => r.item.id)
    expect(visible).toContain('ironSword')
  })
})

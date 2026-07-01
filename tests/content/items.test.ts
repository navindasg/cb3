import { createDefaultSave } from '@/engine/state/defaultSave'
import { grantItem } from '@/engine/shop/purchase'
import {
  ALL_ITEMS,
  ITEM_MAP,
  WOODEN_SPOON,
  MANTLE_SWORD,
  MANTLE_SWORD_UNLOCK_FLAG,
} from '@/content/items/items'

describe('Act 0 item registry', () => {
  it('every item is registered in the ITEM_MAP by id', () => {
    for (const item of ALL_ITEMS) expect(ITEM_MAP.get(item.id)).toBe(item)
  })

  it('item ids are unique', () => {
    const ids = ALL_ITEMS.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('the wooden spoon equips into the weapon slot when granted', () => {
    const after = grantItem(createDefaultSave(), WOODEN_SPOON)
    expect(after.equipped.weapon).toBe('woodenSpoon')
    expect(after.flags['spoonOwned']).toBe(true)
  })

  it('the mantle sword is foreshadowed and un-takeable on a fresh save (the attic secret unlocks it later)', () => {
    // On a fresh save nothing has set the unlock flag or granted the sword; the world gates it behind the
    // attic's wrapper (the old-days ×3 secret). Once that is done the render layer grants it (see the
    // mailbox test's end-to-end take-flow) — but until then it is only foreshadowed.
    const state = createDefaultSave()
    expect(state.flags[MANTLE_SWORD_UNLOCK_FLAG]).toBeUndefined()
    expect(state.ownedItems[MANTLE_SWORD.id]).toBeUndefined()
    // It exists in the registry (so it can be SHOWN on the mantle, and granted by the attic) but is owned
    // by nothing yet.
    expect(ITEM_MAP.get(MANTLE_SWORD.id)).toBe(MANTLE_SWORD)
  })
})

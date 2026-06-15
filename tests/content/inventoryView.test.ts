import { createDefaultSave } from '@/engine/state/defaultSave'
import { inventoryView, EQUIPMENT_SLOTS } from '@/content/items/inventoryView'
import type { GameState } from '@/engine/types/GameState'

function withGear(owned: string[], equippedWeapon: string | null): GameState {
  const s = createDefaultSave()
  return {
    ...s,
    ownedItems: Object.fromEntries(owned.map((id) => [id, true])),
    equipped: { ...s.equipped, weapon: equippedWeapon },
  }
}

describe('inventoryView', () => {
  it('groups owned items by slot and names the equipped weapon', () => {
    const view = inventoryView(withGear(['woodenSpoon', 'ironSword', 'telescope'], 'woodenSpoon'), 14)
    const weapon = view.slots.find((s) => s.slot === 'weapon')!
    expect(weapon.equippedId).toBe('woodenSpoon')
    expect(weapon.owned.map((i) => i.id).sort()).toEqual(['ironSword', 'woodenSpoon'])
    // The telescope has no slot → it lands in otherItems, not a slot list.
    expect(view.otherItems.map((i) => i.id)).toEqual(['telescope'])
    expect(view.slots.map((s) => s.slot)).toEqual(EQUIPMENT_SLOTS)
  })

  it('reports the equipped weapon stats and the supplied max HP', () => {
    const view = inventoryView(withGear(['woodenSpoon'], 'woodenSpoon'), 14)
    expect(view.stats.maxHp).toBe(14)
    expect(view.stats.weaponId).toBe('woodenSpoon')
    expect(view.stats.weaponDamage).toBe(2) // the spoon's damage
    expect(view.stats.weaponCooldownMs).toBe(500)
  })

  it('falls back to bare-hands stats when nothing is equipped', () => {
    const view = inventoryView(withGear([], null), 10)
    expect(view.stats.weaponId).toBe('bareHands')
    expect(view.stats.weaponDamage).toBe(1)
  })
})

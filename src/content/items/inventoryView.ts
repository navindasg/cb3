import type { GameState, EquipmentSlot } from '@/engine/types/GameState'
import type { ItemDef } from '@/engine/types/defs'
import { ALL_ITEMS, ITEM_MAP } from '@/content/items/items'
import { BARE_HANDS } from '@/content/items/playerLoadout'

// A pure projection of the player's owned/equipped gear for the inventory screen (CB2's
// Inventory.drawEquipment + drawStats, in CB3's data shape). Groups owned items by equipment
// slot, names what's equipped, lists owned non-equippable items, and resolves the player's
// combat stats (max HP, the equipped weapon's damage + attack speed). The render layer turns
// this into the inventory DOM; no engine logic here. maxHp is passed in (the engine owns its
// derivation) so content imports only types.

/** The five equipment slots, in display order. */
export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  'weapon',
  'hat',
  'armour',
  'gloves',
  'boots',
]

export interface SlotView {
  readonly slot: EquipmentSlot
  /** The currently-equipped item id, or null. */
  readonly equippedId: string | null
  /** Owned items that fit this slot (the equip choices). */
  readonly owned: readonly ItemDef[]
}

export interface InventoryStats {
  readonly maxHp: number
  readonly weaponDamage: number
  readonly weaponCooldownMs: number
  /** The equipped weapon's display id (or 'bareHands'), for the stat line. */
  readonly weaponId: string
}

export interface InventoryView {
  readonly slots: readonly SlotView[]
  /** Owned items with no equipment slot (telescope, grimoire, …). */
  readonly otherItems: readonly ItemDef[]
  readonly stats: InventoryStats
}

/** Project the inventory for `state` (maxHp supplied by the host's derived-cache reader). */
export function inventoryView(state: GameState, maxHp: number): InventoryView {
  const ownedDefs = ALL_ITEMS.filter((i) => state.ownedItems[i.id] === true)

  const slots: readonly SlotView[] = EQUIPMENT_SLOTS.map((slot) => ({
    slot,
    equippedId: state.equipped[slot],
    owned: ownedDefs.filter((i) => i.slot === slot),
  }))

  const otherItems = ownedDefs.filter((i) => i.slot === undefined)

  const weaponId = state.equipped.weapon
  const weaponItem = weaponId ? ITEM_MAP.get(weaponId) : undefined
  const w = weaponItem?.weapon ?? BARE_HANDS

  return {
    slots,
    otherItems,
    stats: {
      maxHp,
      weaponDamage: w.damage,
      weaponCooldownMs: w.cooldownMs,
      weaponId: weaponItem?.id ?? BARE_HANDS.id,
    },
  }
}

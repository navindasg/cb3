import type { ItemDef } from '@/engine/types/defs'

// Act 0 items as data (ADR §10 ItemDef). Content imports ONLY engine types. The wooden
// spoon is grandma's heirloom gift (a weapon). The forge sells weapon upgrades. The
// observatory sells the grimoire and the telescope. The mantle sword is the un-takeable
// foreshadow piece — present in the world, owned by no shop, granted by no flag yet.

export const WOODEN_SPOON: ItemDef = {
  id: 'woodenSpoon',
  displayKey: 'item.woodenSpoon.name',
  descKey: 'item.woodenSpoon.desc',
  ascii: '\\_',
  saveFlag: 'spoonOwned',
  slot: 'weapon',
  // Long reach (it out-pokes a gummy bite) but a gentle, slow swat — grandma's, after all.
  weapon: { damage: 2, range: 2, cooldownMs: 500 },
}

export const WOODEN_SWORD: ItemDef = {
  id: 'woodenSword',
  displayKey: 'item.woodenSword.name',
  descKey: 'item.woodenSword.desc',
  ascii: '+-',
  saveFlag: 'woodenSwordOwned',
  slot: 'weapon',
  weapon: { damage: 3, range: 2, cooldownMs: 450 },
}

export const IRON_SWORD: ItemDef = {
  id: 'ironSword',
  displayKey: 'item.ironSword.name',
  descKey: 'item.ironSword.desc',
  ascii: '+=',
  saveFlag: 'ironSwordOwned',
  slot: 'weapon',
  weapon: { damage: 5, range: 2, cooldownMs: 400 },
}

export const LEATHER_HAT: ItemDef = {
  id: 'leatherHat',
  displayKey: 'item.leatherHat.name',
  descKey: 'item.leatherHat.desc',
  ascii: '^',
  saveFlag: 'leatherHatOwned',
  slot: 'hat',
}

export const BEGINNER_GRIMOIRE: ItemDef = {
  id: 'beginnerGrimoire',
  displayKey: 'item.beginnerGrimoire.name',
  descKey: 'item.beginnerGrimoire.desc',
  ascii: '[]',
  saveFlag: 'beginnerGrimoireOwned',
}

export const TELESCOPE: ItemDef = {
  id: 'telescope',
  displayKey: 'item.telescope.name',
  descKey: 'item.telescope.desc',
  ascii: 'o-',
  saveFlag: 'telescopeOwned',
}

/** The heirloom sword on grandma's mantle — foreshadowed, NOT yet takeable (no saveFlag grant). */
export const MANTLE_SWORD: ItemDef = {
  id: 'mantleSword',
  displayKey: 'item.mantleSword.name',
  descKey: 'item.mantleSword.desc',
  ascii: '|>',
  saveFlag: 'mantleSwordTaken', // gated forever in Phase 1; the foreshadow flag below blocks it
  slot: 'weapon',
}

/** Flag the world checks before letting the mantle sword be taken (never set in Act 0). */
export const MANTLE_SWORD_UNLOCK_FLAG = 'mantleSwordUnlocked'

export const ALL_ITEMS: readonly ItemDef[] = [
  WOODEN_SPOON,
  WOODEN_SWORD,
  IRON_SWORD,
  LEATHER_HAT,
  BEGINNER_GRIMOIRE,
  TELESCOPE,
  MANTLE_SWORD,
]

/** The item registry the generic purchase handler consumes. */
export const ITEM_MAP: ReadonlyMap<string, ItemDef> = new Map(ALL_ITEMS.map((i) => [i.id, i]))

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

// The forge mix is deliberately NOT a sword ladder (design directive: "mix it up, surprise me;
// a bow to get used to ranged before space"). Each weapon is a distinct archetype the combat
// engine actually rewards — combat.ts honours per-weapon `range`, so the bow plinks from afar
// while the mace trades reach for a brutal, slow swing.

/** Ranged: long reach, low per-hit, slow draw. Foreshadows the space-tech ranged weapons. */
export const CANDY_CANE_BOW: ItemDef = {
  id: 'candyCaneBow',
  displayKey: 'item.candyCaneBow.name',
  descKey: 'item.candyCaneBow.desc',
  ascii: '})',
  saveFlag: 'candyCaneBowOwned',
  slot: 'weapon',
  weapon: { damage: 2, range: 5, cooldownMs: 900 },
}

/** Fast + reachy: a flurry of low hits at medium range. Tensile licorice (see §4 flavor rules). */
export const LICORICE_WHIP: ItemDef = {
  id: 'licoriceWhip',
  displayKey: 'item.licoriceWhip.name',
  descKey: 'item.licoriceWhip.desc',
  ascii: '~/',
  saveFlag: 'licoriceWhipOwned',
  slot: 'weapon',
  weapon: { damage: 3, range: 3, cooldownMs: 350 },
}

/** Heavy: a giant jawbreaker on a haft. Short reach, slow, but it hits like a falling moon. */
export const JAWBREAKER_MACE: ItemDef = {
  id: 'jawbreakerMace',
  displayKey: 'item.jawbreakerMace.name',
  descKey: 'item.jawbreakerMace.desc',
  ascii: 'O>',
  saveFlag: 'jawbreakerMaceOwned',
  slot: 'weapon',
  weapon: { damage: 8, range: 1.5, cooldownMs: 850 },
}

export const LEATHER_HAT: ItemDef = {
  id: 'leatherHat',
  displayKey: 'item.leatherHat.name',
  descKey: 'item.leatherHat.desc',
  ascii: '^',
  saveFlag: 'leatherHatOwned',
  slot: 'hat',
}

/** The fishbowl helm (Act 1 capstone, DESIGN §171/§233) — first vacuum gear, hammered onto a gorget
 * by the proud blacksmith once you can navigate. A hat-slot piece (auto-equips, over the leather
 * hat); airtight, but its protection only matters once you're breathing vacuum in Act 2. Forging it
 * closes the Act-1 gate (its forge entry is gated on celestial navigation). The Konami goldfish
 * (§317) is deferred until that secret exists. */
export const FISHBOWL_HELM: ItemDef = {
  id: 'fishbowlHelm',
  displayKey: 'item.fishbowlHelm.name',
  descKey: 'item.fishbowlHelm.desc',
  ascii: '()',
  saveFlag: 'fishbowlHelmForged',
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

// --- the storm front drops (Act 1, the thunderhead djinn) ---
// Both are won by clearing the storm front. The bottled tempest's active "summon a storm once per
// fight" use (DESIGN §10) is deferred — held as an owned keepsake for now. Storm-silk is sail tier
// 2 (DESIGN §13), banked for a galleon that does not exist until Act 2.

/** The thunderhead djinn's signature drop — a storm in a bottle (active use lands later). */
export const BOTTLED_TEMPEST: ItemDef = {
  id: 'bottledTempest',
  displayKey: 'item.bottledTempest.name',
  descKey: 'item.bottledTempest.desc',
  ascii: '~o',
  saveFlag: 'bottledTempestOwned',
}

/** Storm-silk — tier-2 sail cloth, banked until there is a ship to rig it to. */
export const STORM_SILK: ItemDef = {
  id: 'stormSilk',
  displayKey: 'item.stormSilk.name',
  descKey: 'item.stormSilk.desc',
  ascii: '%/',
  saveFlag: 'stormSilkOwned',
}

/** The worm mold (Act 1, the moon-worm drop) — a worm-shaped cast prised from the colossal one.
 * Not equippable; while owned it grants the strata-mining yield boost (engine/content/moonStrata
 * reads its saveFlag). The gummy-army system that grows units from molds lands in a later increment
 * (DESIGN §12); this banks the first mold and makes its "burrower, mining boost" tangible now. */
export const WORM_MOLD: ItemDef = {
  id: 'wormMold',
  displayKey: 'item.wormMold.name',
  descKey: 'item.wormMold.desc',
  ascii: '[w',
  saveFlag: 'wormMoldOwned',
}

/** The shed shell (Act 1, the hollow-core keepsake) — a curl of warm, translucent shell prised from
 * the moon's empty heart (DESIGN §15.2: something hatched here and left). Not equippable; held as a
 * quiet keepsake. Its system (the molds / gummy-army, §12) lands in a later increment, like the
 * storm-front keepsakes — the lore beat is the point, and the game says nothing. */
export const SHED_SHELL: ItemDef = {
  id: 'shedShell',
  displayKey: 'item.shedShell.name',
  descKey: 'item.shedShell.desc',
  ascii: '(C',
  saveFlag: 'shedShellOwned',
}

/** The brass sextant (Act 1, the lunar-lighthouse keepsake) — the cyclops's parting gift once you
 * can read a course in the stars (DESIGN §167). Not equippable; held as proof of the lesson. Its
 * use — pointing the candied galleon — lands in Act 2, like the storm-front / shed-shell keepsakes;
 * owning it marks celestial navigation as learned for the Act gate. */
export const BRASS_SEXTANT: ItemDef = {
  id: 'brassSextant',
  displayKey: 'item.brassSextant.name',
  descKey: 'item.brassSextant.desc',
  ascii: '</',
  saveFlag: 'brassSextantOwned',
}

/** The cotton-candy balloon (Act 1) — built in the cumulus commons, it carries you to the moon.
 * Not equippable; owning it (the saveFlag) reveals the jawbreaker moon on the overworld. */
export const COTTON_CANDY_BALLOON: ItemDef = {
  id: 'cottonCandyBalloon',
  displayKey: 'item.cottonCandyBalloon.name',
  descKey: 'item.cottonCandyBalloon.desc',
  ascii: 'OO',
  saveFlag: 'balloonBuilt',
}

/** The heirloom sword on grandma's mantle — foreshadowed, NOT yet takeable (no saveFlag grant). */
export const MANTLE_SWORD: ItemDef = {
  id: 'mantleSword',
  displayKey: 'item.mantleSword.name',
  descKey: 'item.mantleSword.desc',
  ascii: '|>',
  saveFlag: 'mantleSwordTaken', // gated forever in Phase 1; the foreshadow flag below blocks it
  slot: 'weapon',
  // Hero-tier stats so it is internally consistent the day it becomes takeable. Never reachable
  // in Act 0 (no flow sets mantleSwordTaken), so these numbers affect no Act-0 balance.
  weapon: { damage: 12, range: 2.5, cooldownMs: 300 },
}

/** Flag the world checks before letting the mantle sword be taken (never set in Act 0). */
export const MANTLE_SWORD_UNLOCK_FLAG = 'mantleSwordUnlocked'

export const ALL_ITEMS: readonly ItemDef[] = [
  WOODEN_SPOON,
  WOODEN_SWORD,
  IRON_SWORD,
  CANDY_CANE_BOW,
  LICORICE_WHIP,
  JAWBREAKER_MACE,
  LEATHER_HAT,
  BEGINNER_GRIMOIRE,
  TELESCOPE,
  BOTTLED_TEMPEST,
  STORM_SILK,
  FISHBOWL_HELM,
  WORM_MOLD,
  SHED_SHELL,
  BRASS_SEXTANT,
  COTTON_CANDY_BALLOON,
  MANTLE_SWORD,
]

/** The item registry the generic purchase handler consumes. */
export const ITEM_MAP: ReadonlyMap<string, ItemDef> = new Map(ALL_ITEMS.map((i) => [i.id, i]))

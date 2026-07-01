import type { ItemDef } from '@/engine/types/defs'
import { SCHOLARS_PAMPHLET } from '@/content/typedSecrets'
import { POGO_STICK, OLD_MAP_FRAGMENT, WRAPPER } from '@/content/letters'

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

/** The pop rock pike (Act 2 — forged from the comet's pop rocks, DESIGN §175). A DISTINCT archetype again:
 * the LONGEST melee reach in the arsenal (range 4 — only the ranged bow out-reaches it), a slow, heavy
 * thrust. It trades the mace's raw punch for reach and the bow's ranged safety for solid melee bite — a
 * positioning weapon, deadly at the rail (it shines against the sour kraken's reaching arms). Its damage is
 * held at the iron sword's (5): a heavier hit would let pure aggression brute past the boarding melee that
 * is tuned to demand the read (see the boarding balance test), so the pike's premium is REACH, not power.
 * DEFERRED (DESIGN §228): the pike's "explosive crits" flavor awaits a crit system; this slice ships the reach
 * archetype, and the desc's "crackles the whole way in" only gestures at the explosive idea for now. */
export const POP_ROCK_PIKE: ItemDef = {
  id: 'popRockPike',
  displayKey: 'item.popRockPike.name',
  descKey: 'item.popRockPike.desc',
  ascii: '=>',
  saveFlag: 'popRockPikeOwned',
  slot: 'weapon',
  weapon: { damage: 5, range: 4, cooldownMs: 750 },
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

/** The wolf-wool cloak (Phase 5 — the cloud wolf's drop, hidden boss 1, DESIGN §17). Shorn from the thing
 * that was never a sheep: a cloak of thunderhead-grey wool that the storm's charge simply cannot find. The
 * game's first ARMOUR-slot piece (the slot existed, unused, until now — it auto-equips there). Its saveFlag
 * doubles as the storm-immunity flag the storm front reads (content/flags.STORM_IMMUNE_FLAG === this saveFlag):
 * worn, the thunderhead can't touch you — a LATE reward that retroactively trivializes an early climb, the
 * curiosity payoff. Never a gate; the storm was always beatable without it. */
export const WOLF_WOOL_CLOAK: ItemDef = {
  id: 'wolfWoolCloak',
  displayKey: 'item.wolfWoolCloak.name',
  descKey: 'item.wolfWoolCloak.desc',
  ascii: '}{',
  saveFlag: 'wolfWoolCloakOwned',
  slot: 'armour',
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

/** The acorn of knowledge (Act 2, the space squirrel's reward at the rock candy reef, DESIGN §178).
 * A keepsake won by answering the squirrel's riddles. Its design role — revealing secret hints on the
 * overworld map — lands in a later slice (the map-hint system does not exist yet), like the storm /
 * shed-shell / sextant keepsakes before it; owning it marks the squirrel's riddles solved. */
export const ACORN_OF_KNOWLEDGE: ItemDef = {
  id: 'acornOfKnowledge',
  displayKey: 'item.acornOfKnowledge.name',
  descKey: 'item.acornOfKnowledge.desc',
  ascii: '(o',
  saveFlag: 'acornOfKnowledgeOwned',
}

/** The kraken crown (Act 2, the sour kraken's drop, DESIGN §10/§235) — a coral-and-rock-candy circlet
 * prised from the beast's brow, an homage to CB2's octopus king. A hat-slot piece (auto-equips, over the
 * fishbowl helm — you can re-don the helm at your inventory). Its TWO enchantments (§235) are deferred: no
 * enchant system exists yet, so it is held as a trophy, like the acorn / sextant / storm-silk keepsakes. */
export const KRAKEN_CROWN: ItemDef = {
  id: 'krakenCrown',
  displayKey: 'item.krakenCrown.name',
  descKey: 'item.krakenCrown.desc',
  ascii: 'mm',
  saveFlag: 'krakenCrownOwned',
  slot: 'hat',
}

/** Captain Sourbeard's tricorn (Act 2, the boarding-melee drop, DESIGN §179/§235) — swept off his head
 * when you finally best him on the deck. A hat-slot piece (auto-equips). Its +crew morale (§272) is
 * deferred — no crew system yet — so it is worn as a trophy, like the kraken crown. */
export const SOURBEARD_TRICORN: ItemDef = {
  id: 'sourbeardTricorn',
  displayKey: 'item.sourbeardTricorn.name',
  descKey: 'item.sourbeardTricorn.desc',
  ascii: 'mP',
  saveFlag: 'sourbeardTricornOwned',
  slot: 'hat',
}

/** The gummy parrot (Act 2, pickpocketed off Sourbeard as he is dragged away, DESIGN §179 / secret §18.10)
 * — it defects to you without much ceremony. Not equippable; held as a keepsake (its +crew morale, §272,
 * lands with the crew system; for now it just vibes). */
export const GUMMY_PARROT: ItemDef = {
  id: 'gummyParrot',
  displayKey: 'item.gummyParrot.name',
  descKey: 'item.gummyParrot.desc',
  ascii: '~q',
  saveFlag: 'gummyParrotOwned',
}

/** The peppermint bathysphere (Act 3, the descent-port craft, DESIGN §5/§190/§196) — a mint-cold,
 * peppermint-armored vessel sealed with caramel, built to ride the dyson scaffold DOWN into the sun. Not
 * equippable; held as the Act-4 descent vehicle (the §194 audio cue is the Act-4 payoff, not fired here).
 * Its saveFlag is the BATHYSPHERE_BUILT_FLAG that, with dysonStage5Done, derives act3GateCleared. */
export const PEPPERMINT_BATHYSPHERE: ItemDef = {
  id: 'peppermintBathysphere',
  displayKey: 'item.peppermintBathysphere.name',
  descKey: 'item.peppermintBathysphere.desc',
  ascii: '(o)',
  saveFlag: 'bathysphereBuilt',
}

/** The secret aniwey-smiley figurehead (Phase 5 — name the galleon 'Candy Box', DESIGN §18) — the quiet
 * homage to Candy Box's author: a tiny carved smiley bolted to her bow, revealed only if you name her after
 * the game she descends from. Not equippable and purely cosmetic (CB2-tradition flavor, no stat); owning it
 * (the flag, engine/content/interactionBonuses.figureheadOwned) draws the smiley on the ship's dock art. */
export const CANDY_BOX_FIGUREHEAD: ItemDef = {
  id: 'candyBoxFigurehead',
  displayKey: 'item.candyBoxFigurehead.name',
  descKey: 'item.candyBoxFigurehead.desc',
  ascii: ':)',
  saveFlag: 'candyBoxFigureheadOwned',
}

/** The sugar-glass shard (Phase 5 — the mirror-potion ingredient, hidden boss 2, DESIGN §17/§18). A cheap chip
 * of clear sugar-glass — an offcut from the astronomer's lens-grinding, sold at the observatory for a song. Not
 * equippable; a keepsake item-flag, not a resource. CONSUMED when the mirror potion is brewed (its owned flag is
 * cleared), so it is a one-shot reagent you re-buy if you want to face your reflection again. */
export const SUGAR_GLASS_SHARD: ItemDef = {
  id: 'sugarGlassShard',
  displayKey: 'item.sugarGlassShard.name',
  descKey: 'item.sugarGlassShard.desc',
  ascii: '<>',
  saveFlag: 'sugarGlassShardOwned',
}

/** The mirror potion (Phase 5 — hidden boss 2, the X-potion homage, DESIGN §17/§18). Brewed cold at the cauldron
 * from a sugar-glass shard, a chocolate, and exactly one candy (engine/content/reflectionFight.brewMirrorPotion).
 * Not equippable; an in-hand draught (an item-flag). DRINKING it (drinkMirrorPotion clears the flag) summons your
 * reflection — a turn-based fight against your exact current build. A lost fight costs the draught, not the pin. */
export const MIRROR_POTION: ItemDef = {
  id: 'mirrorPotion',
  displayKey: 'item.mirrorPotion.name',
  descKey: 'item.mirrorPotion.desc',
  ascii: '~O',
  saveFlag: 'mirrorPotionOwned',
}

/** The paradox pin (Phase 5 — your reflection's drop, hidden boss 2, DESIGN §17/§18). A small pin of two mirrors
 * facing each other, won off the thing that was you. Not equippable itself; a keepsake whose owned flag CHANGES
 * AN EQUIP RULE — with it pinned you may wear TWO hats at once (engine/content/reflectionFight.maxHats /
 * equipSecondHat), which the game does not otherwise permit. Deadpan: the reward is not a stat, it is a loophole. */
export const PARADOX_PIN: ItemDef = {
  id: 'paradoxPin',
  displayKey: 'item.paradoxPin.name',
  descKey: 'item.paradoxPin.desc',
  ascii: '8o',
  saveFlag: 'paradoxPinOwned',
}

/** The fourth-wall fragment (Phase 5 — the hallucination's drop, hidden boss 3, DESIGN §17/§18/§28). A shard of
 * the thing's counterfeit interface, prised loose when it came apart: a chip of not-quite-glass that still, faintly,
 * draws a small button no bigger than a fingernail — a button that does nothing, that was never real, that you
 * cannot stop yourself from pressing. Not equippable; a keepsake item-flag. Its "one real secret per day" effect
 * (DESIGN §18 — the fragment quietly points you at a genuine hidden thing you have not found) is DEFERRED: no such
 * system exists yet, so for now it banks as a trophy, like the acorn / kraken crown. Won by out-reading the fight's
 * lies — you kept your head when the UI was lying to your face, and the fragment is the proof. */
export const FOURTH_WALL_FRAGMENT: ItemDef = {
  id: 'fourthWallFragment',
  displayKey: 'item.fourthWallFragment.name',
  descKey: 'item.fourthWallFragment.desc',
  ascii: '][',
  saveFlag: 'fourthWallFragmentOwned',
}

/** The heirloom sword on grandma's mantle — taken down at last once the attic's wrapper unlocks it
 * (§231/§288). Its saveFlag `mantleSwordTaken` is set by the attic grant (openAttic grants it alongside
 * the wrapper); owning it auto-equips the weapon slot, activating the lifetime-candy scaling (see
 * playerLoadout.mantleSwordDamage) — the "wrapper still scales" design intent, never stated.
 *
 * BALANCE HOLD (the pop-rock-pike precedent, DESIGN §5 + the boarding/star-eater grid-search contracts):
 * the four DISCRETE telegraph fights (boarding melee, star-eater on-foot/core, the sour kraken) are tuned
 * so all-lunge/all-strike LOSES for every forged blade at damage <= 5, strikes 1. This hero sword's raw
 * weight (and its scaling) would let pure aggression brute past that read, so its cooldown is held at 400
 * (strikes 1, NOT a double-strike) and playerLoadout caps its damage to the iron sword's (5) inside those
 * discrete fights (meleeWeapon). Its full damage + scaling only bites in open REAL-TIME quest combat — the
 * hero sword rewards eating, but the disciplined duels still demand the read. Grid-search-locked (see the
 * boarding/star-eater balance tests, which include the mantle sword in the all-lunge-loses lists). */
export const MANTLE_SWORD: ItemDef = {
  id: 'mantleSword',
  displayKey: 'item.mantleSword.name',
  descKey: 'item.mantleSword.desc',
  ascii: '|>',
  saveFlag: 'mantleSwordTaken', // set by the attic grant (openAttic) once the wrapper unlocks it
  slot: 'weapon',
  weapon: { damage: 12, range: 2.5, cooldownMs: 400 },
}

/** Flag the world checks before letting the mantle sword be taken (set by the wrapper's grant). */
export const MANTLE_SWORD_UNLOCK_FLAG = 'mantleSwordUnlocked'

export const ALL_ITEMS: readonly ItemDef[] = [
  WOODEN_SPOON,
  WOODEN_SWORD,
  IRON_SWORD,
  CANDY_CANE_BOW,
  LICORICE_WHIP,
  JAWBREAKER_MACE,
  POP_ROCK_PIKE,
  LEATHER_HAT,
  BEGINNER_GRIMOIRE,
  TELESCOPE,
  BOTTLED_TEMPEST,
  STORM_SILK,
  WOLF_WOOL_CLOAK,
  FISHBOWL_HELM,
  WORM_MOLD,
  SHED_SHELL,
  BRASS_SEXTANT,
  ACORN_OF_KNOWLEDGE,
  KRAKEN_CROWN,
  SOURBEARD_TRICORN,
  GUMMY_PARROT,
  PEPPERMINT_BATHYSPHERE,
  COTTON_CANDY_BALLOON,
  CANDY_BOX_FIGUREHEAD,
  SUGAR_GLASS_SHARD,
  MIRROR_POTION,
  PARADOX_PIN,
  FOURTH_WALL_FRAGMENT,
  MANTLE_SWORD,
  // The scholar's pamphlet lives with its typed secret (content/typedSecrets), but joins the registry
  // here so the secret runner's grantItem can resolve it via ITEM_MAP.
  SCHOLARS_PAMPHLET,
  // The attic keepsakes (Phase 5 — grandma's old-days ×3 secret; content/letters) join the registry so
  // the mailbox engine's openAttic can grant them via grantItem/ITEM_MAP. The wrapper's saveFlag IS the
  // mantle-sword unlock flag (grandma's blessing to take the sword down).
  POGO_STICK,
  OLD_MAP_FRAGMENT,
  WRAPPER,
]

/** The item registry the generic purchase handler consumes. */
export const ITEM_MAP: ReadonlyMap<string, ItemDef> = new Map(ALL_ITEMS.map((i) => [i.id, i]))

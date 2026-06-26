// The full typed GameText interface (resolved decision 7). Every UI string the game can show
// is a named key here; a locale module (`en.ts`) declares `const en: GameText = {…}`, so a
// MISSING key is a COMPILE ERROR (and a stray key is too). Phase 1 ships en.ts only; other
// locales are deferred. Content references these keys as `string` def fields; the engine
// resolves them through a locale at render time. No logic here — a flat record of literals.

export interface GameText {
  // --- items: name + description ---
  'item.woodenSpoon.name': string
  'item.woodenSpoon.desc': string
  'item.woodenSword.name': string
  'item.woodenSword.desc': string
  'item.ironSword.name': string
  'item.ironSword.desc': string
  'item.candyCaneBow.name': string
  'item.candyCaneBow.desc': string
  'item.licoriceWhip.name': string
  'item.licoriceWhip.desc': string
  'item.jawbreakerMace.name': string
  'item.jawbreakerMace.desc': string
  'item.leatherHat.name': string
  'item.leatherHat.desc': string
  'item.fishbowlHelm.name': string
  'item.fishbowlHelm.desc': string
  'item.beginnerGrimoire.name': string
  'item.beginnerGrimoire.desc': string
  'item.telescope.name': string
  'item.telescope.desc': string
  'item.bottledTempest.name': string
  'item.bottledTempest.desc': string
  'item.stormSilk.name': string
  'item.stormSilk.desc': string
  'item.cottonCandyBalloon.name': string
  'item.cottonCandyBalloon.desc': string
  'item.wormMold.name': string
  'item.wormMold.desc': string
  'item.shedShell.name': string
  'item.shedShell.desc': string
  'item.brassSextant.name': string
  'item.brassSextant.desc': string
  'item.acornOfKnowledge.name': string
  'item.acornOfKnowledge.desc': string
  'item.krakenCrown.name': string
  'item.krakenCrown.desc': string
  'item.mantleSword.name': string
  'item.mantleSword.desc': string

  // --- shop / forge / observatory merchant lines ---
  'shop.leatherHat.thanks': string
  'shop.beginnerGrimoire.thanks': string
  'forge.woodenSword.thanks': string
  'forge.ironSword.thanks': string
  'forge.candyCaneBow.thanks': string
  'forge.licoriceWhip.thanks': string
  'forge.jawbreakerMace.thanks': string
  'forge.fishbowlHelm.thanks': string
  'obs.beginnerGrimoire.thanks': string
  'obs.telescope.thanks': string

  // --- speakers ---
  'speaker.grandma': string
  'speaker.astronomer': string

  // --- grandma dialogue ---
  'dialogue.grandma.intro1': string
  'dialogue.grandma.intro2': string
  'dialogue.grandma.spoonGift': string
  'dialogue.grandma.mantle1': string
  'dialogue.grandma.mantle2': string

  // --- astronomer dialogue ---
  'dialogue.astronomer.pitch1': string
  'dialogue.astronomer.pitch2': string
  'dialogue.astronomer.stars1': string
  'dialogue.astronomer.stars2': string
  'dialogue.astronomer.seed1': string
  'dialogue.astronomer.seed2': string
  'dialogue.astronomer.seed3': string

  // --- recipes ---
  'recipe.syrupOfHealth.name': string
  'recipe.fizzyLiftingSoda.name': string

  // --- spells ---
  'spell.sugarBolt.name': string
  'spell.sweetWard.name': string

  // --- secrets (deadpan reveal lines) ---
  'secret.fossilTwitch.reveal': string
  'secret.wellInterest.reveal': string
  'secret.singleLollipopLeaf.reveal': string

  // --- tavern rumors (hints) ---
  'rumor.mines': string
  'rumor.fossil': string
  'rumor.telescope': string
  'rumor.well': string
  'rumor.stormFront': string
  'rumor.fizzyLiftingSoda': string
  'rumor.beanstalkCuttings': string
  'rumor.moonWorm': string
  'rumor.lighthouse': string
  'rumor.fishbowlHelm': string

  // --- death messages ---
  'death.candyBat': string
  'death.sugarGolem': string
  'death.gummyWorm': string
  'death.gummySlime': string
  'death.gummyBear': string
  'death.gummyAphid': string
  'death.cloudRat': string
  'death.mineSentinel': string
  'death.rockImp': string
  'death.stormSprite': string
  'death.thunderheadDjinn': string
  'death.moonWorm': string
  'death.fall': string
  'death.generic': string

  // --- zones (map labels' display names) ---
  'zone.house': string
  'zone.field': string
  'zone.minesEntrance': string
  'zone.fossilChamber': string
  'zone.shop': string
  'zone.forge': string
  'zone.tavern': string
  'zone.houses': string
  'zone.well': string
  'zone.observatory': string
  'zone.cauldron': string
  'zone.beanstalkGarden': string
  'zone.beanstalkClimb': string
  'zone.beanstalkElevator': string

  // --- progressive-reveal action buttons (the field opener) ---
  'action.eat': string
  'action.throw': string
  'action.enterHouse': string
  'action.openMap': string
  'action.inventory': string
  'action.backToField': string
  'action.backToHouse': string
  'action.scanSky': string

  // --- progressive GUI unlock ("request a feature") ---
  'gui.request.statusBar': string
  'gui.request.healthBar': string
  'gui.request.map': string
  'gui.comment.statusBar': string
  'gui.comment.healthBar': string
  'gui.comment.map': string

  // --- the seed pivot + beanstalk (Block G) ---
  'beanstalk.seedLands': string
  'beanstalk.seedAppears': string
  'beanstalk.feedProgress': string
  'beanstalk.reachedClouds': string
  'beanstalk.elevatorReady': string
  'beanstalk.thickened': string

  // --- the balloon (Act 1) ---
  'balloon.built': string

  // --- the jawbreaker moon: strata + picks (Act 1) ---
  'moon.stratum.sugarCrust': string
  'moon.stratum.cobaltCandy': string
  'moon.stratum.jawbreakerCore': string
  'moon.pick.candyPick': string
  'moon.pick.ironPick': string
  'moon.pick.rockCandyDrill': string

  // --- misc UI flavor ---
  'ui.starCounter': string
  'ui.candyCounter': string
}

/** A valid GameText key (used by the locale lookup). */
export type GameTextKey = keyof GameText

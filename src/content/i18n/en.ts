import type { GameText, GameTextKey } from '@/content/i18n/schema'

// The English locale (resolved decision 7 — Phase 1 ships en.ts only). Declaring `en: GameText`
// makes any MISSING key a compile error and any stray key a compile error too: the schema and
// the strings can never silently drift. The deadpan CB-series voice lives here.

export const en: GameText = {
  // items
  'item.woodenSpoon.name': 'wooden spoon',
  'item.woodenSpoon.desc': "Grandma's. It has stirred more soup than you have eaten candy.",
  'item.woodenSword.name': 'wooden sword',
  'item.woodenSword.desc': 'A sword. Of wood. It is, technically, an upgrade.',
  'item.ironSword.name': 'iron sword',
  'item.ironSword.desc': 'Now we are talking. Heavy, sharp, faintly sweet-smelling.',
  'item.leatherHat.name': 'leather hat',
  'item.leatherHat.desc': 'Keeps the sun off. Keeps very little else off.',
  'item.beginnerGrimoire.name': "beginner's grimoire",
  'item.beginnerGrimoire.desc': 'Two spells and a great many warnings about candy.',
  'item.telescope.name': 'telescope',
  'item.telescope.desc': 'For looking up. You will look up a great deal now.',
  'item.mantleSword.name': 'the heirloom sword',
  'item.mantleSword.desc': "It hangs over Grandma's mantle. Not yet. Not yet.",

  // merchant lines
  'shop.leatherHat.thanks': 'A fine choice. Mind the sun.',
  'shop.beginnerGrimoire.thanks': 'Back-room stock. Do not set anything on fire.',
  'forge.woodenSword.thanks': 'It is a sword. Mostly.',
  'forge.ironSword.thanks': 'The rock candy gives it the edge. Literally.',
  'obs.beginnerGrimoire.thanks': 'Magic is mostly reading. Here is the reading.',
  'obs.telescope.thanks': 'There. Now you can see them all. All eight thousand of them.',

  // speakers
  'speaker.grandma': 'Grandma',
  'speaker.astronomer': 'The Astronomer',

  // grandma dialogue
  'dialogue.grandma.intro1': 'There you are, dear. You look hungry.',
  'dialogue.grandma.intro2': 'Take this. You will want something to stir with.',
  'dialogue.grandma.spoonGift': 'She presses a wooden spoon into your hands.',
  'dialogue.grandma.mantle1': 'Do not touch the sword over the mantle.',
  'dialogue.grandma.mantle2': 'Not yet. You are not ready, and neither is it.',

  // astronomer dialogue
  'dialogue.astronomer.pitch1': 'Magic? Bah. The stars, child — buy the telescope.',
  'dialogue.astronomer.pitch2': 'And take the grimoire too, if you must dabble.',
  'dialogue.astronomer.stars1': 'Eight thousand one hundred and twenty-eight. A perfect number.',
  'dialogue.astronomer.stars2': 'They will be there forever. Of course they will.',
  'dialogue.astronomer.seed1': 'A meteorite! Iron-nickel, certainly. I shall write a paper.',
  'dialogue.astronomer.seed2': 'That object in the crater? Volcanic glass. Or an egg. Definitely not a seed.',
  'dialogue.astronomer.seed3': 'Whatever you do, do not plant it. There is no possible reason to plant it.',

  // recipes
  'recipe.syrupOfHealth.name': 'syrup of health',

  // spells
  'spell.sugarBolt.name': 'sugar bolt',
  'spell.sweetWard.name': 'sweet ward',

  // secrets
  'secret.fossilTwitch.reveal': 'The fossil twitches. Just once. You decide not to mention it.',
  'secret.wellInterest.reveal': 'A candy comes back up. With interest, somehow.',
  'secret.singleLollipopLeaf.reveal': 'The great leaf unfurls into a hammock. You rest.',

  // rumors
  'rumor.mines': 'They say the mines below the field go down a very long way.',
  'rumor.fossil': 'Old-timers feed the fossil exactly one candy. No more. No less.',
  'rumor.telescope': 'The astronomer counts the stars. He never says the count out loud.',
  'rumor.well': 'Throw a candy in the well, they say. See what comes back.',

  // death messages
  'death.candyBat': 'A candy bat drank you dry. You wake at the last safe ledge.',
  'death.sugarGolem': 'The sugar golem flattened you. Sweetly. You respawn.',
  'death.gummyWorm': 'A gummy worm got you. Embarrassing. You respawn.',
  'death.gummyAphid': 'A gummy aphid prised you off the stalk. You slide to the last leaf.',
  'death.cloudRat': 'A cloud rat ran you off the edge. You wake on a lower leaf.',
  'death.fall': 'You lost your grip. The garden floor is, at least, soft. You climb again.',
  'death.generic': 'You died. You feel fine about it. You respawn.',

  // zones
  'zone.house': 'your house',
  'zone.field': 'your field',
  'zone.minesEntrance': 'the mine entrance',
  'zone.fossilChamber': 'the fossil chamber',
  'zone.shop': 'the shop',
  'zone.forge': 'the forge',
  'zone.tavern': 'the tavern',
  'zone.houses': 'the houses',
  'zone.well': 'the well',
  'zone.observatory': 'the observatory',
  'zone.cauldron': 'the cauldron',
  'zone.beanstalkGarden': 'the beanstalk garden',
  'zone.beanstalkClimb': 'the beanstalk',
  'zone.beanstalkElevator': 'the beanstalk elevator',

  // progressive-reveal actions
  'action.eat': 'eat candies',
  'action.throw': 'throw 10 candies',
  'action.enterHouse': 'enter your house',
  'action.openMap': 'the map',
  'action.backToField': 'back to the field',
  'action.backToHouse': 'back outside',
  'action.scanSky': 'scan the sky',

  // progressive GUI unlock ("request a feature")
  'gui.request.statusBar': 'request a status bar',
  'gui.request.healthBar': 'request a health bar',
  'gui.request.map': 'request a map',
  'gui.comment.statusBar': 'They gave you a status bar. It sits at the top and keeps count.',
  'gui.comment.healthBar': 'They added a health bar. Useful, if anything ever hits you.',
  'gui.comment.map': 'They drew you a map. The world, it turns out, is bigger than the field.',

  // the seed pivot + beanstalk
  'beanstalk.seedLands': 'A star falls. It lands in your field with a sound like a dropped plum.',
  'beanstalk.seedAppears': 'In the crater, where the star was, there is a seed. Just a seed.',
  'beanstalk.feedProgress': 'You feed the beanstalk. It drinks the candy and grows a little taller.',
  'beanstalk.reachedClouds': 'The beanstalk reaches the clouds. The world, it turns out, goes up.',
  'beanstalk.elevatorReady': 'The beanstalk will carry you now. Up is just a place you go.',

  // misc UI
  'ui.starCounter': 'stars in the sky',
  'ui.candyCounter': 'candies',
}

/** Resolve a key to its English string (a typed lookup; key must be a GameTextKey). */
export function t(key: GameTextKey): string {
  return en[key]
}

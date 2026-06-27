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
  'item.candyCaneBow.name': 'candy-cane bow',
  'item.candyCaneBow.desc': 'It fires sharpened sugar at things far away. Get used to far away.',
  'item.licoriceWhip.name': 'licorice whip',
  'item.licoriceWhip.desc': 'Long, fast, and faintly aniseed. It cracks more than it bruises.',
  'item.jawbreakerMace.name': 'jawbreaker mace',
  'item.jawbreakerMace.desc': 'A jawbreaker on a stick. Slow to swing. Nothing it hits stays standing.',
  'item.popRockPike.name': 'pop rock pike',
  'item.popRockPike.desc': 'A long haft of fused pop rocks tipped with a sharpened shard. It out-reaches anything else you can hold, and crackles the whole way in. Slow, but they never get close enough to matter.',
  'item.leatherHat.name': 'leather hat',
  'item.leatherHat.desc': 'Keeps the sun off. Keeps very little else off.',
  'item.fishbowlHelm.name': 'fishbowl helm',
  'item.fishbowlHelm.desc': 'A great glass bowl blown from melted jawbreaker, sealed onto a gorget. Airtight. Absurd. It fogs when you breathe. Up where there is nothing to breathe, that will be the point.',
  'item.beginnerGrimoire.name': "beginner's grimoire",
  'item.beginnerGrimoire.desc': 'Two spells and a great many warnings about candy.',
  'item.telescope.name': 'telescope',
  'item.telescope.desc': 'For looking up. You will look up a great deal now.',
  'item.bottledTempest.name': 'bottled tempest',
  'item.bottledTempest.desc': 'A whole storm, corked. It rattles. One day you will learn to uncork it.',
  'item.stormSilk.name': 'storm-silk',
  'item.stormSilk.desc': 'Cloth woven from a tamed gale. Enough for a sail, if you had a ship.',
  'item.cottonCandyBalloon.name': 'cotton-candy balloon',
  'item.cottonCandyBalloon.desc': 'A balloon of spun pink cloud, rigged with licorice. It strains upward, toward the moon.',
  'item.wormMold.name': 'gummy worm mold',
  'item.wormMold.desc': 'A worm-shaped cast prised from the colossal one. Press gummy into it and a burrower takes shape — it digs alongside you, and your haul comes up doubled.',
  'item.shedShell.name': 'curl of shed shell',
  'item.shedShell.desc': 'A curl of translucent shell, shed from the inside. Whatever lay coiled in the moon’s heart left this behind. It has not yet gone cold.',
  'item.brassSextant.name': 'brass sextant',
  'item.brassSextant.desc': 'A brass arc and a sighting-glass, its use taught to your hands by the lighthouse cyclops. You can read a course in the stars now — enough to point a ship, once you have one.',
  'item.acornOfKnowledge.name': 'the acorn of knowledge',
  'item.acornOfKnowledge.desc': 'A small, very ordinary acorn, pressed into your hand by a squirrel who clearly expected more of you. It is said to know where things are hidden. It has not said anything yet.',
  'item.krakenCrown.name': 'the kraken crown',
  'item.krakenCrown.desc': 'A circlet of cold coral and rock candy, prised from the brow of the thing in the gas. It is far too large and very slightly damp, and wearing it you feel obscurely that something in the deep now considers you family. They say it can be enchanted two ways. It declines, for now, to say which.',
  'item.sourbeardTricorn.name': "Sourbeard's tricorn",
  'item.sourbeardTricorn.desc': "Captain Sourbeard's hat, swept off his head in the moment you bested him and never reclaimed. It is enormous, faintly salt-stained, and smells of gunpowder and aniseed. A crew would follow this hat. You do not have a crew. Yet.",
  'item.gummyParrot.name': 'the gummy parrot',
  'item.gummyParrot.desc': "Sourbeard's parrot, a translucent gummy bird of dubious loyalty. It transferred its allegiance to you the instant the duel turned, which tells you everything about its allegiance. It says nothing useful. It mostly vibes.",
  'item.mantleSword.name': 'the heirloom sword',
  'item.mantleSword.desc': "It hangs over Grandma's mantle. Not yet. Not yet.",

  // merchant lines
  'shop.leatherHat.thanks': 'A fine choice. Mind the sun.',
  'shop.beginnerGrimoire.thanks': 'Back-room stock. Do not set anything on fire.',
  'forge.woodenSword.thanks': 'It is a sword. Mostly.',
  'forge.ironSword.thanks': 'The rock candy gives it the edge. Literally.',
  'forge.candyCaneBow.thanks': 'Aim away from your foot. That is the whole lesson.',
  'forge.licoriceWhip.thanks': 'Snap the wrist. Do not ask where I learned that.',
  'forge.jawbreakerMace.thanks': 'Mind your toes. And the floor. And the wall behind it.',
  'forge.popRockPike.thanks': 'Comet-stuff, fused and sharpened. Keep them at the point and they never lay a finger on you. That is the whole idea.',
  'forge.fishbowlHelm.thanks': 'There. Hammered onto a good gorget. You will look ridiculous, and you will breathe. I have wanted to make one of these my whole life. Go on — go and need it.',
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
  // The observation deck (§15/§189) — the one place the game states the truth aloud. He does not theorise now.
  'dialogue.astronomer.grim1': 'I was wrong. About all of it.',
  'dialogue.astronomer.grim2': 'They are not burning out. They are being eaten.',
  'dialogue.astronomer.grim3': 'Eight thousand and counting down. I never thought to ask down to what.',

  // recipes
  'recipe.syrupOfHealth.name': 'syrup of health',
  'recipe.fizzyLiftingSoda.name': 'fizzy lifting soda',

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
  'rumor.stormFront': 'The giant on the cloud bridge takes candy, not blows — pay him, then mind the updrafts past him.',
  'rumor.fizzyLiftingSoda': 'To ride an updraft you want a fizzy soda: two candies in the pot, heat it, then stir.',
  'rumor.beanstalkCuttings': 'Keep stuffing the beanstalk with candy past the clouds — a thick stalk drops licorice. The balloonwright wants both that and cotton candy.',
  'rumor.moonWorm': 'Mind the moon, they say — a worm the size of a church eats it from within. Bring something with reach; it out-chews anything that fights up close.',
  'rumor.lighthouse': 'A one-eyed keeper minds a lighthouse up on the moon. Plot his courses and he will teach you to read the sky — you will want that before you ever put to sail.',
  'rumor.fishbowlHelm': 'Once you can read the sky, take the blacksmith a haul of rock candy. She has been wanting to seal a fishbowl over a gorget for years — vacuum gear, she calls it. You will want air where you are going.',

  // death messages
  'death.candyBat': 'A candy bat drank you dry. You wake at the last safe ledge.',
  'death.sugarGolem': 'The sugar golem flattened you. Sweetly. You respawn.',
  'death.gummyWorm': 'A gummy worm got you. Embarrassing. You respawn.',
  'death.gummySlime': 'A gummy slime wore you down. You pick yourself up at the treeline.',
  'death.gummyBear': 'The gummy bear sat on you. It was not personal. You respawn.',
  'death.gummyAphid': 'A gummy aphid prised you off the stalk. You slide to the last leaf.',
  'death.cloudRat': 'A cloud rat ran you off the edge. You wake on a lower leaf.',
  'death.mineSentinel': 'The rock-candy sentinel knocks you flat. It does not even chase you.',
  'death.rockImp': 'A rock imp trips you off the path. You slide back to the trailhead.',
  'death.stormSprite': 'A storm sprite earths itself through you. You come to on a lower ledge, hair on end.',
  'death.thunderheadDjinn': 'The djinn folds you into the cloud and wrings you out. You wake further down, damp.',
  'death.moonWorm': 'The moon worm finds you chewy. This is a compliment, from a worm. You wake at the tunnel mouth.',
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
  'action.eat': 'eat all the candies',
  'action.throw': 'throw 10 candies on the ground',
  'action.enterHouse': 'enter your house',
  'action.openMap': 'the map',
  'action.inventory': 'inventory',
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
  'beanstalk.thickened': 'The stalk has gone woody and thick. It sheds licorice cuttings now, steadily.',

  // the balloon
  'balloon.built': 'The balloon fills with spun cloud and tugs at its line. It wants to go up.',

  // the jawbreaker moon: strata + picks
  'moon.stratum.sugarCrust': 'the sugar crust',
  'moon.stratum.cobaltCandy': 'the cobalt-candy stratum',
  'moon.stratum.jawbreakerCore': 'the jawbreaker core',
  'moon.pick.candyPick': 'candy pick',
  'moon.pick.ironPick': 'iron pick',
  'moon.pick.rockCandyDrill': 'rock candy drill',

  // misc UI
  'ui.starCounter': 'stars in the sky',
  'ui.candyCounter': 'candies',
}

/** Resolve a key to its English string (a typed lookup; key must be a GameTextKey). */
export function t(key: GameTextKey): string {
  return en[key]
}

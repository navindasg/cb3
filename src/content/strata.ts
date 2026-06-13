import type { StratumDef } from '@/engine/types/defs'

// The Act 0 world as a bottom-to-top stratum registry (ADR §7.5, D10; resolved decision 2).
// The page grows UPWARD as acts unlock. Each stratum is a wide ASCII band; place NAMES are
// drawn directly into the art and the renderer overlays a transparent click hotspot over each
// (CB2's model — it never stamps labels on top of the backdrop). A zone's `label` is the exact
// text to find in the art; only a dynamic zone absent from the static art (the seed crater)
// gives x/rowOffset to be drawn onto reserved blank space when revealed.
//
// Anchors (low → high): undergroundLevel (mines), groundLevel (field & house), villageLevel
// (the village), spaceLevel (the observatory on its hill). Cloud/sky arrive with the beanstalk.

const W = 76 // band width; the renderer pads every row to the widest line

/** Your field and house — the opening screen. Always present. */
export const FIELD_STRATUM: StratumDef = {
  id: 'field',
  anchor: 'groundLevel',
  heightRows: 8,
  ascii: [
    '        \\  |  /                                        .     .     .         ',
    '      --- (*) ---        a wide sky over a candy field                       ',
    '        /  |  \\                                                              ',
    '        ______                                                               ',
    '       |      |        your field              a hole goes down              ',
    '       |      |      .  .  .  .  .  .           to the sugar mines           ',
    '      your house                                                             ',
    '~'.repeat(W),
  ],
  zones: [
    { id: 'house', displayKey: 'zone.house', label: 'your house', action: 'enter:house' },
    { id: 'field', displayKey: 'zone.field', label: 'your field', action: 'enter:field' },
    {
      id: 'minesEntrance',
      displayKey: 'zone.minesEntrance',
      label: 'the sugar mines',
      action: 'quest:sugarMines',
    },
    {
      // The crater + beanstalk garden, revealed by the seed event (G1/G2). Absent from the
      // static art, so it is drawn onto the reserved blank space at (x,rowOffset) once the
      // falling star has landed (gated by 'seedPresent'). Clicking it plants/feeds the stalk.
      id: 'beanstalkGarden',
      displayKey: 'zone.beanstalkGarden',
      label: 'the crater',
      x: 32,
      rowOffset: 2,
      action: 'enter:beanstalkGarden',
      unlockFlag: 'seedPresent',
    },
  ],
}

/** The sugar mines, below the field. Unlocked once the player has been told of them. */
export const MINES_STRATUM: StratumDef = {
  id: 'mines',
  anchor: 'undergroundLevel',
  heightRows: 5,
  unlockFlag: 'minesRevealed',
  ascii: [
    '#'.repeat(W),
    '##                          the sugar mines                              ##',
    '##   *  veins of rock candy  *      candy bats        sugar golems        ##',
    '##                                                                        ##',
    '###################    the fossil rests below    #########################',
  ],
  zones: [
    {
      id: 'fossilChamber',
      displayKey: 'zone.fossilChamber',
      label: 'the fossil',
      action: 'interact:fossil',
      unlockFlag: 'rockCandyUnlocked',
    },
  ],
}

/** The village. Unlocked after the field opener. Shop, forge, tavern, houses, well. */
export const VILLAGE_STRATUM: StratumDef = {
  id: 'village',
  anchor: 'villageLevel',
  heightRows: 8,
  unlockFlag: 'villageUnlocked',
  ascii: [
    '                                                                            ',
    '  ==========================  the village  ==============================  ',
    '      .----.        .----.         .------.          .------.              ',
    '      |    |        |    |         |      |          |      |               ',
    '    the shop      the forge      the tavern        the houses              ',
    '      |____|        |____|         |______|          |______|              ',
    '                            the well                                       ',
    '  ======================================================================  ',
  ],
  zones: [
    { id: 'shop', displayKey: 'zone.shop', label: 'the shop', action: 'enter:shop' },
    { id: 'forge', displayKey: 'zone.forge', label: 'the forge', action: 'enter:forge' },
    { id: 'tavern', displayKey: 'zone.tavern', label: 'the tavern', action: 'enter:tavern' },
    { id: 'houses', displayKey: 'zone.houses', label: 'the houses', action: 'enter:houses' },
    { id: 'well', displayKey: 'zone.well', label: 'the well', action: 'interact:well' },
  ],
}

/** The observatory on the hill above the village. Unlocked once the mines are cleared. */
export const OBSERVATORY_STRATUM: StratumDef = {
  id: 'observatory',
  anchor: 'spaceLevel',
  heightRows: 8,
  unlockFlag: 'observatoryUnlocked',
  ascii: [
    '                              .            *               .                ',
    '                 *                  the observatory                  .       ',
    '                            _______________                                 ',
    '            *              /   the dome      \\           the astronomer     ',
    '                          /   o          o    \\                             ',
    '                 ________/                      \\________                   ',
    '           _____/             a cauldron                 \\_____             ',
    '      ____/                   bubbles below                   \\____         ',
  ],
  zones: [
    { id: 'observatoryDome', displayKey: 'zone.observatory', label: 'the dome', action: 'enter:observatory' },
    { id: 'cauldron', displayKey: 'zone.cauldron', label: 'a cauldron', action: 'enter:cauldron' },
  ],
}

/**
 * The cloud stratum — the genre reveal (Block G). Gated behind 'beanstalkReachedClouds';
 * when set, render/mapModel appends it above the village and the page grows UPWARD. The climb
 * quest launches from here.
 */
export const CLOUD_STRATUM: StratumDef = {
  id: 'clouds',
  anchor: 'cloudLevel',
  heightRows: 6,
  unlockFlag: 'beanstalkReachedClouds',
  ascii: [
    '         .--.            .--.              .--.            .--.              ',
    '       (      )  ~~~~   (      )   ~~~~   (      )  ~~~~   (      )           ',
    '        `----`           `----`            `----`          `----`           ',
    '                 a giant beanstalk pierces the clouds                       ',
    '                 ||                         gummy aphids cling here          ',
    '          climb the beanstalk    ||                                         ',
  ],
  zones: [
    {
      id: 'beanstalkClimb',
      displayKey: 'zone.beanstalkClimb',
      label: 'climb the beanstalk',
      action: 'quest:beanstalkClimb',
    },
  ],
}

/**
 * The sky stratum above the clouds — the first hint of the vertical world. Revealed alongside
 * the clouds (same flag). The elevator fast-travel zone becomes clickable once the climb is done.
 */
export const SKY_STRATUM: StratumDef = {
  id: 'sky',
  anchor: 'skyLevel',
  heightRows: 5,
  unlockFlag: 'beanstalkReachedClouds',
  ascii: [
    '                   the open sky goes on, and on                             ',
    '          *                                              *                  ',
    '                   the top of the beanstalk                                 ',
    '                                                                            ',
    '             the beanstalk elevator                                         ',
  ],
  zones: [
    {
      id: 'beanstalkElevator',
      displayKey: 'zone.beanstalkElevator',
      label: 'the beanstalk elevator',
      action: 'travel:beanstalkElevator',
      unlockFlag: 'beanstalkElevator',
    },
  ],
}

/** The Act 0 strata, registered bottom-to-top in anchor order (render resolves the rows). */
export const ACT0_STRATA: readonly StratumDef[] = [
  MINES_STRATUM,
  FIELD_STRATUM,
  VILLAGE_STRATUM,
  OBSERVATORY_STRATUM,
  CLOUD_STRATUM,
  SKY_STRATUM,
]

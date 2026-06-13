import type { StratumDef } from '@/engine/types/defs'

// The Act 0 world as a bottom-to-top stratum registry (ADR §7.5, D10; resolved decision 2).
// Zones declare a symbolic anchor + a row offset; render/mapModel resolves anchors to concrete
// rows at build, stacking unlocked strata so the page grows UPWARD as acts unlock. Content is
// data only — the engine/renderer consume these defs, never the other way round.
//
// Anchors used in Act 0 (low → high): undergroundLevel (the mines), groundLevel (your field
// & house), villageLevel (the village), spaceLevel (the observatory on the hill). Higher
// strata (cloud/sky) arrive with the beanstalk in Block G.

/** Your field and house — the opening screen. Always present. */
export const FIELD_STRATUM: StratumDef = {
  id: 'field',
  anchor: 'groundLevel',
  heightRows: 4,
  ascii: [
    '   _____                              ',
    '  /house\\        . candies .          ',
    ' /_______\\      your field            ',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  ],
  zones: [
    { id: 'house', displayKey: 'zone.house', label: '[house]', x: 3, rowOffset: 1, action: 'enter:house' },
    { id: 'field', displayKey: 'zone.field', label: '[field]', x: 16, rowOffset: 2, action: 'enter:field' },
    {
      id: 'minesEntrance',
      displayKey: 'zone.minesEntrance',
      label: '[mine v]',
      x: 28,
      rowOffset: 2,
      action: 'quest:sugarMines',
    },
    {
      // The crater + beanstalk garden, revealed by the seed event (G1/G2). Appears once the
      // falling star has landed and the seed is present; clicking it plants/feeds the stalk.
      id: 'beanstalkGarden',
      displayKey: 'zone.beanstalkGarden',
      label: '[garden]',
      x: 11,
      rowOffset: 1,
      action: 'enter:beanstalkGarden',
      unlockFlag: 'seedPresent',
    },
  ],
}

/** The sugar mines, below the field. Unlocked once the player has been told of them. */
export const MINES_STRATUM: StratumDef = {
  id: 'mines',
  anchor: 'undergroundLevel',
  heightRows: 4,
  unlockFlag: 'minesRevealed',
  ascii: [
    '######## sugar mines ##################',
    '##  *  veins of rock candy  *        ##',
    '##     candy bats   sugar golems     ##',
    '######## the fossil rests below #######',
  ],
  zones: [
    {
      id: 'fossilChamber',
      displayKey: 'zone.fossilChamber',
      label: '[fossil]',
      x: 28,
      rowOffset: 3,
      action: 'interact:fossil',
      unlockFlag: 'rockCandyUnlocked',
    },
  ],
}

/** The village. Unlocked after the field opener. Shop, forge, tavern, houses, well. */
export const VILLAGE_STRATUM: StratumDef = {
  id: 'village',
  anchor: 'villageLevel',
  heightRows: 4,
  unlockFlag: 'villageUnlocked',
  ascii: [
    '======== the village =================',
    '  [] [] []   the lane    () () ()     ',
    ' shops & forge   tavern    houses     ',
    '=================== . well ===========',
  ],
  zones: [
    { id: 'shop', displayKey: 'zone.shop', label: '[shop]', x: 2, rowOffset: 1, action: 'enter:shop' },
    { id: 'forge', displayKey: 'zone.forge', label: '[forge]', x: 9, rowOffset: 1, action: 'enter:forge' },
    { id: 'tavern', displayKey: 'zone.tavern', label: '[tavern]', x: 17, rowOffset: 1, action: 'enter:tavern' },
    { id: 'houses', displayKey: 'zone.houses', label: '[houses]', x: 28, rowOffset: 1, action: 'enter:houses' },
    { id: 'well', displayKey: 'zone.well', label: '[well]', x: 22, rowOffset: 3, action: 'interact:well' },
  ],
}

/** The observatory on the hill. Unlocked once the mines are cleared. */
export const OBSERVATORY_STRATUM: StratumDef = {
  id: 'observatory',
  anchor: 'spaceLevel',
  heightRows: 3,
  unlockFlag: 'observatoryUnlocked',
  ascii: [
    '         ___ the observatory ___      ',
    '        / o-\\   astronomer            ',
    '       /_____\\  cauldron below        ',
  ],
  zones: [
    {
      id: 'observatoryDome',
      displayKey: 'zone.observatory',
      label: '[dome]',
      x: 9,
      rowOffset: 1,
      action: 'enter:observatory',
    },
    {
      id: 'cauldron',
      displayKey: 'zone.cauldron',
      label: '[cauldron]',
      x: 16,
      rowOffset: 2,
      action: 'enter:cauldron',
    },
  ],
}

/**
 * The cloud stratum — the genre reveal (Block G). It does not exist until the beanstalk has
 * been fed to the clouds: gated behind 'beanstalkReachedClouds', set by feedBeanstalk. When
 * the flag turns on, render/mapModel appends this stratum above the village and the page grows
 * UPWARD (the cloudLevel anchor sits above villageLevel). The climb quest launches from here.
 */
export const CLOUD_STRATUM: StratumDef = {
  id: 'clouds',
  anchor: 'cloudLevel',
  heightRows: 4,
  unlockFlag: 'beanstalkReachedClouds',
  ascii: [
    '   .--. the clouds  .--.   .--.       ',
    '  (    )   ~~~~~~   (    ) (    )      ',
    '   `--`  a beanstalk pierces them     ',
    '    ||  [climb v]   ||   gummy aphids ',
  ],
  zones: [
    {
      id: 'beanstalkClimb',
      displayKey: 'zone.beanstalkClimb',
      label: '[climb ^]',
      x: 4,
      rowOffset: 3,
      action: 'quest:beanstalkClimb',
    },
  ],
}

/**
 * The sky stratum above the clouds — the first hint of the vertical world the beanstalk
 * opened. Revealed alongside the clouds (same flag) once the stalk reaches them. The elevator
 * fast-travel zone appears here once the climb has been completed (beanstalkElevator).
 */
export const SKY_STRATUM: StratumDef = {
  id: 'sky',
  anchor: 'skyLevel',
  heightRows: 3,
  unlockFlag: 'beanstalkReachedClouds',
  ascii: [
    '          the open sky                ',
    '     *        the world tilts         ',
    '   the top of the beanstalk           ',
  ],
  zones: [
    {
      id: 'beanstalkElevator',
      displayKey: 'zone.beanstalkElevator',
      label: '[elevator]',
      x: 4,
      rowOffset: 2,
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

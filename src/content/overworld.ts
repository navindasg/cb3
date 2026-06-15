import type { OverworldDef } from '@/engine/types/overworld'

// The Act 0 overworld — a wide, spread-out landscape you traverse LEFT → RIGHT (CB2's map idiom:
// hand-drawn scene, names written into the art, landmarks revealed as you progress). The world
// extends UPWARD later (the beanstalk → the sky → Act 1). Each region is a small art block placed
// at world cells (x,y); its `label` is the exact clickable text in that art; `revealFlag` gates
// when it appears, so the discovered world grows and is never all on screen at once.
//
// Reveal chain (set by quest wins / story, see render/bootstrap + content/flags):
//   start: your field (+ the forest, visible to the east)
//   clear the forest      → forestCleared    → the village
//   reach the village     → villageReached   → the sugar mines + the mountain
//   climb the mountain     → mountainClimbed  → the observatory
//   the seed lands        → seedPresent      → the beanstalk garden (in your field)
//   feed it to the clouds → beanstalkReachedClouds → climb the beanstalk + the sky opens up

export const ACT0_OVERWORLD: OverworldDef = {
  worldWidth: 124,
  worldHeight: 40,
  regions: [
    // --- the sky (revealed once the beanstalk reaches the clouds) ---------------------------
    {
      id: 'sky',
      x: 2,
      y: 0,
      revealFlag: 'beanstalkReachedClouds',
      label: 'the sky',
      action: 'travel:sky',
      art: [
        '   .--.        .--.            .--.          the sky goes up, and up         .--.   ',
        '  (    )  ~~~  (    )   ~~~~   (    )  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  (    )  ',
        "   `--`         `--`            `--`                                           `--`  ",
      ],
    },
    {
      id: 'climb',
      x: 18,
      y: 4,
      revealFlag: 'beanstalkReachedClouds',
      label: 'climb the beanstalk',
      action: 'quest:beanstalkClimb',
      art: ['      ||', '   climb the beanstalk', '     \\||/'],
    },

    // --- the cumulus commons: the cloud village atop the beanstalk (Act 1) ------------------
    // Appears once the climb has turned the beanstalk into an elevator (beanstalkElevator).
    {
      id: 'cloudCommons',
      x: 40,
      y: 8,
      revealFlag: 'beanstalkElevator',
      label: 'the cloud village',
      action: 'enter:cloudCommons',
      art: [
        '    .-~~~~~~~~-.',
        '   ( ~ m  m  m ~ )',
        '    the cloud village',
        '   ( ~ (O) ~~~~ ~ )',
        "    `-~~~~~~~~-'",
      ],
    },

    // --- the observatory, atop the mountain (revealed after the climb) ----------------------
    {
      id: 'observatory',
      x: 92,
      y: 6,
      revealFlag: 'mountainClimbed',
      label: 'the observatory',
      action: 'enter:observatory',
      art: [
        '      .-"""""-.',
        '    .\'  ( o o ) \'.',
        '   |  the observatory |',
        "    '.   =====   .'",
        "      '-_______-'",
      ],
    },

    // --- the mountain: a 45-degree ascent on the right (revealed after the village) ---------
    {
      id: 'mountain',
      x: 84,
      y: 11,
      revealFlag: 'villageReached',
      label: 'the mountain',
      action: 'quest:mountain',
      art: [
        '                /\\',
        '               /  \\',
        '              / ^^ \\',
        '             /      \\',
        '            / the mountain',
        '           /   ^^^    \\',
        '          /____________\\',
      ],
    },

    // --- the beanstalk garden, in your field (revealed when the star-seed lands) ------------
    {
      id: 'beanstalkGarden',
      x: 22,
      y: 14,
      revealFlag: 'seedPresent',
      label: 'the beanstalk garden',
      action: 'enter:beanstalkGarden',
      art: [
        '        ||',
        '       \\||/',
        '   the beanstalk garden',
        '     __||__',
        '    (crater)',
      ],
    },

    // --- the ground band: your field · the forest · the village ----------------------------
    {
      id: 'field',
      x: 2,
      y: 24,
      label: 'your field',
      action: 'enter:field',
      art: [
        '     \\  |  /',
        '    -- (*) --    . . . .',
        '     /  |  \\    . your field .',
        '      ______     . . . .',
        '     | .  . |',
        '     |  .   |    a path east  >',
        '     your house',
        '    ~~~~~~~~~~~',
      ],
    },
    {
      id: 'forest',
      x: 40,
      y: 24,
      label: 'the forest',
      action: 'quest:forest',
      art: [
        '   ^    ^    ^    ^',
        '  /=\\  /=\\  /=\\  /=\\',
        '   |   the forest  |',
        '  /=\\  /=\\  /=\\  /=\\',
        '   | gummy critters |',
        '  ~~~~~~~~~~~~~~~~~~~~',
      ],
    },
    {
      id: 'village',
      x: 66,
      y: 22,
      revealFlag: 'forestCleared',
      label: 'the village',
      action: 'enter:village',
      art: [
        '  =======  the village  =======',
        '   .---.    .---.    .---.',
        '   |   |    |   |    |   |',
        "   '---'    '---'    '---'",
        '   shop     forge    tavern',
        '  ======  the well  ===========',
      ],
    },

    // --- the sugar mines, below the village (revealed after the village) --------------------
    {
      id: 'mines',
      x: 68,
      y: 31,
      revealFlag: 'villageReached',
      label: 'the sugar mines',
      action: 'quest:sugarMines',
      art: [
        '   \\##########################/',
        '    \\   the sugar mines      /',
        '     \\  * veins *  ~bats~   /',
        '      \\____________________/',
      ],
    },
  ],
}

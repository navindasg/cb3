import type { QuestDef } from '@/engine/types/defs'
import {
  STORM_SPRITE_DEATH,
  THUNDERHEAD_DJINN_DEATH,
  FALL_DEATH,
  GENERIC_DEATH,
} from '@/content/deathMessages'
import { STORM_FRONT_CLEARED_FLAG } from '@/content/flags'

// The storm front — Quest 3 (DESIGN §8 Act 1), the second VerticalDriver climb. Past the toll
// giant's bridge, you climb a charged cloud bank toward the moon. Storm sprites (fast, fragile
// motes of static) harry the ascent; the thunderhead djinn caps it as a boss. It is gated TWICE
// over: the updrafts demand the fizzy lifting soda (a cauldron brew — the quest screen refuses
// entry without it), and the djinn's long lightning reach out-pokes a melee swing, so — like the
// mine sentinel — the candy-cane bow (range 5) is the clean answer while a spoon trades badly.
//
// Coordinates mirror the beanstalk climb: the player starts grounded at the BOTTOM (large y) and
// climbs to the top (small y); scroll = playerStart.y - player.y, so reaching scroll >= the climb
// height wins. The djinn sits just under the summit, so reaching the top means getting past it.

/** The vertical scroll the player must reach to top out (the win scroll + the HUD denominator). */
export const STORM_FRONT_HEIGHT = 44

export const STORM_FRONT: QuestDef = {
  id: 'stormFront',
  mode: 'vertical',
  width: 18,
  height: 52,
  // grounded at the bottom: y + height(2) = 52 = groundY
  playerStart: { x: 8, y: 50 },
  playerMaxHp: 24, // a floor; the host overrides it with the eaten-candy-derived max HP
  staticSpawns: [
    { entityId: 'stormSprite', x: 5, y: 42 },
    { entityId: 'stormSprite', x: 12, y: 34 },
  ],
  waves: [
    {
      id: 'squall',
      trigger: { kind: 'distance', atScroll: 14 },
      spawns: [
        { entityId: 'stormSprite', x: 4, y: 24 },
        { entityId: 'stormSprite', x: 13, y: 20 },
        { entityId: 'stormSprite', x: 8, y: 16 },
      ],
    },
    {
      id: 'theDjinn',
      trigger: { kind: 'distance', atScroll: 34 },
      spawns: [{ entityId: 'thunderheadDjinn', x: 7, y: 4 }],
    },
  ],
  winCondition: { kind: 'reachScroll', atScroll: STORM_FRONT_HEIGHT },
  safeZones: [
    { x: 0, y: 48, width: 18, height: 4 }, // the bridge head (start)
    { x: 0, y: 28, width: 18, height: 3 }, // a sheltered updraft eddy (a breather + respawn)
  ],
  deathMessages: [STORM_SPRITE_DEATH, THUNDERHEAD_DJINN_DEATH, FALL_DEATH, GENERIC_DEATH],
  onWinFlags: [STORM_FRONT_CLEARED_FLAG],
  onWinDrops: [{ resource: 'candies', amount: 800 }],
}

/** How far you must climb to top out (for the host's HUD). */
export const STORM_FRONT_GOAL = STORM_FRONT_HEIGHT

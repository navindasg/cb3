import type { QuestDef } from '@/engine/types/defs'
import {
  GUMMY_SLIME_DEATH,
  GUMMY_BEAR_DEATH,
  GENERIC_DEATH,
} from '@/content/deathMessages'
import { FOREST_CLEARED_FLAG } from '@/content/flags'

// The forest — Quest 1 (DESIGN §3), the FIRST HorizontalDriver Scene quest. You walk east along
// the treeline; gummy critters block the path (slimes, then a gummy bear near the far edge). The
// generic Scene runtime resolves the combat (engine/quest/combat): your equipped weapon strikes
// the nearest critter in reach, they bite back. Reaching the east edge wins and reveals the
// village (onWinFlags sets forestCleared, which the overworld's village region gates on). Death
// respawns you at the treeline, losing nothing (CB-series: combat is farmable, not punishing).
//
// Coordinates: the player starts at the LEFT (x=1) and walks RIGHT. The Scene projects scroll as
// max(0, player.x - playerStart.x), so reaching scroll >= FOREST_LENGTH wins. playerMaxHp here is
// a floor; the host overrides it with the player's eaten-candy-derived max HP at quest start.

const FOREST_LENGTH = 50
const GROUND_Y = 8 // = def.height; entities of height 1 sit at y=7, height 2 at y=6

export const FOREST_QUEST: QuestDef = {
  id: 'forest',
  mode: 'horizontal',
  width: 56,
  height: GROUND_Y,
  playerStart: { x: 1, y: GROUND_Y - 1 },
  playerMaxHp: 10,
  staticSpawns: [
    { entityId: 'gummySlime', x: 12, y: GROUND_Y - 1 },
    { entityId: 'gummySlime', x: 20, y: GROUND_Y - 1 },
  ],
  waves: [
    {
      id: 'thicket',
      trigger: { kind: 'distance', atScroll: 22 },
      spawns: [
        { entityId: 'gummySlime', x: 31, y: GROUND_Y - 1 },
        { entityId: 'gummySlime', x: 36, y: GROUND_Y - 1 },
      ],
    },
    {
      id: 'theBear',
      trigger: { kind: 'distance', atScroll: 38 },
      spawns: [{ entityId: 'gummyBear', x: 47, y: GROUND_Y - 2 }],
    },
  ],
  winCondition: { kind: 'reachScroll', atScroll: FOREST_LENGTH },
  safeZones: [{ x: 0, y: 0, width: 6, height: GROUND_Y }], // the treeline you start on
  deathMessages: [GUMMY_SLIME_DEATH, GUMMY_BEAR_DEATH, GENERIC_DEATH],
  onWinFlags: [FOREST_CLEARED_FLAG],
  onWinDrops: [{ resource: 'candies', amount: 200 }],
}

/** How far east the player must travel to clear the forest (for the host's HUD). */
export const FOREST_GOAL = FOREST_LENGTH

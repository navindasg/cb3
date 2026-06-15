import type { QuestDef } from '@/engine/types/defs'
import { ROCK_IMP_DEATH, GUMMY_BEAR_DEATH, GENERIC_DEATH } from '@/content/deathMessages'
import { MOUNTAIN_CLIMBED_FLAG } from '@/content/flags'

// The mountain — the climb to the observatory (a HorizontalDriver Scene quest, the path read as an
// ascent). Rock imps skitter at you on the way up and a gummy bear guards the last switchback; both
// are armed, so this is a genuine fight that your forge weapon makes comfortable. Reaching the top
// sets `mountainClimbed`, which reveals the observatory on the overworld. Like the forest it is
// farmable — death respawns you at the trailhead, losing nothing.

const GROUND_Y = 8
const MOUNTAIN_LENGTH = 56

export const MOUNTAIN: QuestDef = {
  id: 'mountain',
  mode: 'horizontal',
  width: 64,
  height: GROUND_Y,
  playerStart: { x: 1, y: GROUND_Y - 1 },
  playerMaxHp: 16, // a floor; the host overrides it with the eaten-candy-derived max HP
  staticSpawns: [{ entityId: 'rockImp', x: 14, y: GROUND_Y - 1 }],
  waves: [
    {
      id: 'scree',
      trigger: { kind: 'distance', atScroll: 18 },
      spawns: [
        { entityId: 'rockImp', x: 26, y: GROUND_Y - 1 },
        { entityId: 'rockImp', x: 31, y: GROUND_Y - 1 },
      ],
    },
    {
      id: 'switchback',
      trigger: { kind: 'distance', atScroll: 38 },
      spawns: [
        { entityId: 'rockImp', x: 46, y: GROUND_Y - 1 },
        { entityId: 'gummyBear', x: 52, y: GROUND_Y - 2 },
      ],
    },
  ],
  winCondition: { kind: 'reachScroll', atScroll: MOUNTAIN_LENGTH },
  safeZones: [{ x: 0, y: 0, width: 6, height: GROUND_Y }], // the trailhead
  deathMessages: [ROCK_IMP_DEATH, GUMMY_BEAR_DEATH, GENERIC_DEATH],
  onWinFlags: [MOUNTAIN_CLIMBED_FLAG], // reveals the observatory on the overworld
  onWinDrops: [{ resource: 'candies', amount: 300 }],
}

/** How far you must climb to top out (for the host's HUD). */
export const MOUNTAIN_GOAL = MOUNTAIN_LENGTH

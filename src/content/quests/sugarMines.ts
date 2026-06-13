import type { QuestDef } from '@/engine/types/defs'
import { CANDY_BAT_DEATH, SUGAR_GOLEM_DEATH, GENERIC_DEATH } from '@/content/deathMessages'

// The sugar mines — Quest 1 (DESIGN §22.1), a HORIZONTAL Scene quest below the village. The
// player descends through candy bats, sugar golems and rock-candy veins (a resource drop) in
// an accelerated descent. At the bottom waits THE FOSSIL (the feed-exactly-1-candy twitch
// secret lives in content/secrets). Winning unlocks rock candy + the next zone and awards a
// rock-candy haul. Data only; the generic Scene runtime executes it with the HorizontalDriver.

export const SUGAR_MINES: QuestDef = {
  id: 'sugarMines',
  mode: 'horizontal',
  width: 80,
  height: 8,
  playerStart: { x: 1, y: 7 }, // grounded: y + height(1) = 8 = groundY
  playerMaxHp: 12,
  staticSpawns: [{ entityId: 'rockCandyVein', x: 20, y: 6 }],
  waves: [
    {
      id: 'bats1',
      trigger: { kind: 'distance', atScroll: 8 },
      spawns: [
        { entityId: 'candyBat', x: 14, y: 3 },
        { entityId: 'candyBat', x: 18, y: 2 },
      ],
    },
    {
      id: 'golems1',
      trigger: { kind: 'distance', atScroll: 30 },
      spawns: [{ entityId: 'sugarGolem', x: 36, y: 7 }],
    },
    {
      id: 'veins',
      trigger: { kind: 'distance', atScroll: 45 },
      spawns: [
        { entityId: 'rockCandyVein', x: 50, y: 6 },
        { entityId: 'rockCandyVein', x: 58, y: 5 },
      ],
    },
    {
      id: 'fossil',
      trigger: { kind: 'distance', atScroll: 68 },
      spawns: [{ entityId: 'fossil', x: 74, y: 7 }],
    },
  ],
  winCondition: { kind: 'reachScroll', atScroll: 72 },
  safeZones: [
    { x: 0, y: 0, width: 4, height: 8 },
    { x: 34, y: 0, width: 4, height: 8 }, // a rest ledge mid-descent
  ],
  deathMessages: [CANDY_BAT_DEATH, SUGAR_GOLEM_DEATH, GENERIC_DEATH],
  // onWin: unlock rock candy as a tracked resource + reveal the next zone, and bank the haul.
  onWinFlags: ['rockCandyUnlocked', 'observatoryUnlocked'],
  onWinDrops: [{ resource: 'rockCandy', amount: 10 }],
}

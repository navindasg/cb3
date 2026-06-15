import type { QuestDef } from '@/engine/types/defs'
import { GUMMY_WORM_DEATH, GENERIC_DEATH } from '@/content/deathMessages'

// The gummy-worm cellar — a short HORIZONTAL Scene quest beneath one of the village houses,
// a homage to CB2's rat-cellar intro mini-quest. A handful of gummy worms, one safe zone at
// the entrance, win by reaching the far end. On win it flags the cellar cleared. Data only;
// the generic Scene runtime executes it with the HorizontalDriver.

/** How far you must travel to clear the cellar (= the win scroll, also the host's HUD). */
export const GUMMY_WORM_CELLAR_GOAL = 20

export const GUMMY_WORM_CELLAR: QuestDef = {
  id: 'gummyWormCellar',
  mode: 'horizontal',
  width: 24,
  height: 6,
  playerStart: { x: 1, y: 5 }, // grounded: y + height(1) = 6 = groundY
  playerMaxHp: 10,
  staticSpawns: [
    { entityId: 'gummyWorm', x: 8, y: 5 },
    { entityId: 'gummyWorm', x: 14, y: 5 },
    { entityId: 'gummyWorm', x: 19, y: 5 },
  ],
  waves: [],
  winCondition: { kind: 'reachScroll', atScroll: GUMMY_WORM_CELLAR_GOAL },
  safeZones: [{ x: 0, y: 0, width: 4, height: 6 }],
  deathMessages: [GUMMY_WORM_DEATH, GENERIC_DEATH],
  onWinFlags: ['gummyWormCellarCleared'],
  onWinDrops: [{ resource: 'lollipops', amount: 1 }],
}

import type { QuestDef } from '@/engine/types/defs'
import { MINE_SENTINEL_DEATH, GENERIC_DEATH } from '@/content/deathMessages'
import { MINE_GATE_CLEARED_FLAG } from '@/content/flags'

// The mine gate — the access fight for the sugar mines (a HorizontalDriver Scene quest). A single
// rock-candy SENTINEL blocks the path east; you cannot pass it while it lives (the host holds you
// to fight whatever is in reach), so it is a true gate. It is tuned as the "go gear up" wall: the
// sentinel out-reaches grandma's spoon (range 2.8 vs 2) and has the HP to win that trade, so the
// intended answer is a forge weapon — the candy-cane BOW (range 5) or the licorice WHIP (range 3)
// kill it from outside its swing. The host runs this in ONE-LIFE mode: a death ejects you back to
// the village (see render/questScreens.startMines), so unlike the forest it is not farmable.
//
// Coordinates mirror the forest: start at the LEFT (x=1), walk RIGHT; scroll = max(0, x - start.x).
// The sentinel stands at x=30 and the win is just beyond it, so clearing it is the only way through.

const GROUND_Y = 8
const GATE_LENGTH = 38 // reach this scroll (past the sentinel at x=30) to win

export const MINE_GATE: QuestDef = {
  id: 'mineGate',
  mode: 'horizontal',
  width: 44,
  height: GROUND_Y,
  playerStart: { x: 1, y: GROUND_Y - 1 },
  playerMaxHp: 12, // a floor; the host overrides it with the eaten-candy-derived max HP
  staticSpawns: [{ entityId: 'mineSentinel', x: 30, y: GROUND_Y - 2 }],
  waves: [],
  winCondition: { kind: 'reachScroll', atScroll: GATE_LENGTH },
  safeZones: [{ x: 0, y: 0, width: 6, height: GROUND_Y }], // the mouth you start at
  deathMessages: [MINE_SENTINEL_DEATH, GENERIC_DEATH],
  // Clearing the gate sets `mineGateCleared` (committed by applyQuestWin on victory, like every
  // other quest), which opens the sugar-mines descent (content/quests/sugarMines). No drops here —
  // the rock-candy haul is the descent's reward.
  onWinFlags: [MINE_GATE_CLEARED_FLAG],
}

/** How far east you must travel to break through the gate (for the host's HUD). */
export const MINE_GATE_GOAL = GATE_LENGTH

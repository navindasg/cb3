import type { QuestDef } from '@/engine/types/defs'
import { MOON_WORM_DEATH, GUMMY_WORM_DEATH, GENERIC_DEATH } from '@/content/deathMessages'
import { MOON_WORM_DEFEATED_FLAG } from '@/content/flags'

// The moon worm — Quest 4 (DESIGN §8 Act 1): a colossal gummy worm eating the jawbreaker moon from
// inside, fought in the bore-holes it leaves. A HorizontalDriver Scene quest reached from the moon
// screen once your digging breaks into its tunnels (engine/content/moonStrata.wormTunnelsOpen). A
// couple of larval gummy worms (passive, the cellar callback) cling to the approach; the colossal
// worm walls the far end. Like the mine sentinel, it out-reaches a melee swing (maw reach 2.7 vs a
// spoon's 2) and has a boss's HP, so a short weapon loses the trade. The candy-cane bow (5) is the
// clean answer (it never gets bitten); the licorice whip (3) out-reaches the maw and wins, but
// scrappier — its short margin lets the worm land a few hits up close. The continuity lesson again.
//
// Coordinates mirror the mine gate: start at the LEFT (x=1), walk RIGHT; scroll = max(0, x-start.x).
// The worm stands at x=24 (three cells wide), and the win is just beyond it, so you cannot reach the
// goal without killing it. Run FARMABLE (death:'respawn'): a death drops you back at the tunnel
// mouth and the worm keeps the damage it has taken, so the fight is forgiving but the reach still
// stings. Clearing it drops industrial-grade licorice and the worm mold (granted by the host).

const GROUND_Y = 6
const TUNNEL_LENGTH = 28 // reach this scroll (past the worm at x=24) to win

export const MOON_WORM_QUEST: QuestDef = {
  id: 'moonWorm',
  mode: 'horizontal',
  width: 32,
  height: GROUND_Y,
  playerStart: { x: 1, y: GROUND_Y - 1 },
  playerMaxHp: 30, // a floor; the host overrides it with the eaten-candy-derived max HP
  staticSpawns: [
    { entityId: 'gummyWorm', x: 9, y: GROUND_Y - 1 }, // larvae you cut through on the approach
    { entityId: 'gummyWorm', x: 15, y: GROUND_Y - 1 },
    { entityId: 'moonWorm', x: 24, y: GROUND_Y - 2 }, // the colossal worm, two cells tall
  ],
  waves: [],
  winCondition: { kind: 'reachScroll', atScroll: TUNNEL_LENGTH },
  safeZones: [{ x: 0, y: 0, width: 6, height: GROUND_Y }], // the bore-hole mouth you start at
  deathMessages: [MOON_WORM_DEATH, GUMMY_WORM_DEATH, GENERIC_DEATH],
  onWinFlags: [MOON_WORM_DEFEATED_FLAG],
  // Industrial-grade licorice (DESIGN §8) — a boss-sized haul of the sky resource. The worm mold
  // itself is an item, granted alongside this by render/questScreens (grantItem) on victory.
  onWinDrops: [{ resource: 'licorice', amount: 150 }],
}

/** How far down the tunnel you must travel to clear the worm (for the host's HUD). */
export const MOON_WORM_GOAL = TUNNEL_LENGTH

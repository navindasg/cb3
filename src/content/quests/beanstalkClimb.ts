import type { QuestDef } from '@/engine/types/defs'
import { GUMMY_APHID_DEATH, CLOUD_RAT_DEATH, FALL_DEATH, GENERIC_DEATH } from '@/content/deathMessages'
import { BEANSTALK_ELEVATOR_FLAG } from '@/engine/content/beanstalkElevator'

// The beanstalk climb — Quest 2 (DESIGN §22), the FIRST VerticalDriver Scene quest and the
// raison d'être of Phase 1: it proves the rotated quest engine. The player climbs UPWARD from
// the garden floor to the clouds; gusts shove everything back down, gummy aphids cling to the
// stalk, cloud rats wait near the top. Reaching the top permanently converts the beanstalk
// into a fast-travel elevator (onWinFlags sets BEANSTALK_ELEVATOR_FLAG via applyQuestWin).
//
// Coordinates: the player starts at the BOTTOM (large screen-y) and climbs to the top (small
// screen-y). The Scene projects vertical scroll as max(0, playerStart.y - player.y), so
// reaching scroll >= the climb height wins. Data only; the generic Scene runtime executes it
// with the VerticalDriver (gusts + gravity configured by the host place).

const CLIMB_HEIGHT = 40

export const BEANSTALK_CLIMB: QuestDef = {
  id: 'beanstalkClimb',
  mode: 'vertical',
  width: 16,
  height: 48,
  // start grounded at the bottom: y + height(2) = 48 = groundY
  playerStart: { x: 7, y: 46 },
  playerMaxHp: 16,
  staticSpawns: [
    { entityId: 'gummyAphid', x: 4, y: 38 },
    { entityId: 'gummyAphid', x: 11, y: 30 },
  ],
  waves: [
    {
      id: 'aphids',
      trigger: { kind: 'distance', atScroll: 12 },
      spawns: [
        { entityId: 'gummyAphid', x: 3, y: 22 },
        { entityId: 'gummyAphid', x: 12, y: 18 },
      ],
    },
    {
      id: 'cloudRats',
      trigger: { kind: 'distance', atScroll: 28 },
      spawns: [
        { entityId: 'cloudRat', x: 5, y: 10 },
        { entityId: 'cloudRat', x: 10, y: 6 },
      ],
    },
  ],
  winCondition: { kind: 'reachScroll', atScroll: CLIMB_HEIGHT },
  safeZones: [
    { x: 0, y: 44, width: 16, height: 4 }, // the garden floor (start)
    { x: 0, y: 24, width: 16, height: 3 }, // a mid-stalk leaf ledge
    { x: 0, y: 0, width: 16, height: 4 }, // the cloud top
  ],
  deathMessages: [GUMMY_APHID_DEATH, CLOUD_RAT_DEATH, FALL_DEATH, GENERIC_DEATH],
  // reaching the top permanently sets the beanstalk-elevator fast-travel flag.
  onWinFlags: [BEANSTALK_ELEVATOR_FLAG],
}

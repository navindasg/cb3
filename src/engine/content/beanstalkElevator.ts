import type { GameState } from '@/engine/types/GameState'

// G3 — the BEANSTALK ELEVATOR. Reaching the top of the climb quest (Quest 2) permanently
// converts the beanstalk into a fast-travel elevator. The conversion is committed by the
// quest's onWinFlags (applied through engine/quest/questRewards.applyQuestWin), which set
// BEANSTALK_ELEVATOR_FLAG. This module is the tiny, pure reader the world consults to decide
// whether the elevator fast-travel affordance is offered. No logic beyond the flag check.

/** Flag set on beanstalk-climb victory; enables the elevator fast-travel forever after. */
export const BEANSTALK_ELEVATOR_FLAG = 'beanstalkElevator'

/** Whether the beanstalk elevator fast-travel is available (climb completed at least once). */
export function elevatorUnlocked(state: GameState): boolean {
  return state.flags[BEANSTALK_ELEVATOR_FLAG] === true
}

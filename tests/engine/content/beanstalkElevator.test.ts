import { createDefaultSave } from '@/engine/state/defaultSave'
import { applyQuestWin } from '@/engine/quest/questRewards'
import { BEANSTALK_ELEVATOR_FLAG, elevatorUnlocked } from '@/engine/content/beanstalkElevator'
import { BEANSTALK_CLIMB } from '@/content/quests/beanstalkClimb'
import type { GameState } from '@/engine/types/GameState'

describe('beanstalk elevator flag', () => {
  it('is locked by default', () => {
    expect(elevatorUnlocked(createDefaultSave())).toBe(false)
  })

  it('is unlocked once the flag is set', () => {
    const state: GameState = { ...createDefaultSave(), flags: { [BEANSTALK_ELEVATOR_FLAG]: true } }
    expect(elevatorUnlocked(state)).toBe(true)
  })

  it('the climb quest declares the elevator flag in onWinFlags', () => {
    expect(BEANSTALK_CLIMB.onWinFlags).toContain(BEANSTALK_ELEVATOR_FLAG)
  })

  it('applying the climb win commits the elevator flag (reaching the top)', () => {
    const after = applyQuestWin(createDefaultSave(), BEANSTALK_CLIMB)
    expect(elevatorUnlocked(after)).toBe(true)
  })
})

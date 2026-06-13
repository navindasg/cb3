import { createDefaultSave } from '@/engine/state/defaultSave'
import { applyQuestWin } from '@/engine/quest/questRewards'
import { SUGAR_MINES } from '@/content/quests/sugarMines'
import { GUMMY_WORM_CELLAR } from '@/content/quests/gummyWormCellar'
import type { QuestDef } from '@/engine/types/defs'

describe('applyQuestWin', () => {
  it('unlocks the sugar mines onWin flags and awards rock candy', () => {
    const after = applyQuestWin(createDefaultSave(), SUGAR_MINES)
    expect(after.flags['rockCandyUnlocked']).toBe(true)
    expect(after.flags['observatoryUnlocked']).toBe(true)
    expect(after.rockCandy.current).toBe(10)
    expect(after.rockCandy.lifetimeAccumulated).toBe(10)
  })

  it('awards the gummy-worm cellar lollipop and clears flag', () => {
    const after = applyQuestWin(createDefaultSave(), GUMMY_WORM_CELLAR)
    expect(after.flags['gummyWormCellarCleared']).toBe(true)
    expect(after.lollipops.current).toBe(1)
  })

  it('returns the same reference for a quest with no declared rewards', () => {
    const def: QuestDef = { ...SUGAR_MINES, onWinFlags: undefined, onWinDrops: undefined }
    const state = createDefaultSave()
    expect(applyQuestWin(state, def)).toBe(state)
  })

  it('does not mutate the input state', () => {
    const state = createDefaultSave()
    applyQuestWin(state, SUGAR_MINES)
    expect(state.rockCandy.current).toBe(0)
    expect(state.flags['rockCandyUnlocked']).toBeUndefined()
  })
})

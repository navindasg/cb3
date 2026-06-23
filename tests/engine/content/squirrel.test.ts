import { createDefaultSave } from '@/engine/state/defaultSave'
import {
  squirrelRiddleIndex,
  currentRiddle,
  allRiddlesSolved,
  answerRiddle,
} from '@/engine/content/squirrel'
import { SQUIRREL_RIDDLES, SQUIRREL_RIDDLE_KEY } from '@/content/reef/squirrel'
import type { GameState } from '@/engine/types/GameState'

/** Answer every riddle correctly in order, returning the final state. */
const solveAll = (start: GameState): GameState =>
  SQUIRREL_RIDDLES.reduce((s, r) => answerRiddle(s, r.answerId, SQUIRREL_RIDDLES).state, start)

describe('the space squirrel — the riddles', () => {
  it('starts on the first riddle, none solved', () => {
    const s = createDefaultSave()
    expect(squirrelRiddleIndex(s)).toBe(0)
    expect(currentRiddle(s, SQUIRREL_RIDDLES)).toEqual(SQUIRREL_RIDDLES[0])
    expect(allRiddlesSolved(s, SQUIRREL_RIDDLES)).toBe(false)
  })

  it('a correct answer advances to the next riddle and reports the solved one', () => {
    const first = SQUIRREL_RIDDLES[0]!
    const result = answerRiddle(createDefaultSave(), first.answerId, SQUIRREL_RIDDLES)
    expect(result.ok).toBe(true)
    expect(result.correct).toBe(true)
    expect(result.solved).toEqual(first)
    expect(result.allSolved).toBe(false)
    expect(squirrelRiddleIndex(result.state)).toBe(1)
    expect(currentRiddle(result.state, SQUIRREL_RIDDLES)).toEqual(SQUIRREL_RIDDLES[1])
  })

  it('a wrong answer is a no-op (same reference) — retry, no penalty, no advance', () => {
    const s = createDefaultSave()
    const wrongId = SQUIRREL_RIDDLES[0]!.options.find((o) => o.id !== SQUIRREL_RIDDLES[0]!.answerId)!.id
    const result = answerRiddle(s, wrongId, SQUIRREL_RIDDLES)
    expect(result.ok).toBe(true)
    expect(result.correct).toBe(false)
    expect(result.solved).toBeUndefined()
    expect(result.state).toBe(s)
    expect(squirrelRiddleIndex(result.state)).toBe(0)
  })

  it('answering every riddle solves them all and flags allSolved on the last', () => {
    let s = createDefaultSave()
    for (let i = 0; i < SQUIRREL_RIDDLES.length; i++) {
      expect(allRiddlesSolved(s, SQUIRREL_RIDDLES)).toBe(false)
      const result = answerRiddle(s, SQUIRREL_RIDDLES[i]!.answerId, SQUIRREL_RIDDLES)
      s = result.state
      expect(result.solved).toEqual(SQUIRREL_RIDDLES[i]) // solved is reported on every correct answer
      expect(result.allSolved).toBe(i === SQUIRREL_RIDDLES.length - 1) // incl. coexisting on the last
    }
    expect(allRiddlesSolved(s, SQUIRREL_RIDDLES)).toBe(true)
    expect(squirrelRiddleIndex(s)).toBe(SQUIRREL_RIDDLES.length)
  })

  it('is a no-op (same reference) once every riddle is solved', () => {
    const done = solveAll(createDefaultSave())
    const result = answerRiddle(done, SQUIRREL_RIDDLES[0]!.answerId, SQUIRREL_RIDDLES)
    expect(result.ok).toBe(false)
    expect(result.allSolved).toBe(true)
    expect(result.state).toBe(done)
    expect(currentRiddle(done, SQUIRREL_RIDDLES)).toBeNull()
  })

  it('does not mutate the input state', () => {
    const before = createDefaultSave()
    answerRiddle(before, SQUIRREL_RIDDLES[0]!.answerId, SQUIRREL_RIDDLES)
    expect(before.numbers[SQUIRREL_RIDDLE_KEY]).toBeUndefined()
  })

  it('clamps a corrupt/negative riddle counter to a sane index', () => {
    const junk: GameState = { ...createDefaultSave(), numbers: { [SQUIRREL_RIDDLE_KEY]: -5 } }
    expect(squirrelRiddleIndex(junk)).toBe(0)
    expect(currentRiddle(junk, SQUIRREL_RIDDLES)).toEqual(SQUIRREL_RIDDLES[0])
  })

  it('every riddle has its answerId among its options (content sanity)', () => {
    for (const r of SQUIRREL_RIDDLES) {
      expect(r.options.some((o) => o.id === r.answerId)).toBe(true)
      expect(r.chocolateReward).toBeGreaterThan(0)
    }
  })
})

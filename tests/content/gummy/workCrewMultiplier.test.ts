import {
  GUMMY_WORK_CREW_COUNT_KEY,
  GUMMY_WORK_CREW_STAGE_FLAG,
  WORK_CREW_BOOST,
  workCrewCount,
  gummyWorkCrewMultiplier,
} from '@/content/gummy/molds'
import { DYSON_STAGE_DONE_FLAGS } from '@/content/flags'
import { createDefaultSave } from '@/engine/state/defaultSave'
import type { GameState } from '@/engine/types/GameState'

/** A save with a chosen crew count, optionally past the stage-2 gate. */
const make = (crews: number, stage2: boolean): GameState => {
  const s = createDefaultSave()
  return {
    ...s,
    flags: stage2 ? { ...s.flags, [GUMMY_WORK_CREW_STAGE_FLAG]: true } : s.flags,
    numbers: { ...s.numbers, [GUMMY_WORK_CREW_COUNT_KEY]: crews },
  }
}

describe('the gummy work-crew config — lock-step + reader', () => {
  it("the helper's stage flag matches content/flags DYSON_STAGE_DONE_FLAGS[1]", () => {
    // The content helper names the same dysonStage2Done literal the engine + content/flags use.
    expect(GUMMY_WORK_CREW_STAGE_FLAG).toBe(DYSON_STAGE_DONE_FLAGS[1])
  })

  it('workCrewCount defaults to 0, clamps negatives, floors fractions', () => {
    expect(workCrewCount(createDefaultSave())).toBe(0)
    expect(workCrewCount(make(-3, true))).toBe(0)
    expect(workCrewCount(make(4.9, true))).toBe(4)
  })
})

describe('gummyWorkCrewMultiplier — the pure read', () => {
  it('is EXACTLY 1 on a fresh save (no crews, no stage 2)', () => {
    expect(gummyWorkCrewMultiplier(createDefaultSave())).toBe(1)
  })

  it('is EXACTLY 1 before stage 2 even with a stray crew count (the flag guard)', () => {
    expect(gummyWorkCrewMultiplier(make(8, false))).toBe(1)
  })

  it('is EXACTLY 1 at stage 2 with zero crews (1 + 0 * boost)', () => {
    expect(gummyWorkCrewMultiplier(make(0, true))).toBe(1)
  })

  it('is 1 + count * boost once stage 2 is raised and crews are hired', () => {
    expect(gummyWorkCrewMultiplier(make(1, true))).toBeCloseTo(1 + WORK_CREW_BOOST)
    expect(gummyWorkCrewMultiplier(make(4, true))).toBeCloseTo(1 + 4 * WORK_CREW_BOOST)
  })

  it('is monotone non-decreasing in the crew count (past the gate)', () => {
    expect(gummyWorkCrewMultiplier(make(2, true))).toBeLessThan(gummyWorkCrewMultiplier(make(5, true)))
  })
})

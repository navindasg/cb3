import {
  workCrewsUnlocked,
  workCrewCount,
  canHireCrew,
  hireCrew,
} from '@/engine/content/gummyWorkCrew'
import {
  GUMMY_WORK_CREW_COUNT_KEY,
  WORK_CREW_CANDY_COST,
  WORK_CREW_LICORICE_COST,
} from '@/content/gummy/molds'
import { DYSON_STAGE_DONE_FLAGS } from '@/content/flags'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { createResource } from '@/engine/types/Resource'
import type { GameState } from '@/engine/types/GameState'

const STAGE2 = DYSON_STAGE_DONE_FLAGS[1]

/** A save with the lower ring (stage 2) raised + resources/count to hire work-crews. */
const open = (over: { candies?: number; licorice?: number; crews?: number } = {}): GameState => {
  const s = createDefaultSave()
  return {
    ...s,
    flags: { ...s.flags, [STAGE2]: true },
    numbers: { ...s.numbers, [GUMMY_WORK_CREW_COUNT_KEY]: over.crews ?? 0 },
    candies: createResource(over.candies ?? 1_000_000_000),
    licorice: createResource(over.licorice ?? 1_000),
  }
}

describe('gummy work-crews — the stage-2 gate', () => {
  it('the crews are not here until the lower ring (stage 2) is raised', () => {
    expect(workCrewsUnlocked(createDefaultSave())).toBe(false)
    expect(workCrewsUnlocked(open())).toBe(true)
  })

  it('gates on the EXACT content-owned stage-2 flag literal (lock-step)', () => {
    // If the engine's re-declared literal drifts from content/flags, this fails — guarding the moonStrata
    // idiom. The flag set on the save (the content constant) must be the one the engine reads.
    const s = { ...createDefaultSave(), flags: { [DYSON_STAGE_DONE_FLAGS[1]]: true } }
    expect(workCrewsUnlocked(s)).toBe(true)
  })

  it('stage 1 alone does NOT unlock the crews (they are the stage-2 reward)', () => {
    const s = { ...createDefaultSave(), flags: { [DYSON_STAGE_DONE_FLAGS[0]]: true } }
    expect(workCrewsUnlocked(s)).toBe(false)
  })
})

describe('gummy work-crews — hireCrew', () => {
  it('cannot hire before stage 2 (SAME reference, locked)', () => {
    const before = { ...createDefaultSave(), candies: createResource(1e9), licorice: createResource(1e3) }
    const result = hireCrew(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('locked')
    expect(result.state).toBe(before)
  })

  it('hires a crew: spends exactly candies + licorice and ++count', () => {
    const before = open({ candies: 1_000_000_000, licorice: 1_000 })
    const result = hireCrew(before)
    expect(result.ok).toBe(true)
    expect(workCrewCount(result.state)).toBe(1)
    expect(result.state.candies.current).toBe(1_000_000_000 - WORK_CREW_CANDY_COST)
    expect(result.state.licorice.current).toBe(1_000 - WORK_CREW_LICORICE_COST)
  })

  it('refuses when candies are short (SAME reference, no licorice spent)', () => {
    const before = open({ candies: WORK_CREW_CANDY_COST - 1, licorice: 1_000 })
    const result = hireCrew(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
    expect(before.licorice.current).toBe(1_000) // nothing touched — no partial spend
  })

  it('refuses when licorice is short (SAME reference, no candies spent)', () => {
    const before = open({ candies: 1_000_000_000, licorice: WORK_CREW_LICORICE_COST - 1 })
    const result = hireCrew(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
    expect(before.candies.current).toBe(1_000_000_000) // candies untouched (licorice checked second)
  })

  it('never overdrafts at exactly the cost', () => {
    const before = open({ candies: WORK_CREW_CANDY_COST, licorice: WORK_CREW_LICORICE_COST })
    const result = hireCrew(before)
    expect(result.ok).toBe(true)
    expect(result.state.candies.current).toBe(0)
    expect(result.state.licorice.current).toBe(0)
    expect(workCrewCount(result.state)).toBe(1)
  })

  it('the count only ever rises (hiring again ++ from the prior count)', () => {
    const before = open({ crews: 4, candies: 1e9, licorice: 1e3 })
    const result = hireCrew(before)
    expect(workCrewCount(result.state)).toBe(5)
  })

  it('does not mutate the input state (immutability)', () => {
    const before = open({ candies: 1e9, licorice: 1e3 })
    const candiesRef = before.candies
    const licoriceRef = before.licorice
    hireCrew(before)
    expect(before.candies).toBe(candiesRef)
    expect(before.licorice).toBe(licoriceRef)
    expect(workCrewCount(before)).toBe(0)
  })
})

describe('gummy work-crews — canHireCrew', () => {
  it('mirrors the stage-2 gate + both costs', () => {
    expect(canHireCrew(open())).toBe(true)
    expect(canHireCrew(createDefaultSave())).toBe(false) // stage 2 not raised
    expect(canHireCrew(open({ candies: WORK_CREW_CANDY_COST - 1 }))).toBe(false)
    expect(canHireCrew(open({ licorice: WORK_CREW_LICORICE_COST - 1 }))).toBe(false)
  })
})

describe('gummy work-crews — workCrewCount (the shared reader)', () => {
  it('defaults to 0 and clamps/floors corrupt values (no crash)', () => {
    expect(workCrewCount(createDefaultSave())).toBe(0)
    expect(workCrewCount({ ...createDefaultSave(), numbers: { [GUMMY_WORK_CREW_COUNT_KEY]: -5 } })).toBe(0)
    expect(workCrewCount({ ...createDefaultSave(), numbers: { [GUMMY_WORK_CREW_COUNT_KEY]: 3.9 } })).toBe(3)
  })
})

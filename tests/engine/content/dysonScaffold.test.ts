import { createDefaultSave } from '@/engine/state/defaultSave'
import { createResource } from '@/engine/types/Resource'
import { GALLEON_HULL_KEY } from '@/content/ship/galleonUpgrade'
import { PEPPERMINT_GATE_AMOUNT } from '@/content/planet/mintPlanet'
import { DYSON_STAGES, DYSON_STAGE_KEY, DYSON_STAGE_COUNT } from '@/content/sun/dysonScaffold'
import {
  scaffoldReachable,
  currentStage,
  scaffoldComplete,
  nextStage,
  canBuildStage,
  buildStage,
  sunArt,
} from '@/engine/content/dysonScaffold'
import type { GameState } from '@/engine/types/GameState'

const STAGE1 = DYSON_STAGES[0]!
const STAGE1_CANDIES = STAGE1.price.find((l) => l.resource === 'candies')!.amount
const STAGE1_ROCK = STAGE1.price.find((l) => l.resource === 'rockCandy')!.amount

/** A save that has cleared the Act-2 gate (hull t3 + the full peppermint bank) — the scaffold reach gate. */
const gateCleared = (over: Partial<GameState> = {}): GameState => ({
  ...createDefaultSave(),
  numbers: { [GALLEON_HULL_KEY]: 3 },
  peppermint: createResource(PEPPERMINT_GATE_AMOUNT),
  ...over,
})

/** A save with the gate cleared AND deep candy + rock-candy stocks (enough to raise stage 1). */
const funded = (over: Partial<GameState> = {}): GameState => ({
  ...gateCleared(),
  candies: createResource(STAGE1_CANDIES * 2),
  rockCandy: createResource(STAGE1_ROCK * 2),
  ...over,
})

/** A save sitting at a completed stage N (the ledger bumped + every done-flag up to N set). */
const atStage = (stage: number, over: Partial<GameState> = {}): GameState => {
  const flags: Record<string, boolean> = {}
  for (let s = 1; s <= stage; s++) flags[DYSON_STAGES[s - 1]!.doneFlag] = true
  return {
    ...funded(),
    numbers: { [GALLEON_HULL_KEY]: 3, [DYSON_STAGE_KEY]: stage },
    flags,
    ...over,
  }
}

describe('the dyson scaffold — reachability', () => {
  it('is unreachable before the Act-2 gate is cleared', () => {
    expect(scaffoldReachable(createDefaultSave())).toBe(false)
    // hull short
    expect(
      scaffoldReachable({
        ...createDefaultSave(),
        numbers: { [GALLEON_HULL_KEY]: 2 },
        peppermint: createResource(PEPPERMINT_GATE_AMOUNT),
      }),
    ).toBe(false)
    // peppermint short
    expect(
      scaffoldReachable({
        ...createDefaultSave(),
        numbers: { [GALLEON_HULL_KEY]: 3 },
        peppermint: createResource(PEPPERMINT_GATE_AMOUNT - 1),
      }),
    ).toBe(false)
  })

  it('is reachable once the Act-2 gate (hull t3 + 10k peppermint) is cleared', () => {
    expect(scaffoldReachable(gateCleared())).toBe(true)
  })
})

describe('the dyson scaffold — the stage ledger', () => {
  it('starts at stage 0 (nothing raised) on a fresh save', () => {
    expect(currentStage(createDefaultSave())).toBe(0)
    expect(scaffoldComplete(createDefaultSave())).toBe(false)
    expect(nextStage(createDefaultSave())!.stage).toBe(1)
  })

  it('reads a migration-passthrough v8 save with no dyson numbers as stage 0, no crash', () => {
    // A default save carries no `dysonStage` number (the key rides the z.record passthrough; no schema
    // bump). currentStage must default it to 0 cleanly.
    const s = createDefaultSave()
    expect(s.numbers[DYSON_STAGE_KEY]).toBeUndefined()
    expect(currentStage(s)).toBe(0)
    expect(nextStage(s)!.stage).toBe(1)
  })

  it('clamps a corrupt out-of-range stage number into [0, count]', () => {
    expect(currentStage({ ...createDefaultSave(), numbers: { [DYSON_STAGE_KEY]: -5 } })).toBe(0)
    expect(currentStage({ ...createDefaultSave(), numbers: { [DYSON_STAGE_KEY]: 99 } })).toBe(DYSON_STAGE_COUNT)
    // a fractional value floors
    expect(currentStage({ ...createDefaultSave(), numbers: { [DYSON_STAGE_KEY]: 2.9 } })).toBe(2)
  })

  it('nextStage is null once every stage is complete', () => {
    expect(nextStage(atStage(DYSON_STAGE_COUNT))).toBeNull()
    expect(scaffoldComplete(atStage(DYSON_STAGE_COUNT))).toBe(true)
  })
})

describe('the dyson scaffold — canBuildStage', () => {
  it('is true when stage 1 is affordable', () => {
    expect(canBuildStage(funded())).toBe(true)
  })

  it('is false when either price line is short (no partial credit)', () => {
    expect(canBuildStage(funded({ candies: createResource(STAGE1_CANDIES - 1) }))).toBe(false)
    expect(canBuildStage(funded({ rockCandy: createResource(STAGE1_ROCK - 1) }))).toBe(false)
  })

  it('is false on a deferred next stage even when nominally affordable', () => {
    // After stage 2, the next stage (3) is deferred — its reward economy (the star sea) has not landed.
    const s = atStage(2, {
      candies: createResource(1e15),
      rockCandy: createResource(1e12),
      caramel: createResource(1e9),
      stardust: createResource(1e9),
    })
    expect(nextStage(s)!.deferred).toBe(true)
    expect(canBuildStage(s)).toBe(false)
  })

  it('is false once the whole scaffold is complete', () => {
    expect(canBuildStage(atStage(DYSON_STAGE_COUNT))).toBe(false)
  })
})

describe('the dyson scaffold — buildStage (stage 1)', () => {
  it('raises stage 1: spends every price line, bumps the ledger, sets dysonStage1Done', () => {
    const before = funded()
    const result = buildStage(before)
    expect(result.ok).toBe(true)
    expect(result.state.candies.current).toBe(before.candies.current - STAGE1_CANDIES)
    expect(result.state.rockCandy.current).toBe(before.rockCandy.current - STAGE1_ROCK)
    expect(result.state.numbers[DYSON_STAGE_KEY]).toBe(1)
    expect(result.state.flags['dysonStage1Done']).toBe(true)
    expect(currentStage(result.state)).toBe(1)
  })

  it('does not mutate the input state (immutability)', () => {
    const before = funded()
    const candiesBefore = before.candies.current
    const rockBefore = before.rockCandy.current
    buildStage(before)
    expect(before.candies.current).toBe(candiesBefore)
    expect(before.rockCandy.current).toBe(rockBefore)
    expect(before.numbers[DYSON_STAGE_KEY]).toBeUndefined()
    expect(before.flags['dysonStage1Done']).toBeUndefined()
  })

  it('raises stage 2 once stage 1 is done: spends candies + rock candy + caramel, sets dysonStage2Done', () => {
    const stage2 = DYSON_STAGES[1]!
    const c2 = stage2.price.find((l) => l.resource === 'candies')!.amount
    const r2 = stage2.price.find((l) => l.resource === 'rockCandy')!.amount
    const k2 = stage2.price.find((l) => l.resource === 'caramel')!.amount
    const before = atStage(1, {
      candies: createResource(c2 * 2),
      rockCandy: createResource(r2 * 2),
      caramel: createResource(k2 * 2),
    })
    const result = buildStage(before)
    expect(result.ok).toBe(true)
    expect(result.state.candies.current).toBe(c2 * 2 - c2)
    expect(result.state.rockCandy.current).toBe(r2 * 2 - r2)
    expect(result.state.caramel.current).toBe(k2 * 2 - k2)
    expect(result.state.flags['dysonStage2Done']).toBe(true)
    expect(currentStage(result.state)).toBe(2)
  })

  it('refuses stage 2 when caramel is short, touching nothing (the new caramel line)', () => {
    const stage2 = DYSON_STAGES[1]!
    const c2 = stage2.price.find((l) => l.resource === 'candies')!.amount
    const r2 = stage2.price.find((l) => l.resource === 'rockCandy')!.amount
    const k2 = stage2.price.find((l) => l.resource === 'caramel')!.amount
    const before = atStage(1, {
      candies: createResource(c2 * 2),
      rockCandy: createResource(r2 * 2),
      caramel: createResource(k2 - 1),
    })
    const result = buildStage(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
  })
})

describe('the dyson scaffold — buildStage refuses (no partial spend, SAME ref)', () => {
  it('returns the SAME reference + unaffordable when candies are short, touching nothing', () => {
    const before = funded({ candies: createResource(STAGE1_CANDIES - 1) })
    const result = buildStage(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
  })

  it('does NOT spend the affordable line when a LATER line is short (no partial spend)', () => {
    // candies are plenty, rock candy is short — the candies must NOT be debited.
    const before = funded({ rockCandy: createResource(STAGE1_ROCK - 1) })
    const candiesBefore = before.candies.current
    const result = buildStage(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
    expect(result.state.candies.current).toBe(candiesBefore)
  })

  it('returns the SAME reference + deferred on a deferred next stage', () => {
    // After stage 2, the next stage (3, the star sea) is still deferred.
    const before = atStage(2, {
      candies: createResource(1e15),
      rockCandy: createResource(1e12),
      caramel: createResource(1e9),
    })
    const result = buildStage(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('deferred')
    expect(result.state).toBe(before)
  })

  it('returns the SAME reference + maxStage once the scaffold is complete', () => {
    const before = atStage(DYSON_STAGE_COUNT)
    const result = buildStage(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('maxStage')
    expect(result.state).toBe(before)
  })
})

describe('the dyson scaffold — sequential, one-way (farm-proof)', () => {
  it('cannot raise stage N+1 before stage N (the next stage is always currentStage+1, and 3+ are deferred)', () => {
    // From stage 0, the only buildable stage is 1; stage 2 is buildable once 1 is done; stage 3 is deferred.
    const s = funded()
    expect(nextStage(s)!.stage).toBe(1)
    // even with infinite resources, you cannot skip past the sequential ladder to a deferred stage
    const rich = funded({
      candies: createResource(1e15),
      rockCandy: createResource(1e12),
      caramel: createResource(1e9),
    })
    const first = buildStage(rich)
    expect(first.ok).toBe(true)
    expect(currentStage(first.state)).toBe(1)
    // stage 2 is next AND now buildable (Increment 3 un-deferred it)
    const second = buildStage(first.state)
    expect(second.ok).toBe(true)
    expect(currentStage(second.state)).toBe(2)
    // now stage 3 is next, but it is deferred — a re-build is refused
    const third = buildStage(second.state)
    expect(third.ok).toBe(false)
    expect(third.reason).toBe('deferred')
  })

  it('raising stage 1 a second time is a no-op once done (the ledger has moved past it)', () => {
    const done = buildStage(funded()).state
    // the next stage is now 2, so re-calling buildStage targets stage 2 (never re-raises stage 1); stage 1
    // stays done and the ledger stays at 1 unless stage 2 is actually affordable.
    const again = buildStage(done)
    expect(again.state.flags['dysonStage1Done']).toBe(true)
    expect(currentStage(again.state)).toBeGreaterThanOrEqual(1)
  })
})

describe('the sun art', () => {
  it('sunArt(0) is the bare disc — pure printable ASCII (no emoji / non-ASCII)', () => {
    const art = sunArt(0)
    expect(art.length).toBeGreaterThan(0)
    // Guards the no-emoji rule: every char must be in the printable-ASCII range (or a newline).
    for (const ch of art) {
      const code = ch.codePointAt(0)!
      const ok = ch === '\n' || (code >= 0x20 && code <= 0x7e)
      expect(ok).toBe(true)
    }
  })

  it('every stage of sunArt is pure printable ASCII', () => {
    for (let stage = 0; stage <= DYSON_STAGE_COUNT; stage++) {
      const art = sunArt(stage)
      for (const ch of art) {
        const code = ch.codePointAt(0)!
        expect(ch === '\n' || (code >= 0x20 && code <= 0x7e)).toBe(true)
      }
    }
  })

  it('lays a strut onto the bare star once stage 1 is raised (the art changes)', () => {
    expect(sunArt(1)).not.toBe(sunArt(0))
    // the strut glyph is present at stage 1 but not on the bare star
    expect(sunArt(1).includes('|')).toBe(true)
    expect(sunArt(0).includes('|')).toBe(false)
  })

  it('clamps and floors its stage argument (defensive)', () => {
    expect(sunArt(-3)).toBe(sunArt(0))
    expect(sunArt(99)).toBe(sunArt(DYSON_STAGE_COUNT))
    expect(sunArt(1.9)).toBe(sunArt(1))
  })

  it('keeps every row the same fixed width (overlays never ragged the grid)', () => {
    const width = sunArt(0).split('\n')[0]!.length
    for (let stage = 0; stage <= DYSON_STAGE_COUNT; stage++) {
      for (const row of sunArt(stage).split('\n')) {
        expect(row.length).toBe(width)
      }
    }
  })
})

describe('the dyson stages config — sanity', () => {
  it('has exactly DYSON_STAGE_COUNT stages, numbered 1..count in order', () => {
    expect(DYSON_STAGES.length).toBe(DYSON_STAGE_COUNT)
    DYSON_STAGES.forEach((stage, i) => expect(stage.stage).toBe(i + 1))
  })

  it('stage 1 is buildable (not deferred) and candy-dominant + rock-candy only (soft-lock-free)', () => {
    expect(STAGE1.deferred).toBeFalsy()
    // stage 1 draws ONLY candies + rock candy — never caramel/stardust (which have no faucet yet).
    for (const line of STAGE1.price) {
      expect(['candies', 'rockCandy']).toContain(line.resource)
    }
    // candy-dominant so it is affordable before later costs
    expect(STAGE1_CANDIES).toBeGreaterThan(STAGE1_ROCK)
  })

  it('stage 2 is buildable (Increment 3 un-deferred it); stages 3-5 stay deferred', () => {
    // stage 2 (the lower ring, the gummy work-crews reward) is now buildable — no deferred flag.
    expect(DYSON_STAGES[1]!.deferred).toBeFalsy()
    // stages 3-5 remain deferred until their reward slices land, each with a note saying why.
    for (const stage of DYSON_STAGES.slice(2)) {
      expect(stage.deferred).toBe(true)
      expect(stage.note).toBeTruthy()
    }
  })

  it('stage 2 seals with caramel — which now has live faucets (Inc-0 boil + Inc-2 collector)', () => {
    // The lower ring is the first strut to draw caramel; it never soft-locks because caramel is sourced
    // before this slice (the cauldron boil floor + the solar-caramel collector faucet).
    const stage2 = DYSON_STAGES[1]!
    expect(stage2.price.some((l) => l.resource === 'caramel')).toBe(true)
  })

  it('prices escalate stage over stage', () => {
    for (let i = 1; i < DYSON_STAGES.length; i++) {
      const prev = DYSON_STAGES[i - 1]!.price.find((l) => l.resource === 'candies')!.amount
      const curr = DYSON_STAGES[i]!.price.find((l) => l.resource === 'candies')!.amount
      expect(curr).toBeGreaterThan(prev)
    }
  })
})

import {
  solarWorksOpen,
  collectorCount,
  caramelCollectorCount,
  solarCandyRate,
  solarCaramelRate,
  canBuildCollector,
  canBuildCaramelCollector,
  buildCollector,
  buildCaramelCollector,
} from '@/engine/content/solarWorks'
import {
  SOLAR_COLLECTOR_KEY,
  CARAMEL_COLLECTOR_KEY,
  SOLAR_COLLECTOR_CANDY_COST,
  SOLAR_COLLECTOR_ROCK_CANDY_COST,
  SOLAR_CANDY_PER_COLLECTOR_PER_SEC,
  CARAMEL_COLLECTOR_CANDY_COST,
  CARAMEL_PER_COLLECTOR_PER_SEC,
} from '@/content/sun/solarWorks'
import { DYSON_STAGE_DONE_FLAGS } from '@/content/flags'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { createResource } from '@/engine/types/Resource'
import type { GameState } from '@/engine/types/GameState'

const STAGE1 = DYSON_STAGE_DONE_FLAGS[0]

/** A save with stage 1 raised + resources/counts to spend on the solar works. */
const open = (
  over: { candies?: number; rockCandy?: number; collectors?: number; caramelCollectors?: number } = {},
): GameState => {
  const s = createDefaultSave()
  return {
    ...s,
    flags: { ...s.flags, [STAGE1]: true },
    numbers: {
      ...s.numbers,
      [SOLAR_COLLECTOR_KEY]: over.collectors ?? 0,
      [CARAMEL_COLLECTOR_KEY]: over.caramelCollectors ?? 0,
    },
    candies: createResource(over.candies ?? 1_000_000_000),
    rockCandy: createResource(over.rockCandy ?? 1_000_000),
  }
}

describe('the solar works — the stage-1 gate', () => {
  it('the works are shut until the first dyson strut is raised', () => {
    expect(solarWorksOpen(createDefaultSave())).toBe(false)
    expect(solarWorksOpen(open())).toBe(true)
  })

  it('gates on the EXACT content-owned stage-1 flag literal (lock-step)', () => {
    // If the engine's re-declared literal drifts from content/flags, this fails — guarding the moonStrata
    // idiom. The flag set on the save (the content constant) must be the one the engine reads.
    const s = { ...createDefaultSave(), flags: { [DYSON_STAGE_DONE_FLAGS[0]]: true } }
    expect(solarWorksOpen(s)).toBe(true)
  })
})

describe('solar candy collectors — the ~x100 income jump', () => {
  it('cannot build a collector before stage 1 (SAME reference, locked)', () => {
    const before = { ...createDefaultSave(), candies: createResource(1e9), rockCandy: createResource(1e6) }
    const result = buildCollector(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('locked')
    expect(result.state).toBe(before)
  })

  it('builds a collector: spends exactly candies + rock candy and ++count', () => {
    const before = open({ candies: 1_000_000_000, rockCandy: 1_000_000 })
    const result = buildCollector(before)
    expect(result.ok).toBe(true)
    expect(collectorCount(result.state)).toBe(1)
    expect(result.state.candies.current).toBe(1_000_000_000 - SOLAR_COLLECTOR_CANDY_COST)
    expect(result.state.rockCandy.current).toBe(1_000_000 - SOLAR_COLLECTOR_ROCK_CANDY_COST)
  })

  it('refuses when candies are short (SAME reference, no rock candy spent)', () => {
    const before = open({ candies: SOLAR_COLLECTOR_CANDY_COST - 1, rockCandy: 1_000_000 })
    const result = buildCollector(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
    expect(before.rockCandy.current).toBe(1_000_000) // nothing touched — no partial spend
  })

  it('refuses when rock candy is short (SAME reference, no candies spent)', () => {
    const before = open({ candies: 1_000_000_000, rockCandy: SOLAR_COLLECTOR_ROCK_CANDY_COST - 1 })
    const result = buildCollector(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
    expect(before.candies.current).toBe(1_000_000_000) // candies untouched (rock candy checked second)
  })

  it('never overdrafts at exactly the cost', () => {
    const before = open({ candies: SOLAR_COLLECTOR_CANDY_COST, rockCandy: SOLAR_COLLECTOR_ROCK_CANDY_COST })
    const result = buildCollector(before)
    expect(result.ok).toBe(true)
    expect(result.state.candies.current).toBe(0)
    expect(result.state.rockCandy.current).toBe(0)
    expect(collectorCount(result.state)).toBe(1)
  })

  it('the count only ever rises (building again ++ from the prior count)', () => {
    const before = open({ collectors: 7, candies: 1e9, rockCandy: 1e6 })
    const result = buildCollector(before)
    expect(collectorCount(result.state)).toBe(8)
  })

  it('canBuildCollector mirrors the stage-1 gate + both costs', () => {
    expect(canBuildCollector(open())).toBe(true)
    expect(canBuildCollector(createDefaultSave())).toBe(false) // stage 1 not raised
    expect(canBuildCollector(open({ candies: SOLAR_COLLECTOR_CANDY_COST - 1 }))).toBe(false)
    expect(canBuildCollector(open({ rockCandy: SOLAR_COLLECTOR_ROCK_CANDY_COST - 1 }))).toBe(false)
  })

  it('solarCandyRate scales with the count (0 at 0, 0 pre-stage-1)', () => {
    expect(solarCandyRate(open({ collectors: 0 }))).toBe(0)
    expect(solarCandyRate(open({ collectors: 5 }))).toBeCloseTo(5 * SOLAR_CANDY_PER_COLLECTOR_PER_SEC)
    // honest even if a stray count slips into save data before the gate
    const stray = { ...createDefaultSave(), numbers: { [SOLAR_COLLECTOR_KEY]: 9 } }
    expect(solarCandyRate(stray)).toBe(0)
  })

  it('does not mutate the input state (immutability)', () => {
    const before = open({ candies: 1e9, rockCandy: 1e6 })
    const candiesRef = before.candies
    const rockRef = before.rockCandy
    buildCollector(before)
    expect(before.candies).toBe(candiesRef)
    expect(before.rockCandy).toBe(rockRef)
    expect(collectorCount(before)).toBe(0)
  })
})

describe('the solar-caramel collector — the scaling caramel faucet', () => {
  it('cannot build before stage 1 (SAME reference, locked)', () => {
    const before = { ...createDefaultSave(), candies: createResource(1e9) }
    const result = buildCaramelCollector(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('locked')
    expect(result.state).toBe(before)
  })

  it('builds a caramel collector: spends exactly candies (NO caramel cost) and ++count', () => {
    const before = open({ candies: 1_000_000_000 })
    const caramelBefore = before.caramel.current
    const result = buildCaramelCollector(before)
    expect(result.ok).toBe(true)
    expect(caramelCollectorCount(result.state)).toBe(1)
    expect(result.state.candies.current).toBe(1_000_000_000 - CARAMEL_COLLECTOR_CANDY_COST)
    // the anti-soft-lock invariant: caramel's own faucet is NEVER gated on caramel
    expect(result.state.caramel.current).toBe(caramelBefore)
  })

  it('refuses when candies are short (SAME reference)', () => {
    const before = open({ candies: CARAMEL_COLLECTOR_CANDY_COST - 1 })
    const result = buildCaramelCollector(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
  })

  it('canBuildCaramelCollector mirrors the stage-1 gate + the candy cost', () => {
    expect(canBuildCaramelCollector(open())).toBe(true)
    expect(canBuildCaramelCollector(createDefaultSave())).toBe(false)
    expect(canBuildCaramelCollector(open({ candies: CARAMEL_COLLECTOR_CANDY_COST - 1 }))).toBe(false)
  })

  it('solarCaramelRate scales with the count (0 at 0, 0 pre-stage-1)', () => {
    expect(solarCaramelRate(open({ caramelCollectors: 0 }))).toBe(0)
    expect(solarCaramelRate(open({ caramelCollectors: 4 }))).toBeCloseTo(4 * CARAMEL_PER_COLLECTOR_PER_SEC)
    const stray = { ...createDefaultSave(), numbers: { [CARAMEL_COLLECTOR_KEY]: 9 } }
    expect(solarCaramelRate(stray)).toBe(0)
  })

  it('the count only ever rises', () => {
    const before = open({ caramelCollectors: 3, candies: 1e9 })
    const result = buildCaramelCollector(before)
    expect(caramelCollectorCount(result.state)).toBe(4)
  })
})

describe('the two collectors are independent', () => {
  it('building a candy collector leaves the caramel count alone, and vice versa', () => {
    const candyBuilt = buildCollector(open({ candies: 1e9, rockCandy: 1e6 })).state
    expect(collectorCount(candyBuilt)).toBe(1)
    expect(caramelCollectorCount(candyBuilt)).toBe(0)

    const caramelBuilt = buildCaramelCollector(open({ candies: 1e9 })).state
    expect(caramelCollectorCount(caramelBuilt)).toBe(1)
    expect(collectorCount(caramelBuilt)).toBe(0)
  })
})

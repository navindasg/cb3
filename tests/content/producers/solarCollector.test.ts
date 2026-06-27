import { createDefaultSave } from '@/engine/state/defaultSave'
import { tick } from '@/engine/loop/tick'
import { productionRate } from '@/engine/loop/production'
import {
  SOLAR_COLLECTOR_PRODUCERS,
} from '@/content/producers/solarCollector'
import {
  SOLAR_COLLECTOR_KEY,
  SOLAR_CANDY_PER_COLLECTOR_PER_SEC,
} from '@/content/sun/solarWorks'
import { DYSON_STAGE_DONE_FLAGS } from '@/content/flags'
import type { GameState } from '@/engine/types/GameState'

const STAGE1 = DYSON_STAGE_DONE_FLAGS[0]

/** A save with stage 1 raised and a chosen collector count. */
const withCollectors = (n: number): GameState => {
  const s = createDefaultSave()
  return {
    ...s,
    flags: { ...s.flags, [STAGE1]: true },
    numbers: { ...s.numbers, [SOLAR_COLLECTOR_KEY]: n },
  }
}

describe('solar candy collectors (the stage-1 ~x100 income jump)', () => {
  it('produces nothing before stage 1 is raised — even with a count set', () => {
    // a stray count without the flag must not leak income (the gate is in getRate)
    const noStage = { ...createDefaultSave(), numbers: { [SOLAR_COLLECTOR_KEY]: 100 } }
    expect(productionRate(noStage, SOLAR_COLLECTOR_PRODUCERS, 'candies')).toBe(0)
  })

  it('produces nothing at zero collectors (stage 1 raised, none hung)', () => {
    expect(productionRate(withCollectors(0), SOLAR_COLLECTOR_PRODUCERS, 'candies')).toBe(0)
  })

  it('getRate = count * per-collector rate', () => {
    expect(productionRate(withCollectors(1), SOLAR_COLLECTOR_PRODUCERS, 'candies')).toBeCloseTo(
      SOLAR_CANDY_PER_COLLECTOR_PER_SEC,
    )
    expect(productionRate(withCollectors(37), SOLAR_COLLECTOR_PRODUCERS, 'candies')).toBeCloseTo(
      37 * SOLAR_CANDY_PER_COLLECTOR_PER_SEC,
    )
  })

  it('the tick sum includes the collectors (candies accrue over game time)', () => {
    const before = withCollectors(10)
    const after = tick(before, 60_000, SOLAR_COLLECTOR_PRODUCERS)
    // the default save starts with a baseline candy (the candy-box idiom), so assert the DELTA
    expect(after.candies.current - before.candies.current).toBeCloseTo(
      10 * SOLAR_CANDY_PER_COLLECTOR_PER_SEC * 60,
    )
  })

  it('produces only candies, never caramel (a distinct resource)', () => {
    expect(productionRate(withCollectors(10), SOLAR_COLLECTOR_PRODUCERS, 'caramel')).toBe(0)
  })

  it('§5 magnitude: a modest fleet dwarfs the Act-2 candy economy (~10k/s) by ~x100', () => {
    // Design §5: stage-1 collectors take candy/s from Act-2's ~10k/s to ~1M+/s. A fleet of 100 collectors
    // must clear ~1M/s — at least 100x a representative Act-2 candy/s figure. This is a sanity floor on
    // SOLAR_CANDY_PER_COLLECTOR_PER_SEC so the headline income jump can't silently be tuned away.
    const ACT2_CANDY_PER_SEC = 10_000
    const fleetRate = productionRate(withCollectors(100), SOLAR_COLLECTOR_PRODUCERS, 'candies')
    expect(fleetRate).toBeGreaterThanOrEqual(1_000_000)
    expect(fleetRate / ACT2_CANDY_PER_SEC).toBeGreaterThanOrEqual(100)
  })
})

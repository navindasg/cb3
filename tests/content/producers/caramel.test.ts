import { createDefaultSave } from '@/engine/state/defaultSave'
import { tick } from '@/engine/loop/tick'
import { productionRate } from '@/engine/loop/production'
import { applyOfflineCatchup } from '@/engine/loop/catchup'
import { CARAMEL_PRODUCERS } from '@/content/producers/caramel'
import {
  CARAMEL_COLLECTOR_KEY,
  CARAMEL_PER_COLLECTOR_PER_SEC,
} from '@/content/sun/solarWorks'
import { DYSON_STAGE_DONE_FLAGS } from '@/content/flags'
import type { GameState } from '@/engine/types/GameState'

const STAGE1 = DYSON_STAGE_DONE_FLAGS[0]
const HOUR = 3_600_000

/** A save with stage 1 raised and a chosen caramel-collector count. */
const withCaramelCollectors = (n: number): GameState => {
  const s = createDefaultSave()
  return {
    ...s,
    flags: { ...s.flags, [STAGE1]: true },
    numbers: { ...s.numbers, [CARAMEL_COLLECTOR_KEY]: n },
  }
}

describe('the solar-caramel collector (caramel\'s first passive faucet)', () => {
  it('produces nothing before stage 1 is raised — even with a count set', () => {
    const noStage = { ...createDefaultSave(), numbers: { [CARAMEL_COLLECTOR_KEY]: 50 } }
    expect(productionRate(noStage, CARAMEL_PRODUCERS, 'caramel')).toBe(0)
  })

  it('produces nothing at zero caramel collectors', () => {
    expect(productionRate(withCaramelCollectors(0), CARAMEL_PRODUCERS, 'caramel')).toBe(0)
  })

  it('getRate = count * per-collector rate', () => {
    expect(productionRate(withCaramelCollectors(1), CARAMEL_PRODUCERS, 'caramel')).toBeCloseTo(
      CARAMEL_PER_COLLECTOR_PER_SEC,
    )
    expect(productionRate(withCaramelCollectors(12), CARAMEL_PRODUCERS, 'caramel')).toBeCloseTo(
      12 * CARAMEL_PER_COLLECTOR_PER_SEC,
    )
  })

  it('the tick sum includes the caramel collectors (caramel accrues over game time)', () => {
    const after = tick(withCaramelCollectors(8), 60_000, CARAMEL_PRODUCERS)
    expect(after.caramel.current).toBeCloseTo(8 * CARAMEL_PER_COLLECTOR_PER_SEC * 60)
  })

  it('produces only caramel, never candies (a distinct resource)', () => {
    expect(productionRate(withCaramelCollectors(8), CARAMEL_PRODUCERS, 'candies')).toBe(0)
  })

  it('caramel rises OFFLINE via the deterministic catch-up path (not a live poll)', () => {
    // The passive-producer e2e gotcha: never poll a live rAF tick. Drive the offline catch-up reducer with
    // a fixed elapsed window and a generous cap so the whole window applies, then assert the credited
    // caramel matches rate * elapsed deterministically.
    const before = withCaramelCollectors(20)
    const elapsedMs = HOUR
    const { state } = applyOfflineCatchup(before, elapsedMs, CARAMEL_PRODUCERS, { capMs: 24 * HOUR })
    const expected = 20 * CARAMEL_PER_COLLECTOR_PER_SEC * (elapsedMs / 1000)
    expect(state.caramel.current).toBeCloseTo(expected)
  })

  it('credits NOTHING offline before stage 1 (the gate holds through catch-up too)', () => {
    const noStage = { ...createDefaultSave(), numbers: { [CARAMEL_COLLECTOR_KEY]: 20 } }
    const { state } = applyOfflineCatchup(noStage, HOUR, CARAMEL_PRODUCERS, { capMs: 24 * HOUR })
    expect(state.caramel.current).toBe(noStage.caramel.current)
  })
})

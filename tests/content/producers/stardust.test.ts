import { createDefaultSave } from '@/engine/state/defaultSave'
import { tick } from '@/engine/loop/tick'
import { productionRate } from '@/engine/loop/production'
import { applyOfflineCatchup } from '@/engine/loop/catchup'
import { STARDUST_PRODUCERS } from '@/content/producers/stardust'
import { STAR_TRAWLER_KEY, STARDUST_PER_TRAWLER_PER_SEC } from '@/content/sun/starSea'
import { DYSON_STAGE_DONE_FLAGS } from '@/content/flags'
import type { GameState } from '@/engine/types/GameState'

const STAGE3 = DYSON_STAGE_DONE_FLAGS[2]
const HOUR = 3_600_000

/** A save with stage 3 raised and a chosen star-trawler count. */
const withTrawlers = (n: number): GameState => {
  const s = createDefaultSave()
  return {
    ...s,
    flags: { ...s.flags, [STAGE3]: true },
    numbers: { ...s.numbers, [STAR_TRAWLER_KEY]: n },
  }
}

describe('star-trawlers (stardust\'s first passive source)', () => {
  it('produces nothing before stage 3 is raised — even with a count set', () => {
    // a stray count without the flag must not leak income (the gate is in getRate)
    const noStage = { ...createDefaultSave(), numbers: { [STAR_TRAWLER_KEY]: 100 } }
    expect(productionRate(noStage, STARDUST_PRODUCERS, 'stardust')).toBe(0)
  })

  it('produces nothing at zero trawlers (stage 3 raised, none launched)', () => {
    expect(productionRate(withTrawlers(0), STARDUST_PRODUCERS, 'stardust')).toBe(0)
  })

  it('produces nothing when the trawler count key is absent entirely (the ?? 0 default)', () => {
    // a save fresh past stage 3 has the flag but no count key at all — the nullish default must hold at 0.
    const s = createDefaultSave()
    const fresh = { ...s, flags: { ...s.flags, [STAGE3]: true } }
    expect(fresh.numbers[STAR_TRAWLER_KEY]).toBeUndefined()
    expect(productionRate(fresh, STARDUST_PRODUCERS, 'stardust')).toBe(0)
  })

  it('getRate = count * per-trawler rate', () => {
    expect(productionRate(withTrawlers(1), STARDUST_PRODUCERS, 'stardust')).toBeCloseTo(
      STARDUST_PER_TRAWLER_PER_SEC,
    )
    expect(productionRate(withTrawlers(40), STARDUST_PRODUCERS, 'stardust')).toBeCloseTo(
      40 * STARDUST_PER_TRAWLER_PER_SEC,
    )
  })

  it('the tick sum includes the trawlers (stardust accrues over game time)', () => {
    const before = withTrawlers(20)
    const after = tick(before, 60_000, STARDUST_PRODUCERS)
    expect(after.stardust.current - before.stardust.current).toBeCloseTo(
      20 * STARDUST_PER_TRAWLER_PER_SEC * 60,
    )
  })

  it('produces only stardust, never candies (a distinct resource)', () => {
    expect(productionRate(withTrawlers(20), STARDUST_PRODUCERS, 'candies')).toBe(0)
  })

  it('stardust rises OFFLINE via the deterministic catch-up path (not a live poll)', () => {
    // The passive-producer e2e gotcha: never poll a live rAF tick. Drive the offline catch-up reducer with
    // a fixed elapsed window + generous cap, then assert the credited stardust matches rate * elapsed.
    const before = withTrawlers(20)
    const elapsedMs = HOUR
    const { state } = applyOfflineCatchup(before, elapsedMs, STARDUST_PRODUCERS, { capMs: 24 * HOUR })
    const expected = 20 * STARDUST_PER_TRAWLER_PER_SEC * (elapsedMs / 1000)
    expect(state.stardust.current - before.stardust.current).toBeCloseTo(expected)
  })

  it('credits NOTHING offline before stage 3 (the gate holds through catch-up too)', () => {
    const noStage = { ...createDefaultSave(), numbers: { [STAR_TRAWLER_KEY]: 20 } }
    const { state } = applyOfflineCatchup(noStage, HOUR, STARDUST_PRODUCERS, { capMs: 24 * HOUR })
    expect(state.stardust.current).toBe(noStage.stardust.current)
  })
})

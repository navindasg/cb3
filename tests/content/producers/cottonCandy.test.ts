import { createDefaultSave } from '@/engine/state/defaultSave'
import { tick } from '@/engine/loop/tick'
import { productionRate } from '@/engine/loop/production'
import { COTTON_CANDY_PRODUCERS } from '@/content/producers/cottonCandy'
import { PADDOCK_CONFIG, CLOUD_SHEEP_COUNT_KEY } from '@/content/sky/paddock'
import type { GameState } from '@/engine/types/GameState'

const withSheep = (n: number): GameState => ({
  ...createDefaultSave(),
  numbers: { [CLOUD_SHEEP_COUNT_KEY]: n },
})

describe('cotton candy producers (the cloud sheep paddock)', () => {
  it('produces nothing with no sheep', () => {
    expect(productionRate(createDefaultSave(), COTTON_CANDY_PRODUCERS, 'cottonCandy')).toBe(0)
  })

  it('scales the rate linearly with the owned sheep count', () => {
    expect(productionRate(withSheep(1), COTTON_CANDY_PRODUCERS, 'cottonCandy')).toBeCloseTo(
      PADDOCK_CONFIG.cottonPerSheepPerSec,
    )
    expect(productionRate(withSheep(5), COTTON_CANDY_PRODUCERS, 'cottonCandy')).toBeCloseTo(
      5 * PADDOCK_CONFIG.cottonPerSheepPerSec,
    )
  })

  it('does not produce candies (a distinct resource)', () => {
    expect(productionRate(withSheep(5), COTTON_CANDY_PRODUCERS, 'candies')).toBe(0)
  })

  it('the tick accrues cotton candy over game time for a stocked paddock', () => {
    const state = withSheep(10)
    // 10 sheep * rate/s for 60s of game time.
    const after = tick(state, 60_000, COTTON_CANDY_PRODUCERS)
    expect(after.cottonCandy.current).toBeCloseTo(10 * PADDOCK_CONFIG.cottonPerSheepPerSec * 60)
  })

  it('treats a fractional/garbage sheep count as a floored, non-negative head-count', () => {
    expect(productionRate(withSheep(2.9), COTTON_CANDY_PRODUCERS, 'cottonCandy')).toBeCloseTo(
      2 * PADDOCK_CONFIG.cottonPerSheepPerSec,
    )
    expect(productionRate(withSheep(-3), COTTON_CANDY_PRODUCERS, 'cottonCandy')).toBe(0)
  })
})

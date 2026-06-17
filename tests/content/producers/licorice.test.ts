import { createDefaultSave } from '@/engine/state/defaultSave'
import { tick } from '@/engine/loop/tick'
import { productionRate } from '@/engine/loop/production'
import { LICORICE_PRODUCERS, LICORICE_PER_SEC } from '@/content/producers/licorice'
import { BEANSTALK_THICKENED_FLAG } from '@/content/flags'
import type { GameState } from '@/engine/types/GameState'

const thick = (): GameState => ({
  ...createDefaultSave(),
  flags: { [BEANSTALK_THICKENED_FLAG]: true },
})

describe('licorice producers (the thickened beanstalk sheds cuttings)', () => {
  it('produces nothing before the beanstalk thickens', () => {
    expect(productionRate(createDefaultSave(), LICORICE_PRODUCERS, 'licorice')).toBe(0)
  })

  it('sheds cuttings once the beanstalk is thickened', () => {
    expect(productionRate(thick(), LICORICE_PRODUCERS, 'licorice')).toBeCloseTo(LICORICE_PER_SEC)
  })

  it('the tick accrues licorice over game time for a thickened beanstalk', () => {
    const after = tick(thick(), 60_000, LICORICE_PRODUCERS)
    expect(after.licorice.current).toBeCloseTo(LICORICE_PER_SEC * 60)
  })

  it('does not produce candies (a distinct resource)', () => {
    expect(productionRate(thick(), LICORICE_PRODUCERS, 'candies')).toBe(0)
  })
})

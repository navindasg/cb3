import { createDefaultSave } from '@/engine/state/defaultSave'
import { productionRate } from '@/engine/loop/production'
import { ROCK_CANDY_PRODUCERS } from '@/content/producers/rockCandy'
import {
  GUMMY_WORM_COUNT_KEY,
  GUMMY_FUSED_COUNT_KEY,
  GUMMY_WORK_CREW_COUNT_KEY,
  ROCK_CANDY_PER_GUMMY_PER_SEC,
  ROCK_CANDY_PER_FUSED_GUMMY_PER_SEC,
  WORK_CREW_BOOST,
} from '@/content/gummy/molds'
import { DYSON_STAGE_DONE_FLAGS } from '@/content/flags'
import type { GameState } from '@/engine/types/GameState'

const STAGE2 = DYSON_STAGE_DONE_FLAGS[1]

/** A save with grown gummies (and optionally hired work-crews behind the stage-2 flag). */
const withArmy = (over: { worms?: number; fused?: number; crews?: number; stage2?: boolean } = {}): GameState => {
  const s = createDefaultSave()
  const flags = over.stage2 ? { ...s.flags, [STAGE2]: true } : s.flags
  return {
    ...s,
    flags,
    numbers: {
      ...s.numbers,
      [GUMMY_WORM_COUNT_KEY]: over.worms ?? 0,
      [GUMMY_FUSED_COUNT_KEY]: over.fused ?? 0,
      [GUMMY_WORK_CREW_COUNT_KEY]: over.crews ?? 0,
    },
  }
}

describe('rock-candy producers — the gummy burrowers', () => {
  it('plain burrowers mine at the base rate per worm (no crews, no regression)', () => {
    expect(productionRate(withArmy({ worms: 30 }), ROCK_CANDY_PRODUCERS, 'rockCandy')).toBeCloseTo(
      30 * ROCK_CANDY_PER_GUMMY_PER_SEC,
    )
  })

  it('sour-fused burrowers add their faster trickle on top', () => {
    const rate = productionRate(withArmy({ worms: 10, fused: 10 }), ROCK_CANDY_PRODUCERS, 'rockCandy')
    expect(rate).toBeCloseTo(10 * ROCK_CANDY_PER_GUMMY_PER_SEC + 10 * ROCK_CANDY_PER_FUSED_GUMMY_PER_SEC)
  })
})

describe('rock-candy producers — the gummy work-crew multiplier (Act 3 stage-2 automation)', () => {
  it('multiplier is EXACTLY 1 with no crews — base rates unchanged (no regression)', () => {
    const base = productionRate(withArmy({ worms: 30, fused: 12 }), ROCK_CANDY_PRODUCERS, 'rockCandy')
    const expected = 30 * ROCK_CANDY_PER_GUMMY_PER_SEC + 12 * ROCK_CANDY_PER_FUSED_GUMMY_PER_SEC
    expect(base).toBeCloseTo(expected)
  })

  it('a stray crew count BEFORE stage 2 does not boost the army (the flag guard)', () => {
    // crews set but stage 2 NOT raised — the multiplier must be 1, so the rate equals the base rate.
    const strayCrews = withArmy({ worms: 30, fused: 12, crews: 8, stage2: false })
    const base = 30 * ROCK_CANDY_PER_GUMMY_PER_SEC + 12 * ROCK_CANDY_PER_FUSED_GUMMY_PER_SEC
    expect(productionRate(strayCrews, ROCK_CANDY_PRODUCERS, 'rockCandy')).toBeCloseTo(base)
  })

  it('hired crews (stage 2) scale BOTH burrower trickles by 1 + count * boost', () => {
    const crews = 4
    const mult = 1 + crews * WORK_CREW_BOOST
    const s = withArmy({ worms: 30, fused: 12, crews, stage2: true })
    const expected = (30 * ROCK_CANDY_PER_GUMMY_PER_SEC + 12 * ROCK_CANDY_PER_FUSED_GUMMY_PER_SEC) * mult
    expect(productionRate(s, ROCK_CANDY_PRODUCERS, 'rockCandy')).toBeCloseTo(expected)
  })

  it('stage-2 flag with ZERO crews is still exactly the base rate (1 + 0 = 1)', () => {
    const base = 30 * ROCK_CANDY_PER_GUMMY_PER_SEC
    expect(productionRate(withArmy({ worms: 30, crews: 0, stage2: true }), ROCK_CANDY_PRODUCERS, 'rockCandy')).toBeCloseTo(
      base,
    )
  })

  it('a bigger fleet of crews yields a strictly bigger rate (monotone in count)', () => {
    const r2 = productionRate(withArmy({ worms: 50, crews: 2, stage2: true }), ROCK_CANDY_PRODUCERS, 'rockCandy')
    const r6 = productionRate(withArmy({ worms: 50, crews: 6, stage2: true }), ROCK_CANDY_PRODUCERS, 'rockCandy')
    expect(r6).toBeGreaterThan(r2)
  })
})

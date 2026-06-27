import { createDefaultSave } from '@/engine/state/defaultSave'
import { productionRate } from '@/engine/loop/production'
import { PEPPERMINT_PRODUCERS } from '@/content/producers/peppermint'
import {
  GUMMY_MINT_FUSED_COUNT_KEY,
  GUMMY_WORK_CREW_COUNT_KEY,
  PEPPERMINT_PER_MINT_FUSED_GUMMY_PER_SEC,
  WORK_CREW_BOOST,
} from '@/content/gummy/molds'
import {
  PEPPERMINT_CONDENSER_KEY,
  PEPPERMINT_PER_CONDENSER_PER_SEC,
} from '@/content/planet/mintPlanet'
import { DYSON_STAGE_DONE_FLAGS } from '@/content/flags'
import type { GameState } from '@/engine/types/GameState'

const STAGE2 = DYSON_STAGE_DONE_FLAGS[1]

/** A save with condensers + mint-fused burrowers (and optionally hired work-crews behind the stage-2 flag). */
const withMint = (
  over: { condensers?: number; mintFused?: number; crews?: number; stage2?: boolean } = {},
): GameState => {
  const s = createDefaultSave()
  const flags = over.stage2 ? { ...s.flags, [STAGE2]: true } : s.flags
  return {
    ...s,
    flags,
    numbers: {
      ...s.numbers,
      [PEPPERMINT_CONDENSER_KEY]: over.condensers ?? 0,
      [GUMMY_MINT_FUSED_COUNT_KEY]: over.mintFused ?? 0,
      [GUMMY_WORK_CREW_COUNT_KEY]: over.crews ?? 0,
    },
  }
}

describe('peppermint producers — base rates (no crews, no regression)', () => {
  it('condensers sublimate at the base rate per unit', () => {
    expect(productionRate(withMint({ condensers: 40 }), PEPPERMINT_PRODUCERS, 'peppermint')).toBeCloseTo(
      40 * PEPPERMINT_PER_CONDENSER_PER_SEC,
    )
  })

  it('mint-fused burrowers add their trickle on top of the condensers', () => {
    const rate = productionRate(withMint({ condensers: 10, mintFused: 20 }), PEPPERMINT_PRODUCERS, 'peppermint')
    expect(rate).toBeCloseTo(10 * PEPPERMINT_PER_CONDENSER_PER_SEC + 20 * PEPPERMINT_PER_MINT_FUSED_GUMMY_PER_SEC)
  })
})

describe('peppermint producers — the gummy work-crew multiplier (Act 3 stage-2 automation)', () => {
  it('multiplier is EXACTLY 1 with no crews — base rates unchanged (no regression)', () => {
    const base = productionRate(withMint({ condensers: 40, mintFused: 20 }), PEPPERMINT_PRODUCERS, 'peppermint')
    const expected = 40 * PEPPERMINT_PER_CONDENSER_PER_SEC + 20 * PEPPERMINT_PER_MINT_FUSED_GUMMY_PER_SEC
    expect(base).toBeCloseTo(expected)
  })

  it('a stray crew count BEFORE stage 2 does not boost (the flag guard)', () => {
    const stray = withMint({ condensers: 40, mintFused: 20, crews: 8, stage2: false })
    const base = 40 * PEPPERMINT_PER_CONDENSER_PER_SEC + 20 * PEPPERMINT_PER_MINT_FUSED_GUMMY_PER_SEC
    expect(productionRate(stray, PEPPERMINT_PRODUCERS, 'peppermint')).toBeCloseTo(base)
  })

  it('hired crews (stage 2) boost ONLY the burrowers, never the inert condensers', () => {
    const crews = 4
    const mult = 1 + crews * WORK_CREW_BOOST
    const s = withMint({ condensers: 40, mintFused: 20, crews, stage2: true })
    // condensers are machines, not the army — they are NOT scaled; only the mint-fused burrower trickle is.
    const expected =
      40 * PEPPERMINT_PER_CONDENSER_PER_SEC + 20 * PEPPERMINT_PER_MINT_FUSED_GUMMY_PER_SEC * mult
    expect(productionRate(s, PEPPERMINT_PRODUCERS, 'peppermint')).toBeCloseTo(expected)
  })

  it('with condensers only and crews hired, the rate is UNCHANGED (the crews do not touch condensers)', () => {
    const noBurrowers = withMint({ condensers: 40, mintFused: 0, crews: 6, stage2: true })
    expect(productionRate(noBurrowers, PEPPERMINT_PRODUCERS, 'peppermint')).toBeCloseTo(
      40 * PEPPERMINT_PER_CONDENSER_PER_SEC,
    )
  })

  it('stage-2 flag with ZERO crews is still exactly the base rate (1 + 0 = 1)', () => {
    const base = 20 * PEPPERMINT_PER_MINT_FUSED_GUMMY_PER_SEC
    expect(
      productionRate(withMint({ mintFused: 20, crews: 0, stage2: true }), PEPPERMINT_PRODUCERS, 'peppermint'),
    ).toBeCloseTo(base)
  })
})

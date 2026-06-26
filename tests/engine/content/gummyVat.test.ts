import { createDefaultSave } from '@/engine/state/defaultSave'
import {
  growGummy,
  gummyVatOpen,
  gummyWormCount,
  gummyMiningRate,
  canGrowGummy,
  fusionUnlocked,
  gummyFusedCount,
  canGrowFused,
  growFusedGummy,
  gummyMintFusedCount,
  gummyPeppermintRate,
  canGrowMintFused,
  growMintFusedGummy,
} from '@/engine/content/gummyVat'
import {
  GUMMY_WORM_COUNT_KEY,
  GUMMY_FUSED_COUNT_KEY,
  GUMMY_MINT_FUSED_COUNT_KEY,
  GUMMY_CANDY_COST,
  GUMMY_LICORICE_COST,
  GUMMY_FUSED_CANDY_COST,
  GUMMY_FUSED_LICORICE_COST,
  GUMMY_FUSED_SOUR_COST,
  GUMMY_MINT_FUSED_CANDY_COST,
  GUMMY_MINT_FUSED_LICORICE_COST,
  GUMMY_MINT_FUSED_MINT_COST,
  ROCK_CANDY_PER_GUMMY_PER_SEC,
  ROCK_CANDY_PER_FUSED_GUMMY_PER_SEC,
  PEPPERMINT_PER_MINT_FUSED_GUMMY_PER_SEC,
} from '@/content/gummy/molds'
import { ROCK_CANDY_PRODUCERS } from '@/content/producers/rockCandy'
import { PEPPERMINT_PRODUCERS } from '@/content/producers/peppermint'
import { WORM_MOLD_OWNED_FLAG, FLAVOR_FUSION_FLAG } from '@/content/flags'
import { createResource } from '@/engine/types/Resource'
import type { GameState } from '@/engine/types/GameState'

/** A state holding the worm mold (the vat opens), with candies + licorice to spend. */
const withVat = (over: { candies?: number; licorice?: number; count?: number } = {}): GameState => {
  const s = createDefaultSave()
  return {
    ...s,
    flags: { ...s.flags, [WORM_MOLD_OWNED_FLAG]: true },
    numbers: { ...s.numbers, [GUMMY_WORM_COUNT_KEY]: over.count ?? 0 },
    candies: { current: over.candies ?? 1000, lifetimeAccumulated: 1000, historicalMax: 1000 },
    licorice: { current: over.licorice ?? 50, lifetimeAccumulated: 50, historicalMax: 50 },
  }
}

describe('the gummy vat — availability + growing', () => {
  it('is shut without the worm mold and open with it', () => {
    expect(gummyVatOpen(createDefaultSave())).toBe(false)
    expect(gummyVatOpen(withVat())).toBe(true)
  })

  it('starts with no burrowers', () => {
    expect(gummyWormCount(withVat())).toBe(0)
  })

  it('grows a worm gummy, spending candies + a licorice essence', () => {
    const before = withVat({ candies: 1000, licorice: 50 })
    const result = growGummy(before)
    expect(result.ok).toBe(true)
    expect(gummyWormCount(result.state)).toBe(1)
    expect(result.state.candies.current).toBe(1000 - GUMMY_CANDY_COST)
    expect(result.state.licorice.current).toBe(50 - GUMMY_LICORICE_COST)
  })

  it('refuses to grow without the worm mold (same reference)', () => {
    const before = createDefaultSave()
    const result = growGummy(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('noMold')
    expect(result.state).toBe(before)
  })

  it('refuses to grow when candies are short (same reference, no licorice spent)', () => {
    const before = withVat({ candies: GUMMY_CANDY_COST - 1, licorice: 50 })
    const result = growGummy(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
    expect(before.licorice.current).toBe(50) // licorice untouched on a failed grow
  })

  it('refuses to grow when licorice is short (same reference)', () => {
    const before = withVat({ candies: 1000, licorice: GUMMY_LICORICE_COST - 1 })
    const result = growGummy(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
  })

  it('canGrowGummy mirrors growGummy affordability + the mold gate', () => {
    expect(canGrowGummy(withVat())).toBe(true)
    expect(canGrowGummy(createDefaultSave())).toBe(false) // no mold
    expect(canGrowGummy(withVat({ candies: 0 }))).toBe(false)
    expect(canGrowGummy(withVat({ licorice: 0 }))).toBe(false)
  })

  it('does not mutate the input state', () => {
    const before = withVat({ candies: 1000, licorice: 50 })
    growGummy(before)
    expect(before.candies.current).toBe(1000)
    expect(before.licorice.current).toBe(50)
    expect(gummyWormCount(before)).toBe(0)
  })
})

describe('the gummy vat — passive rock-candy mining', () => {
  it('the mining rate scales with the number of burrowers', () => {
    expect(gummyMiningRate(withVat({ count: 0 }))).toBe(0)
    expect(gummyMiningRate(withVat({ count: 6 }))).toBeCloseTo(6 * ROCK_CANDY_PER_GUMMY_PER_SEC)
  })

  it('the rock-candy producer feeds rock candy at the burrowers rate', () => {
    const [producer] = ROCK_CANDY_PRODUCERS
    expect(producer!.resource).toBe('rockCandy')
    expect(producer!.getRate(withVat({ count: 0 }))).toBe(0)
    expect(producer!.getRate(withVat({ count: 6 }))).toBeCloseTo(6 * ROCK_CANDY_PER_GUMMY_PER_SEC)
    // No mold yet, but a stale count still produces (the count is the only driver — by design).
    expect(producer!.getRate(withVat({ count: 3 }))).toBeCloseTo(3 * ROCK_CANDY_PER_GUMMY_PER_SEC)
  })
})

/** A vat state that has ALSO learned flavor fusion, with sour essence + fused-count overrides. */
const withFusion = (over: { candies?: number; licorice?: number; sour?: number; fused?: number } = {}): GameState => {
  const s = withVat({ candies: over.candies, licorice: over.licorice })
  return {
    ...s,
    flags: { ...s.flags, [FLAVOR_FUSION_FLAG]: true },
    numbers: { ...s.numbers, [GUMMY_FUSED_COUNT_KEY]: over.fused ?? 0 },
    sour: createResource(over.sour ?? 10),
  }
}

describe('the gummy vat — flavor fusion (the sour planet payoff)', () => {
  it('fusion is locked until the gummy folk teach it', () => {
    expect(fusionUnlocked(withVat())).toBe(false) // vat open, fusion not learned
    expect(fusionUnlocked(withFusion())).toBe(true)
  })

  it('grows a sour-fused burrower, spending candies + licorice + a sour essence', () => {
    const before = withFusion({ candies: 1000, licorice: 50, sour: 10 })
    const result = growFusedGummy(before)
    expect(result.ok).toBe(true)
    expect(gummyFusedCount(result.state)).toBe(1)
    expect(result.state.candies.current).toBe(1000 - GUMMY_FUSED_CANDY_COST)
    expect(result.state.licorice.current).toBe(50 - GUMMY_FUSED_LICORICE_COST)
    expect(result.state.sour.current).toBe(10 - GUMMY_FUSED_SOUR_COST)
  })

  it('refuses to grow a fused burrower before fusion is learned (same reference)', () => {
    const before = withVat({ candies: 1000, licorice: 50 })
    const result = growFusedGummy(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('locked')
    expect(result.state).toBe(before)
  })

  it('refuses to grow a fused burrower without sour essence (same reference)', () => {
    const before = withFusion({ candies: 1000, licorice: 50, sour: 0 })
    const result = growFusedGummy(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
  })

  it('refuses to grow a fused burrower when licorice is short (same reference, nothing spent)', () => {
    const before = withFusion({ candies: 1000, licorice: GUMMY_FUSED_LICORICE_COST - 1, sour: 10 })
    const result = growFusedGummy(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
    expect(before.sour.current).toBe(10) // sour untouched on a failed grow
  })

  it('canGrowFused mirrors the fusion gate + all three input costs', () => {
    expect(canGrowFused(withFusion())).toBe(true)
    expect(canGrowFused(withVat())).toBe(false) // fusion not learned
    expect(canGrowFused(withFusion({ sour: 0 }))).toBe(false)
    expect(canGrowFused(withFusion({ candies: 0 }))).toBe(false)
  })

  it('fused burrowers mine faster than plain ones, and the rate sums both kinds', () => {
    expect(ROCK_CANDY_PER_FUSED_GUMMY_PER_SEC).toBeGreaterThan(ROCK_CANDY_PER_GUMMY_PER_SEC)
    const mixed = { ...withFusion({ fused: 4 }), numbers: { [GUMMY_WORM_COUNT_KEY]: 6, [GUMMY_FUSED_COUNT_KEY]: 4 } }
    expect(gummyMiningRate(mixed as GameState)).toBeCloseTo(
      6 * ROCK_CANDY_PER_GUMMY_PER_SEC + 4 * ROCK_CANDY_PER_FUSED_GUMMY_PER_SEC,
    )
  })

  it('the fused-burrower producer feeds rock candy at the faster rate', () => {
    const fused = ROCK_CANDY_PRODUCERS.find((p) => p.id === 'gummyFusedBurrowers')!
    expect(fused.resource).toBe('rockCandy')
    expect(fused.getRate(withFusion({ fused: 5 }))).toBeCloseTo(5 * ROCK_CANDY_PER_FUSED_GUMMY_PER_SEC)
  })
})

/** A fusion-learned vat state with mint essence + mint-fused-count overrides. */
const withMint = (over: { candies?: number; licorice?: number; mint?: number; mintFused?: number } = {}): GameState => {
  const s = withFusion({ candies: over.candies, licorice: over.licorice })
  return {
    ...s,
    numbers: { ...s.numbers, [GUMMY_MINT_FUSED_COUNT_KEY]: over.mintFused ?? 0 },
    mint: createResource(over.mint ?? 10),
  }
}

describe('the gummy vat — the mint burrower (the frost wyrm payoff, mines peppermint)', () => {
  it('grows a mint-fused burrower, spending candies + licorice + a mint essence', () => {
    const before = withMint({ candies: 1000, licorice: 50, mint: 10 })
    const result = growMintFusedGummy(before)
    expect(result.ok).toBe(true)
    expect(gummyMintFusedCount(result.state)).toBe(1)
    expect(result.state.candies.current).toBe(1000 - GUMMY_MINT_FUSED_CANDY_COST)
    expect(result.state.licorice.current).toBe(50 - GUMMY_MINT_FUSED_LICORICE_COST)
    expect(result.state.mint.current).toBe(10 - GUMMY_MINT_FUSED_MINT_COST)
  })

  it('refuses before fusion is learned (same reference)', () => {
    const before = { ...withVat({ candies: 1000, licorice: 50 }), mint: createResource(10) }
    const result = growMintFusedGummy(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('locked')
    expect(result.state).toBe(before)
  })

  it('refuses without mint essence (same reference, nothing spent)', () => {
    const before = withMint({ candies: 1000, licorice: 50, mint: 0 })
    const result = growMintFusedGummy(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
    expect(before.licorice.current).toBe(50) // licorice untouched on a failed grow
  })

  it('canGrowMintFused mirrors the fusion gate + all three input costs', () => {
    expect(canGrowMintFused(withMint())).toBe(true)
    expect(canGrowMintFused({ ...withVat(), mint: createResource(10) } as GameState)).toBe(false) // no fusion
    expect(canGrowMintFused(withMint({ mint: 0 }))).toBe(false)
    expect(canGrowMintFused(withMint({ candies: 0 }))).toBe(false)
  })

  it('mint burrowers mine PEPPERMINT (the §184 gate resource), scaling with the count', () => {
    expect(gummyPeppermintRate(withMint({ mintFused: 0 }))).toBe(0)
    expect(gummyPeppermintRate(withMint({ mintFused: 8 }))).toBeCloseTo(8 * PEPPERMINT_PER_MINT_FUSED_GUMMY_PER_SEC)
  })

  it('the mint-burrower producer feeds PEPPERMINT (a pure faucet toward the gate)', () => {
    const prod = PEPPERMINT_PRODUCERS.find((p) => p.id === 'gummyMintBurrowers')!
    expect(prod.resource).toBe('peppermint')
    expect(prod.getRate(withMint({ mintFused: 5 }))).toBeCloseTo(5 * PEPPERMINT_PER_MINT_FUSED_GUMMY_PER_SEC)
  })
})

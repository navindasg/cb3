import { createDefaultSave } from '@/engine/state/defaultSave'
import {
  mineStratum,
  upgradePick,
  currentStratum,
  nextPick,
  moonPickTier,
  stratumProgress,
  canMine,
  canUpgradePick,
  wormTunnelsOpen,
  miningYieldMultiplier,
} from '@/engine/content/moonStrata'
import {
  MOON_STRATA,
  MOON_PICKS,
  MOON_PICK_TIER_KEY,
  MOON_STRATUM_KEY,
  WORM_TUNNEL_MIN_STRATUM,
  WORM_MOLD_YIELD_MULT,
} from '@/content/moon/strata'
import { WORM_MOLD_OWNED_FLAG } from '@/content/flags'
import type { GameState } from '@/engine/types/GameState'

const withMoon = (over: Partial<Record<string, number>> = {}): GameState => ({
  ...createDefaultSave(),
  numbers: { [MOON_PICK_TIER_KEY]: 1, ...over },
  candies: { current: 10_000_000, lifetimeAccumulated: 10_000_000, historicalMax: 10_000_000 },
  rockCandy: { current: 10_000, lifetimeAccumulated: 10_000, historicalMax: 10_000 },
})

/** A moon state carrying the worm mold (its mining-yield boost is active). */
const withMold = (over: Partial<Record<string, number>> = {}): GameState => {
  const s = withMoon(over)
  return { ...s, flags: { ...s.flags, [WORM_MOLD_OWNED_FLAG]: true } }
}

describe('jawbreaker-moon strata mining', () => {
  it('starts on the first stratum', () => {
    expect(currentStratum(withMoon(), MOON_STRATA)?.id).toBe(MOON_STRATA[0]!.id)
  })

  it('a dig yields the stratum rock candy and sinks one dig', () => {
    const before = withMoon()
    const result = mineStratum(before, MOON_STRATA)
    expect(result.ok).toBe(true)
    expect(result.gained).toBe(MOON_STRATA[0]!.yieldPerDig)
    expect(result.state.rockCandy.current).toBe(before.rockCandy.current + MOON_STRATA[0]!.yieldPerDig)
    expect(stratumProgress(result.state)).toBe(1)
    expect(result.advanced).toBe(false)
  })

  it('breaks through to the next stratum after digsToClear digs', () => {
    let s = withMoon()
    const toClear = MOON_STRATA[0]!.digsToClear
    let last
    for (let i = 0; i < toClear; i++) {
      last = mineStratum(s, MOON_STRATA)
      s = last.state
    }
    expect(last!.advanced).toBe(true)
    expect(currentStratum(s, MOON_STRATA)?.id).toBe(MOON_STRATA[1]!.id)
    expect(stratumProgress(s)).toBe(0)
  })

  it('refuses a stratum that out-hardens the pick (same reference)', () => {
    // On the 2nd stratum (requires tier 2) holding only the tier-1 candy pick.
    const before = withMoon({ [MOON_PICK_TIER_KEY]: 1, [MOON_STRATUM_KEY]: 1 })
    const result = mineStratum(before, MOON_STRATA)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('pickTooWeak')
    expect(result.state).toBe(before)
  })

  it('mines the harder stratum once the pick is strong enough', () => {
    const before = withMoon({ [MOON_PICK_TIER_KEY]: 2, [MOON_STRATUM_KEY]: 1 })
    const result = mineStratum(before, MOON_STRATA)
    expect(result.ok).toBe(true)
    expect(result.gained).toBe(MOON_STRATA[1]!.yieldPerDig)
  })

  it('reports depletion once every stratum is cleared', () => {
    const before = withMoon({ [MOON_STRATUM_KEY]: MOON_STRATA.length })
    expect(currentStratum(before, MOON_STRATA)).toBeNull()
    const result = mineStratum(before, MOON_STRATA)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('depleted')
  })
})

describe('jawbreaker-moon pick upgrades', () => {
  it('offers the next tier and buys it, spending the price', () => {
    const before = withMoon()
    const pick = nextPick(before, MOON_PICKS)
    expect(pick?.tier).toBe(2)
    const result = upgradePick(before, MOON_PICKS)
    expect(result.ok).toBe(true)
    expect(moonPickTier(result.state)).toBe(2)
    for (const line of pick!.price) {
      expect(result.state[line.resource].current).toBe(before[line.resource].current - line.amount)
    }
  })

  it('refuses an unaffordable upgrade (same reference)', () => {
    const before: GameState = {
      ...createDefaultSave(),
      numbers: { [MOON_PICK_TIER_KEY]: 1 },
      candies: { current: 0, lifetimeAccumulated: 0, historicalMax: 0 },
      rockCandy: { current: 0, lifetimeAccumulated: 0, historicalMax: 0 },
    }
    const result = upgradePick(before, MOON_PICKS)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
  })

  it('refuses once at the top of the pick ladder', () => {
    const maxed = withMoon({ [MOON_PICK_TIER_KEY]: MOON_PICKS[MOON_PICKS.length - 1]!.tier })
    expect(nextPick(maxed, MOON_PICKS)).toBeNull()
    const result = upgradePick(maxed, MOON_PICKS)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('maxTier')
  })

  it('does not mutate the input state', () => {
    const before = withMoon()
    const candiesBefore = before.candies.current
    upgradePick(before, MOON_PICKS)
    mineStratum(before, MOON_STRATA)
    expect(before.candies.current).toBe(candiesBefore)
    expect(stratumProgress(before)).toBe(0)
  })
})

describe('jawbreaker-moon gating predicates (for the wiring layer)', () => {
  it('canMine is true on a reachable stratum, false when out-hardened or depleted', () => {
    expect(canMine(withMoon(), MOON_STRATA)).toBe(true) // tier 1 on stratum 0
    expect(canMine(withMoon({ [MOON_STRATUM_KEY]: 1 }), MOON_STRATA)).toBe(false) // tier 1 on stratum 1
    expect(canMine(withMoon({ [MOON_PICK_TIER_KEY]: 2, [MOON_STRATUM_KEY]: 1 }), MOON_STRATA)).toBe(true)
    expect(canMine(withMoon({ [MOON_STRATUM_KEY]: MOON_STRATA.length }), MOON_STRATA)).toBe(false) // depleted
  })

  it('canUpgradePick mirrors upgradePick affordability', () => {
    expect(canUpgradePick(withMoon(), MOON_PICKS)).toBe(true)
    const broke: GameState = {
      ...createDefaultSave(),
      numbers: { [MOON_PICK_TIER_KEY]: 1 },
      candies: { current: 0, lifetimeAccumulated: 0, historicalMax: 0 },
      rockCandy: { current: 0, lifetimeAccumulated: 0, historicalMax: 0 },
    }
    expect(canUpgradePick(broke, MOON_PICKS)).toBe(false)
    const maxed = withMoon({ [MOON_PICK_TIER_KEY]: MOON_PICKS[MOON_PICKS.length - 1]!.tier })
    expect(canUpgradePick(maxed, MOON_PICKS)).toBe(false) // top of the ladder
  })
})

describe('the moon worm — tunnels open + the worm mold mining boost (Quest 4)', () => {
  it('the worm tunnels are shut on the surface crust and open once you dig deeper', () => {
    expect(WORM_TUNNEL_MIN_STRATUM).toBeGreaterThan(0) // not visible the instant you land
    expect(wormTunnelsOpen(withMoon())).toBe(false) // stratum 0 (the sugar crust)
    expect(wormTunnelsOpen(withMoon({ [MOON_STRATUM_KEY]: WORM_TUNNEL_MIN_STRATUM }))).toBe(true)
    expect(wormTunnelsOpen(withMoon({ [MOON_STRATUM_KEY]: MOON_STRATA.length }))).toBe(true) // still open when mined clean
  })

  it('the mining-yield multiplier is 1 without the mold and the boost value with it', () => {
    expect(miningYieldMultiplier(withMoon())).toBe(1)
    expect(miningYieldMultiplier(withMold())).toBe(WORM_MOLD_YIELD_MULT)
  })

  it('a dig with the worm mold yields the boosted haul of rock candy', () => {
    const before = withMold()
    const plain = mineStratum(withMoon(), MOON_STRATA)
    const boosted = mineStratum(before, MOON_STRATA)
    expect(boosted.gained).toBe(plain.gained * WORM_MOLD_YIELD_MULT)
    expect(boosted.state.rockCandy.current).toBe(before.rockCandy.current + boosted.gained)
    expect(stratumProgress(boosted.state)).toBe(1) // one dig sunk, exactly like the unboosted dig
  })

  it('the boost only adds rock candy — it never blocks the next pick (no soft-lock risk)', () => {
    // The crust still clears in digsToClear digs; the mold just makes each dig pay more.
    const toClear = MOON_STRATA[0]!.digsToClear
    let s = withMold()
    let last
    for (let i = 0; i < toClear; i++) {
      last = mineStratum(s, MOON_STRATA)
      s = last.state
    }
    expect(last!.advanced).toBe(true)
    expect(currentStratum(s, MOON_STRATA)?.id).toBe(MOON_STRATA[1]!.id)
  })
})

import { createDefaultSave } from '@/engine/state/defaultSave'
import {
  buyCloudSheep,
  cloudSheepCount,
  cloudSheepPrice,
} from '@/engine/content/paddock'
import { PADDOCK_CONFIG } from '@/content/sky/paddock'
import type { GameState } from '@/engine/types/GameState'

const withCandies = (n: number): GameState => ({
  ...createDefaultSave(),
  candies: { current: n, lifetimeAccumulated: n, historicalMax: n },
})

describe('the cloud sheep paddock', () => {
  it('starts empty', () => {
    expect(cloudSheepCount(createDefaultSave(), PADDOCK_CONFIG)).toBe(0)
  })

  it('prices the first sheep at the base price, then climbs per head', () => {
    expect(cloudSheepPrice(0, PADDOCK_CONFIG)).toBe(PADDOCK_CONFIG.basePrice)
    expect(cloudSheepPrice(1, PADDOCK_CONFIG)).toBe(
      Math.floor(PADDOCK_CONFIG.basePrice * PADDOCK_CONFIG.priceGrowth),
    )
    // strictly increasing
    expect(cloudSheepPrice(3, PADDOCK_CONFIG)).toBeGreaterThan(cloudSheepPrice(2, PADDOCK_CONFIG))
  })

  it('buys a sheep: spends the price and increments the head-count', () => {
    const before = withCandies(PADDOCK_CONFIG.basePrice + 100)
    const result = buyCloudSheep(before, PADDOCK_CONFIG)
    expect(result.ok).toBe(true)
    expect(result.state.candies.current).toBe(100)
    expect(cloudSheepCount(result.state, PADDOCK_CONFIG)).toBe(1)
  })

  it('charges the climbing price on the second purchase', () => {
    const first = buyCloudSheep(withCandies(1_000_000), PADDOCK_CONFIG)
    const second = buyCloudSheep(first.state, PADDOCK_CONFIG)
    expect(second.ok).toBe(true)
    const spentOnSecond = first.state.candies.current - second.state.candies.current
    expect(spentOnSecond).toBe(cloudSheepPrice(1, PADDOCK_CONFIG))
    expect(cloudSheepCount(second.state, PADDOCK_CONFIG)).toBe(2)
  })

  it('refuses an unaffordable sheep and returns the SAME reference (no-op)', () => {
    const before = withCandies(PADDOCK_CONFIG.basePrice - 1)
    const result = buyCloudSheep(before, PADDOCK_CONFIG)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
  })

  it('does not mutate the input state', () => {
    const before = withCandies(PADDOCK_CONFIG.basePrice)
    const snapshot = JSON.stringify(before)
    buyCloudSheep(before, PADDOCK_CONFIG)
    expect(JSON.stringify(before)).toBe(snapshot)
  })
})

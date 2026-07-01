import { createDefaultSave } from '@/engine/state/defaultSave'
import {
  buyCloudSheep,
  cloudSheepCount,
  cloudSheepPrice,
  shearSheep,
  shearStreakCount,
  shearStreakIndex,
  cloudWolfAvailable,
} from '@/engine/content/paddock'
import { PADDOCK_CONFIG } from '@/content/sky/paddock'
import { SHEAR_TO_REVEAL } from '@/content/sky/cloudWolf'
import { CLOUD_WOLF_REVEALED_FLAG } from '@/content/flags'
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

// The cloud-wolf shear streak (Phase 5, hidden boss 1, DESIGN §17): shearing the SAME sheep SHEAR_TO_REVEAL
// times running reveals the wolf; shearing a DIFFERENT sheep resets the streak. The reveal LATCHES (monotonic).
describe('the cloud wolf shear streak', () => {
  /** Shear `index` `times` in a row from a fresh save. */
  const shearRun = (index: number, times: number, from: GameState = createDefaultSave()): GameState => {
    let s = from
    for (let i = 0; i < times; i++) s = shearSheep(s, index)
    return s
  }

  it('starts with no streak and no wolf', () => {
    const s = createDefaultSave()
    expect(shearStreakCount(s)).toBe(0)
    expect(shearStreakIndex(s)).toBe(-1)
    expect(cloudWolfAvailable(s)).toBe(false)
  })

  it('bumps the streak when the SAME sheep is sheared, tracking its index', () => {
    const s = shearRun(2, 3)
    expect(shearStreakIndex(s)).toBe(2)
    expect(shearStreakCount(s)).toBe(3)
    expect(cloudWolfAvailable(s)).toBe(false)
  })

  it('resets the streak to (index, 1) when a DIFFERENT sheep is sheared (farm-proof)', () => {
    const almost = shearRun(0, SHEAR_TO_REVEAL - 1) // one short of the reveal
    expect(cloudWolfAvailable(almost)).toBe(false)
    const switched = shearSheep(almost, 1) // a different sheep — the streak resets
    expect(shearStreakIndex(switched)).toBe(1)
    expect(shearStreakCount(switched)).toBe(1)
    expect(cloudWolfAvailable(switched)).toBe(false)
  })

  it('reveals the wolf at exactly SHEAR_TO_REVEAL shears of the same sheep — not one before', () => {
    const before = shearRun(0, SHEAR_TO_REVEAL - 1)
    expect(before.flags[CLOUD_WOLF_REVEALED_FLAG]).toBeUndefined()
    expect(cloudWolfAvailable(before)).toBe(false)

    const revealed = shearSheep(before, 0) // the SHEAR_TO_REVEAL-th shear
    expect(shearStreakCount(revealed)).toBe(SHEAR_TO_REVEAL)
    expect(revealed.flags[CLOUD_WOLF_REVEALED_FLAG]).toBe(true)
    expect(cloudWolfAvailable(revealed)).toBe(true)
  })

  it('latches the reveal: shearing a different sheep afterward does NOT un-reveal the wolf', () => {
    const revealed = shearRun(0, SHEAR_TO_REVEAL)
    expect(cloudWolfAvailable(revealed)).toBe(true)
    const later = shearSheep(revealed, 3) // switch sheep — streak resets, but the wolf stays revealed
    expect(shearStreakCount(later)).toBe(1) // streak reset
    expect(cloudWolfAvailable(later)).toBe(true) // still revealed (latched)
  })

  it('is immutable and does not touch the input state', () => {
    const before = createDefaultSave()
    const snapshot = JSON.stringify(before)
    const next = shearSheep(before, 0)
    expect(next).not.toBe(before)
    expect(JSON.stringify(before)).toBe(snapshot)
  })
})

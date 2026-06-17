import { createDefaultSave } from '@/engine/state/defaultSave'
import {
  BEANSTALK_CLOUD_THRESHOLD,
  BEANSTALK_THICKEN_THRESHOLD,
  CANDIES_FED_KEY,
  SEED_PLANTED_FLAG,
  REACHED_CLOUDS_FLAG,
  THICKENED_FLAG,
  candiesFed,
  reachedClouds,
  plantSeed,
  feedBeanstalk,
} from '@/engine/content/beanstalk'
import type { GameState } from '@/engine/types/GameState'

/** A state with `current` candies in the balance. */
function withCandies(current: number, over: Partial<GameState> = {}): GameState {
  const base = createDefaultSave()
  return {
    ...base,
    candies: { current, lifetimeAccumulated: current, historicalMax: current },
    ...over,
  }
}

describe('planting the seed', () => {
  it('is a no-op when no seed is present (same reference)', () => {
    const state = createDefaultSave()
    expect(plantSeed(state)).toBe(state)
  })

  it('plants when the seed is present: consumes it and marks the garden planted', () => {
    const seeded: GameState = { ...createDefaultSave(), flags: { seedPresent: true } }
    const planted = plantSeed(seeded)
    expect(planted.flags[SEED_PLANTED_FLAG]).toBe(true)
    expect(planted.flags['seedPresent']).toBe(false)
  })

  it('is idempotent once planted (same reference on a re-plant)', () => {
    const seeded: GameState = { ...createDefaultSave(), flags: { seedPresent: true } }
    const planted = plantSeed(seeded)
    expect(plantSeed(planted)).toBe(planted)
  })
})

describe('feeding the beanstalk (accumulates candies fed)', () => {
  it('is a no-op for a non-positive count (same reference)', () => {
    const state = withCandies(100)
    expect(feedBeanstalk(state, 0).state).toBe(state)
    expect(feedBeanstalk(state, -5).state).toBe(state)
  })

  it('is a no-op with an empty balance (same reference)', () => {
    const state = withCandies(0)
    const result = feedBeanstalk(state, 10)
    expect(result.fed).toBe(false)
    expect(result.state).toBe(state)
  })

  it('deducts candies and advances the fed running total', () => {
    const result = feedBeanstalk(withCandies(50), 20)
    expect(result.fed).toBe(true)
    expect(result.state.candies.current).toBe(30)
    expect(candiesFed(result.state)).toBe(20)
  })

  it('caps the feed at the affordable amount (never overdrafts)', () => {
    const result = feedBeanstalk(withCandies(5), 1000)
    expect(result.state.candies.current).toBe(0)
    expect(candiesFed(result.state)).toBe(5)
  })

  it('accumulates across multiple feedings', () => {
    let state = withCandies(1000)
    state = feedBeanstalk(state, 300).state
    state = feedBeanstalk(state, 200).state
    expect(candiesFed(state)).toBe(500)
  })
})

describe('feeding to the threshold reveals the clouds (appends the sky stratum)', () => {
  it('does not reach the clouds below the threshold', () => {
    const result = feedBeanstalk(withCandies(BEANSTALK_CLOUD_THRESHOLD), BEANSTALK_CLOUD_THRESHOLD - 1)
    expect(result.reachedClouds).toBe(false)
    expect(reachedClouds(result.state)).toBe(false)
  })

  it('crosses to the clouds exactly at the threshold and sets the reveal flag', () => {
    const result = feedBeanstalk(withCandies(BEANSTALK_CLOUD_THRESHOLD), BEANSTALK_CLOUD_THRESHOLD)
    expect(result.reachedClouds).toBe(true)
    expect(result.state.flags[REACHED_CLOUDS_FLAG]).toBe(true)
    expect(reachedClouds(result.state)).toBe(true)
  })

  it('crosses on the feeding that pushes the cumulative total over the line', () => {
    let state = withCandies(BEANSTALK_CLOUD_THRESHOLD)
    const first = feedBeanstalk(state, BEANSTALK_CLOUD_THRESHOLD - 10)
    expect(first.reachedClouds).toBe(false)
    state = first.state
    const second = feedBeanstalk(state, 10)
    expect(second.reachedClouds).toBe(true)
    expect(reachedClouds(second.state)).toBe(true)
  })

  it('the reveal is idempotent: feeding again after the clouds never re-fires it', () => {
    const atClouds = feedBeanstalk(withCandies(2000), BEANSTALK_CLOUD_THRESHOLD).state
    expect(reachedClouds(atClouds)).toBe(true)
    const more = feedBeanstalk(atClouds, 100)
    expect(more.fed).toBe(true)
    expect(more.reachedClouds).toBe(false) // crossing already happened
    expect(reachedClouds(more.state)).toBe(true) // still at the clouds
    expect(candiesFed(more.state)).toBe(BEANSTALK_CLOUD_THRESHOLD + 100)
  })

  it('does not mutate the input state', () => {
    const input = withCandies(BEANSTALK_CLOUD_THRESHOLD)
    feedBeanstalk(input, BEANSTALK_CLOUD_THRESHOLD)
    expect(input.candies.current).toBe(BEANSTALK_CLOUD_THRESHOLD)
    expect(input.numbers[CANDIES_FED_KEY]).toBeUndefined()
    expect(input.flags[REACHED_CLOUDS_FLAG]).toBeUndefined()
  })
})

describe('feeding past the thicken threshold sheds licorice cuttings', () => {
  it('does not thicken below the threshold', () => {
    const result = feedBeanstalk(withCandies(BEANSTALK_THICKEN_THRESHOLD), BEANSTALK_THICKEN_THRESHOLD - 1)
    expect(result.thickened).toBe(false)
    expect(result.state.flags[THICKENED_FLAG]).toBeUndefined()
  })

  it('thickens on the feeding that crosses the threshold and sets the flag', () => {
    const result = feedBeanstalk(withCandies(BEANSTALK_THICKEN_THRESHOLD), BEANSTALK_THICKEN_THRESHOLD)
    expect(result.thickened).toBe(true)
    expect(result.state.flags[THICKENED_FLAG]).toBe(true)
  })

  it('is idempotent: feeding again after thickening never re-fires it', () => {
    const thick = feedBeanstalk(withCandies(BEANSTALK_THICKEN_THRESHOLD + 500), BEANSTALK_THICKEN_THRESHOLD).state
    const more = feedBeanstalk(thick, 100)
    expect(more.thickened).toBe(false)
    expect(more.state.flags[THICKENED_FLAG]).toBe(true)
  })

  it('a single huge feed can cross BOTH the cloud and thicken thresholds at once', () => {
    const result = feedBeanstalk(withCandies(BEANSTALK_THICKEN_THRESHOLD), BEANSTALK_THICKEN_THRESHOLD)
    expect(result.reachedClouds).toBe(true)
    expect(result.thickened).toBe(true)
  })
})

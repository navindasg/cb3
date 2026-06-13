import { createDefaultSave } from '@/engine/state/defaultSave'
import { createResource } from '@/engine/types/Resource'
import { fireSecret, fireAny, triggerFires } from '@/engine/content/secrets'
import { FOSSIL_TWITCH, WELL_INTEREST, SINGLE_LOLLIPOP_LEAF, ACT0_SECRETS } from '@/content/secrets'
import type { GameState } from '@/engine/types/GameState'

describe('fossil twitch — feed EXACTLY 1 candy', () => {
  it('fires on exactly 1 candy fed, sets fossilTwitched', () => {
    const result = fireSecret(createDefaultSave(), FOSSIL_TWITCH, {
      kind: 'feed',
      resource: 'candies',
      count: 1,
    })
    expect(result.fired).toBe(true)
    expect(result.state.flags['fossilTwitched']).toBe(true)
    expect(result.revealKey).toBe('secret.fossilTwitch.reveal')
  })

  it('does NOT fire on 2 candies, or 0', () => {
    expect(
      fireSecret(createDefaultSave(), FOSSIL_TWITCH, { kind: 'feed', resource: 'candies', count: 2 }).fired,
    ).toBe(false)
    expect(
      fireSecret(createDefaultSave(), FOSSIL_TWITCH, { kind: 'feed', resource: 'candies', count: 0 }).fired,
    ).toBe(false)
  })

  it('does not fire when feeding the wrong resource', () => {
    expect(
      fireSecret(createDefaultSave(), FOSSIL_TWITCH, { kind: 'feed', resource: 'lollipops', count: 1 }).fired,
    ).toBe(false)
  })

  it('is inert once already fired (no double-trigger, same ref)', () => {
    const fired: GameState = { ...createDefaultSave(), flags: { fossilTwitched: true } }
    const result = fireSecret(fired, FOSSIL_TWITCH, { kind: 'feed', resource: 'candies', count: 1 })
    expect(result.fired).toBe(false)
    expect(result.state).toBe(fired)
  })
})

describe('well interest — throw at the well', () => {
  it('fires on a throw at the well and grants +1 candy', () => {
    const result = fireSecret(createDefaultSave(), WELL_INTEREST, { kind: 'throw', target: 'well', count: 3 })
    expect(result.fired).toBe(true)
    expect(result.state.candies.current).toBe(2) // started at 1, +1 reward
    expect(result.state.flags['wellInterestFound']).toBe(true)
  })

  it('does not fire when thrown at something else', () => {
    expect(
      fireSecret(createDefaultSave(), WELL_INTEREST, { kind: 'throw', target: 'bucket', count: 1 }).fired,
    ).toBe(false)
  })
})

describe('single-lollipop leaf — hold exactly one lollipop', () => {
  it('fires only when holding exactly one lollipop', () => {
    const oneLollipop: GameState = { ...createDefaultSave(), lollipops: createResource(1) }
    expect(fireSecret(oneLollipop, SINGLE_LOLLIPOP_LEAF, { kind: 'hold', resource: 'lollipops' }).fired).toBe(
      true,
    )
    const twoLollipops: GameState = { ...createDefaultSave(), lollipops: createResource(2) }
    expect(fireSecret(twoLollipops, SINGLE_LOLLIPOP_LEAF, { kind: 'hold', resource: 'lollipops' }).fired).toBe(
      false,
    )
  })
})

describe('triggerFires / fireAny', () => {
  it('triggerFires reflects the match without mutating state', () => {
    expect(
      triggerFires(FOSSIL_TWITCH, { kind: 'feed', resource: 'candies', count: 1 }, createDefaultSave()),
    ).toBe(true)
  })

  it('fireAny returns the first secret that fires', () => {
    const result = fireAny(createDefaultSave(), ACT0_SECRETS, {
      kind: 'feed',
      resource: 'candies',
      count: 1,
    })
    expect(result.fired).toBe(true)
    expect(result.state.flags['fossilTwitched']).toBe(true)
  })

  it('fireAny returns a no-op miss when nothing fires', () => {
    const state = createDefaultSave()
    const result = fireAny(state, ACT0_SECRETS, { kind: 'feed', resource: 'caramel', count: 99 })
    expect(result.fired).toBe(false)
    expect(result.state).toBe(state)
  })
})

import { createDefaultSave } from '@/engine/state/defaultSave'
import {
  trackTier,
  nextTier,
  canUpgrade,
  hullAtGate,
  upgradeGalleon,
} from '@/engine/content/galleonUpgrade'
import {
  GALLEON_TRACKS,
  GALLEON_HULL_KEY,
  GALLEON_SAILS_KEY,
  GALLEON_CANNON_KEY,
} from '@/content/ship/galleonUpgrade'
import { createResource } from '@/engine/types/Resource'
import type { GameState } from '@/engine/types/GameState'

const HULL = GALLEON_TRACKS.find((t) => t.key === GALLEON_HULL_KEY)!
const SAILS = GALLEON_TRACKS.find((t) => t.key === GALLEON_SAILS_KEY)!
const CANNON = GALLEON_TRACKS.find((t) => t.key === GALLEON_CANNON_KEY)!

/** A state with a deep candy/rock-candy/cotton-candy stock (enough for any single upgrade). */
const stocked = (over: Partial<GameState> = {}): GameState => ({
  ...createDefaultSave(),
  candies: createResource(5_000_000),
  rockCandy: createResource(5_000),
  cottonCandy: createResource(5_000),
  ...over,
})

describe('the galleon yard — tiers + gating', () => {
  it('every track starts at tier 1 (the commissioned base)', () => {
    const s = createDefaultSave()
    expect(trackTier(s, GALLEON_HULL_KEY)).toBe(1)
    expect(trackTier(s, GALLEON_SAILS_KEY)).toBe(1)
    expect(trackTier(s, GALLEON_CANNON_KEY)).toBe(1)
    expect(nextTier(s, HULL)!.tier).toBe(2)
  })

  it('hullAtGate is false until the hull reaches tier 3', () => {
    expect(hullAtGate(createDefaultSave())).toBe(false)
    expect(hullAtGate({ ...createDefaultSave(), numbers: { [GALLEON_HULL_KEY]: 3 } })).toBe(true)
  })
})

describe('the galleon yard — upgrading the hull', () => {
  it('raises the hull a tier, spending its price lines', () => {
    const before = stocked()
    const result = upgradeGalleon(before, HULL)
    expect(result.ok).toBe(true)
    expect(trackTier(result.state, GALLEON_HULL_KEY)).toBe(2)
    expect(result.state.rockCandy.current).toBe(5_000 - 400)
    expect(result.state.candies.current).toBe(5_000_000 - 300_000)
  })

  it('walks the hull from 1 to the gate tier 3', () => {
    let s = stocked()
    s = upgradeGalleon(s, HULL).state
    s = upgradeGalleon(s, HULL).state
    expect(trackTier(s, GALLEON_HULL_KEY)).toBe(3)
    expect(hullAtGate(s)).toBe(true)
    expect(nextTier(s, HULL)).toBeNull() // top of the hull track
    expect(upgradeGalleon(s, HULL).ok).toBe(false)
    expect(upgradeGalleon(s, HULL).reason).toBe('maxTier')
  })

  it('refuses an unaffordable upgrade (same reference)', () => {
    const before = { ...createDefaultSave(), rockCandy: createResource(10) } // far short
    const result = upgradeGalleon(before, HULL)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
  })

  it('does not mutate the input state', () => {
    const before = stocked()
    upgradeGalleon(before, HULL)
    expect(before.rockCandy.current).toBe(5_000)
    expect(trackTier(before, GALLEON_HULL_KEY)).toBe(1)
  })

  it('does not partial-spend when a LATER price line is unaffordable (same reference)', () => {
    // hull t2 = 400 rock candy + 300k candies; afford the rock candy but NOT the candies.
    const before = { ...createDefaultSave(), rockCandy: createResource(1_000), candies: createResource(10) }
    const result = upgradeGalleon(before, HULL)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
    expect(result.state.rockCandy.current).toBe(1_000) // the first line's resource was NOT spent
  })
})

describe('the galleon yard — sails consume the storm-silk keepsake', () => {
  const withStormSilk = (): GameState => stocked({ flags: { stormSilkOwned: true }, ownedItems: { stormSilk: true } })

  it('cannot raise sails to storm-silk without the keepsake (same reference)', () => {
    const before = stocked() // no storm-silk
    expect(canUpgrade(before, SAILS)).toBe(false)
    const result = upgradeGalleon(before, SAILS)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('missingItem')
    expect(result.state).toBe(before)
  })

  it('consumes the storm-silk (clears flag + ownedItems) and raises the sail tier', () => {
    const before = withStormSilk()
    expect(canUpgrade(before, SAILS)).toBe(true)
    const result = upgradeGalleon(before, SAILS)
    expect(result.ok).toBe(true)
    expect(trackTier(result.state, GALLEON_SAILS_KEY)).toBe(2)
    expect(result.state.flags['stormSilkOwned']).toBe(false)
    expect(result.state.ownedItems['stormSilk']).toBe(false)
    expect(result.state.cottonCandy.current).toBe(5_000 - 250)
  })

  it('cannot reach solar sails (tier 3 is deferred)', () => {
    const atTwo = upgradeGalleon(withStormSilk(), SAILS).state
    expect(nextTier(atTwo, SAILS)!.tier).toBe(3)
    expect(nextTier(atTwo, SAILS)!.deferred).toBe(true)
    const result = upgradeGalleon(atTwo, SAILS)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('deferred')
  })
})

describe('the galleon yard — deferred cannon upgrades', () => {
  it('the gumball broadside is the base; pop rock guns are deferred (no material yet)', () => {
    const s = stocked()
    expect(trackTier(s, GALLEON_CANNON_KEY)).toBe(1)
    expect(nextTier(s, CANNON)!.deferred).toBe(true)
    expect(canUpgrade(s, CANNON)).toBe(false)
    expect(upgradeGalleon(s, CANNON).reason).toBe('deferred')
  })
})

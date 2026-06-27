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
import { DYSON_STAGE_DONE_FLAGS } from '@/content/flags'
import type { GameState } from '@/engine/types/GameState'

const HULL = GALLEON_TRACKS.find((t) => t.key === GALLEON_HULL_KEY)!
const SAILS = GALLEON_TRACKS.find((t) => t.key === GALLEON_SAILS_KEY)!
const CANNON = GALLEON_TRACKS.find((t) => t.key === GALLEON_CANNON_KEY)!
const STAGE3 = DYSON_STAGE_DONE_FLAGS[2]

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

})

describe('the galleon yard — solar sails (the stage-3 dyson reward)', () => {
  const withStormSilk = (): GameState => stocked({ flags: { stormSilkOwned: true }, ownedItems: { stormSilk: true } })

  /** Sail tier 2 raised (storm-silk consumed), deep candy + stardust, optionally stage-3 unlocked. */
  const atSailTier2 = (over: { stardust?: number; candies?: number; stage3?: boolean } = {}): GameState => {
    const atTwo = upgradeGalleon(withStormSilk(), SAILS).state
    return {
      ...atTwo,
      flags: over.stage3 ? { ...atTwo.flags, [STAGE3]: true } : atTwo.flags,
      candies: createResource(over.candies ?? 1_000_000_000),
      stardust: createResource(over.stardust ?? 10_000),
    }
  }

  it('solar sails (tier 3) are no longer deferred — they are flag-gated, not material-deferred', () => {
    const next = nextTier(atSailTier2(), SAILS)!
    expect(next.tier).toBe(3)
    expect(next.deferred).toBeUndefined()
    expect(next.unlockFlag).toBe('dysonStage3Done')
    expect(next.price).toBeDefined()
  })

  it('cannot fit solar sails before stage 3 — locked (SAME reference), even with the materials in hand', () => {
    const before = atSailTier2({ stage3: false, stardust: 10_000, candies: 1e9 })
    expect(canUpgrade(before, SAILS)).toBe(false)
    const result = upgradeGalleon(before, SAILS)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('locked')
    expect(result.state).toBe(before)
  })

  it('fits solar sails once stage 3 is reached, spending stardust + candies', () => {
    const before = atSailTier2({ stage3: true, stardust: 10_000, candies: 1_000_000_000 })
    const price = nextTier(before, SAILS)!.price!
    const stardustCost = price.find((l) => l.resource === 'stardust')!.amount
    const candyCost = price.find((l) => l.resource === 'candies')!.amount
    expect(canUpgrade(before, SAILS)).toBe(true)
    const result = upgradeGalleon(before, SAILS)
    expect(result.ok).toBe(true)
    expect(trackTier(result.state, GALLEON_SAILS_KEY)).toBe(3)
    expect(result.state.stardust.current).toBe(10_000 - stardustCost)
    expect(result.state.candies.current).toBe(1_000_000_000 - candyCost)
    expect(nextTier(result.state, SAILS)).toBeNull() // top of the sail track
  })

  it('refuses solar sails when stardust is short, even past stage 3 (SAME reference, unaffordable)', () => {
    const before = atSailTier2({ stage3: true, stardust: 0, candies: 1e9 })
    expect(canUpgrade(before, SAILS)).toBe(false)
    const result = upgradeGalleon(before, SAILS)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
  })
})

describe('the galleon yard — cannon upgrades (pop rocks from the comet)', () => {
  it('pop rock guns are unaffordable without pop rocks', () => {
    const s = stocked() // deep candy, but no pop rocks
    expect(trackTier(s, GALLEON_CANNON_KEY)).toBe(1)
    expect(nextTier(s, CANNON)!.deferred).toBeUndefined()
    expect(canUpgrade(s, CANNON)).toBe(false)
    expect(upgradeGalleon(s, CANNON).reason).toBe('unaffordable')
  })

  it('fits the pop rock guns once enough pop rocks are harvested, spending both lines', () => {
    const s = stocked({ popRocks: createResource(200) })
    expect(canUpgrade(s, CANNON)).toBe(true)
    const result = upgradeGalleon(s, CANNON)
    expect(result.ok).toBe(true)
    expect(trackTier(result.state, GALLEON_CANNON_KEY)).toBe(2)
    expect(result.state.popRocks.current).toBe(200 - 120)
    expect(result.state.candies.current).toBe(5_000_000 - 500_000)
  })

  it('the nougat bombard (tier 3) is deferred until a late-Act-2 forge commission', () => {
    const s = stocked({ popRocks: createResource(200), numbers: { [GALLEON_CANNON_KEY]: 2 } })
    expect(nextTier(s, CANNON)!.deferred).toBe(true)
    expect(canUpgrade(s, CANNON)).toBe(false)
    expect(upgradeGalleon(s, CANNON).reason).toBe('deferred')
  })
})

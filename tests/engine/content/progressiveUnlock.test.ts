import { createDefaultSave } from '@/engine/state/defaultSave'
import { addResource } from '@/engine/types/Resource'
import {
  isFeatureUnlocked,
  nextFeature,
  requestView,
  requestVisible,
  purchaseFeature,
} from '@/engine/content/progressiveUnlock'
import type { UnlockFeature } from '@/engine/types/defs'
import type { GameState } from '@/engine/types/GameState'

const FEATURES: readonly UnlockFeature[] = [
  { flag: 'a', price: 30 },
  { flag: 'b', price: 5 },
  { flag: 'c', price: 10 },
]

/** A state holding `n` current candies (historicalMax tracks the high-water mark). */
function withCandies(n: number, flags: Record<string, boolean> = {}): GameState {
  const s = createDefaultSave()
  return { ...s, candies: addResource(s.candies, n - s.candies.current), flags }
}

describe('progressiveUnlock', () => {
  it('nextFeature returns the first locked feature, then null when all are unlocked', () => {
    expect(nextFeature(FEATURES, withCandies(0))?.flag).toBe('a')
    expect(nextFeature(FEATURES, withCandies(0, { a: true }))?.flag).toBe('b')
    expect(nextFeature(FEATURES, withCandies(0, { a: true, b: true, c: true }))).toBeNull()
  })

  it('requestView offers the next feature and narrates the previously-unlocked one (off-by-one)', () => {
    expect(requestView(FEATURES, withCandies(0))).toEqual({ next: FEATURES[0], justUnlocked: null })
    expect(requestView(FEATURES, withCandies(0, { a: true }))).toEqual({
      next: FEATURES[1],
      justUnlocked: FEATURES[0],
    })
    expect(requestView(FEATURES, withCandies(0, { a: true, b: true, c: true }))).toEqual({
      next: null,
      justUnlocked: null,
    })
  })

  it('requestVisible gates on the candy high-water mark reaching the first price', () => {
    expect(requestVisible(FEATURES, withCandies(29))).toBe(false)
    expect(requestVisible(FEATURES, withCandies(30))).toBe(true)
  })

  it('requestVisible is false once every feature is unlocked', () => {
    expect(requestVisible(FEATURES, withCandies(999, { a: true, b: true, c: true }))).toBe(false)
  })

  it('purchaseFeature spends the price and sets the flag', () => {
    const after = purchaseFeature(withCandies(30), FEATURES[0]!)
    expect(after.flags['a']).toBe(true)
    expect(after.candies.current).toBe(0)
  })

  it('purchaseFeature is a no-op (same reference) when unaffordable or already owned', () => {
    const poor = withCandies(10)
    expect(purchaseFeature(poor, FEATURES[0]!)).toBe(poor)
    const owned = withCandies(99, { a: true })
    expect(purchaseFeature(owned, FEATURES[0]!)).toBe(owned)
  })

  it('latches: spending back below the price keeps unlocks and the request button visible (ratchet)', () => {
    // Reach 30 (historicalMax = 30), unlock 'a', then spend everything.
    const reached = withCandies(30)
    const unlocked = purchaseFeature(reached, FEATURES[0]!)
    expect(unlocked.candies.current).toBe(0)
    expect(unlocked.candies.historicalMax).toBe(30)
    // The unlock stays and the button stays visible even at zero current candies.
    expect(isFeatureUnlocked(unlocked, FEATURES[0]!)).toBe(true)
    expect(requestVisible(FEATURES, unlocked)).toBe(true)
    expect(nextFeature(FEATURES, unlocked)?.flag).toBe('b')
  })
})

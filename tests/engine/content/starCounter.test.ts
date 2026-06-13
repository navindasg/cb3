import { createDefaultSave } from '@/engine/state/defaultSave'
import {
  MS_PER_STAR,
  STARTING_STARS,
  starCounterVisible,
  projectedStars,
  reconcileStars,
} from '@/engine/content/starCounter'
import type { GameState } from '@/engine/types/GameState'

function telescopeOwned(over: Partial<GameState> = {}): GameState {
  const base = createDefaultSave()
  return {
    ...base,
    flags: { ...base.flags, telescopeOwned: true },
    numbers: { ...base.numbers, telescopeBoughtAtMs: 0 },
    ...over,
  }
}

describe('star counter visibility (telescope-gated)', () => {
  it('is hidden until the telescope is owned', () => {
    expect(starCounterVisible(createDefaultSave())).toBe(false)
  })

  it('is visible once the telescope is owned', () => {
    expect(starCounterVisible(telescopeOwned())).toBe(true)
  })

  it('starts at the perfect number 8,128', () => {
    expect(STARTING_STARS).toBe(8128)
    expect(createDefaultSave().starsRemaining).toBe(8128)
  })
})

describe('projectedStars (descends on ACCUMULATED game time, never wall-clock)', () => {
  it('returns the stored count before the telescope is bought', () => {
    expect(projectedStars(createDefaultSave())).toBe(8128)
  })

  it('loses one star per MS_PER_STAR of accumulated time since purchase', () => {
    const oneStarLater = telescopeOwned({ accumulatedGameTimeMs: MS_PER_STAR })
    expect(projectedStars(oneStarLater)).toBe(8127)
    const fiveLater = telescopeOwned({ accumulatedGameTimeMs: 5 * MS_PER_STAR })
    expect(projectedStars(fiveLater)).toBe(8123)
  })

  it('does not go below zero', () => {
    const farFuture = telescopeOwned({
      accumulatedGameTimeMs: 1e15,
      starsRemaining: 3,
    })
    expect(projectedStars(farFuture)).toBe(0)
  })

  it('measures from telescopeBoughtAtMs (a purchase mid-game), not from t=0', () => {
    // Bought at 100 * MS_PER_STAR, now 102 * MS_PER_STAR → only 2 stars lost.
    const state = telescopeOwned({
      accumulatedGameTimeMs: 102 * MS_PER_STAR,
      numbers: { telescopeBoughtAtMs: 100 * MS_PER_STAR },
    })
    expect(projectedStars(state)).toBe(8126)
  })
})

describe('reconcileStars (persists the descent into starsRemaining)', () => {
  it('returns the same reference when no whole star has elapsed', () => {
    const state = telescopeOwned({ accumulatedGameTimeMs: MS_PER_STAR - 1 })
    expect(reconcileStars(state)).toBe(state)
  })

  it('returns the same reference when the telescope is not owned', () => {
    const state = createDefaultSave()
    expect(reconcileStars(state)).toBe(state)
  })

  it('decrements starsRemaining and re-anchors the boughtAt stamp', () => {
    const state = telescopeOwned({ accumulatedGameTimeMs: 3 * MS_PER_STAR })
    const next = reconcileStars(state)
    expect(next.starsRemaining).toBe(8128 - 3)
    expect(next.numbers['telescopeBoughtAtMs']).toBe(3 * MS_PER_STAR)
  })

  it('is idempotent once re-anchored (no further loss without more time)', () => {
    const state = telescopeOwned({ accumulatedGameTimeMs: 3 * MS_PER_STAR })
    const once = reconcileStars(state)
    const twice = reconcileStars(once)
    expect(twice).toBe(once) // no new whole star elapsed
  })
})

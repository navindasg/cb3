import { createDefaultSave } from '@/engine/state/defaultSave'
import {
  MS_PER_STAR,
  STARTING_STARS,
  starCounterVisible,
  projectedStars,
  reconcileStars,
  starDescentMultiplier,
  effectiveMsPerStar,
} from '@/engine/content/starCounter'
import { STAGE_ACCEL } from '@/content/sun/observationDeck'
import { DYSON_STAGE_DONE_FLAGS } from '@/content/flags'
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

/** Telescope owned + the first `stages` dyson done-flags set (the acceleration source). */
function withStages(stages: number, over: Partial<GameState> = {}): GameState {
  const base = telescopeOwned(over)
  const flags = { ...base.flags }
  for (let i = 0; i < stages; i++) flags[DYSON_STAGE_DONE_FLAGS[i]!] = true
  return { ...base, flags }
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

describe('starDescentMultiplier (the dyson scaffold steepens the descent)', () => {
  it('is exactly 1 with no scaffold flags (back-compat — the old base rate)', () => {
    expect(starDescentMultiplier(createDefaultSave())).toBe(1)
    expect(starDescentMultiplier(telescopeOwned())).toBe(1)
  })

  it('is 1 + STAGE_ACCEL * N for N completed stages (parametric across stage counts)', () => {
    for (let n = 0; n <= DYSON_STAGE_DONE_FLAGS.length; n++) {
      expect(starDescentMultiplier(withStages(n))).toBeCloseTo(1 + STAGE_ACCEL * n)
    }
  })

  it('counts only the dyson done-flags, ignoring unrelated flags', () => {
    const s = withStages(2, { flags: { telescopeOwned: true, someOtherFlag: true } as Record<string, boolean> })
    // withStages re-adds the two stage flags over whatever `over.flags` provided; the unrelated flag must
    // not change the count of 2.
    expect(starDescentMultiplier(s)).toBeCloseTo(1 + STAGE_ACCEL * 2)
  })

  it('effectiveMsPerStar is MS_PER_STAR / the multiplier (faster fall at more stages)', () => {
    expect(effectiveMsPerStar(createDefaultSave())).toBe(MS_PER_STAR)
    expect(effectiveMsPerStar(withStages(4))).toBeCloseTo(MS_PER_STAR / (1 + STAGE_ACCEL * 4))
    // strictly fewer ms-per-star (a faster descent) with more stages
    expect(effectiveMsPerStar(withStages(5))).toBeLessThan(effectiveMsPerStar(withStages(1)))
  })
})

describe('projectedStars under acceleration (loses stars FASTER at more stages)', () => {
  it('a save with no scaffold flags loses at the base rate (back-compat)', () => {
    const base = telescopeOwned({ accumulatedGameTimeMs: 10 * MS_PER_STAR })
    expect(projectedStars(base)).toBe(8128 - 10)
  })

  it('the SAME elapsed time loses strictly more stars with more stages raised', () => {
    const elapsed = 10 * MS_PER_STAR
    const lostAt = (stages: number): number =>
      8128 - projectedStars(withStages(stages, { accumulatedGameTimeMs: elapsed }))
    // monotone non-decreasing in stages, and strictly more at the top than the base
    expect(lostAt(0)).toBe(10)
    expect(lostAt(4)).toBeGreaterThan(lostAt(0))
    expect(lostAt(5)).toBeGreaterThanOrEqual(lostAt(4))
    // at 4 stages the multiplier is 2.0, so 10 base-intervals -> 20 stars lost
    expect(lostAt(4)).toBe(20)
  })

  it('never exceeds starsRemaining (clamped at 0 even racing fast)', () => {
    const s = withStages(5, { accumulatedGameTimeMs: 1e15, starsRemaining: 4 })
    expect(projectedStars(s)).toBe(0)
  })
})

describe('reconcileStars under acceleration (re-anchors at the CURRENT rate, no drift/double-count)', () => {
  it('removes the accelerated number of stars and re-anchors at the accelerated boundary', () => {
    // 4 stages -> ×2.0 -> effectiveMsPerStar = MS_PER_STAR/2. Three base-intervals of time = 6 stars.
    const state = withStages(4, { accumulatedGameTimeMs: 3 * MS_PER_STAR })
    const next = reconcileStars(state)
    expect(next.starsRemaining).toBe(8128 - 6)
    // re-anchored to the consumed boundary at the CURRENT rate (6 × half-interval = 3 base-intervals)
    expect(next.numbers['telescopeBoughtAtMs']).toBeCloseTo(6 * (MS_PER_STAR / 2))
    expect(next.numbers['telescopeBoughtAtMs']).toBeCloseTo(3 * MS_PER_STAR)
  })

  it('a second pass with no new time is a SAME-reference no-op (no double-count)', () => {
    const state = withStages(4, { accumulatedGameTimeMs: 3 * MS_PER_STAR })
    const once = reconcileStars(state)
    const twice = reconcileStars(once)
    expect(twice).toBe(once)
  })

  it('the next pass measures fresh from the re-anchor (no drift after the rate changed)', () => {
    // Pass 1 at ×2.0 over exactly 2 base-intervals -> 4 stars, anchor re-set. Then advance one more
    // accelerated interval (half a base-interval) and reconcile again -> exactly 1 more star.
    const pass1 = reconcileStars(withStages(4, { accumulatedGameTimeMs: 2 * MS_PER_STAR }))
    expect(pass1.starsRemaining).toBe(8128 - 4)
    const advanced = { ...pass1, accumulatedGameTimeMs: 2 * MS_PER_STAR + MS_PER_STAR / 2 }
    const pass2 = reconcileStars(advanced)
    expect(pass2.starsRemaining).toBe(8128 - 5) // exactly one more, not a re-loss of the prior 4
  })

  it('stays MONOTONIC: reconcile never INCREASES starsRemaining', () => {
    const s = withStages(5, { accumulatedGameTimeMs: 7 * MS_PER_STAR, starsRemaining: 8128 })
    const next = reconcileStars(s)
    expect(next.starsRemaining).toBeLessThanOrEqual(s.starsRemaining)
  })
})

describe('offline catch-up keeps the accelerated descent (accumulatedGameTimeMs, never wall-clock)', () => {
  it('advancing accumulated time while "hidden" loses the accelerated count on the next reconcile', () => {
    // Simulate offline catch-up: while hidden, accumulatedGameTimeMs jumps forward by 8 base-intervals.
    // At 4 stages (×2.0) that is 16 stars, applied by reconcileStars on resume — derived purely from the
    // accumulated delta, exactly as the live descent is.
    const hidden = withStages(4, { accumulatedGameTimeMs: 8 * MS_PER_STAR })
    const resumed = reconcileStars(hidden)
    expect(resumed.starsRemaining).toBe(8128 - 16)
  })

  it('the NG+ scaffold (carryover / nGPlusRun / starsRemaining seed) is untouched by reconcile', () => {
    const s = withStages(3, {
      accumulatedGameTimeMs: 5 * MS_PER_STAR,
      ngPlusCarryover: { lifetimeCandiesEaten: 42, starsRemaining: 8128, nGPlusRun: 1 },
      nGPlusRun: 1,
    })
    const next = reconcileStars(s)
    expect(next.ngPlusCarryover).toBe(s.ngPlusCarryover)
    expect(next.nGPlusRun).toBe(s.nGPlusRun)
  })
})

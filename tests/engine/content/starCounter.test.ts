import { createDefaultSave } from '@/engine/state/defaultSave'
import {
  MS_PER_STAR,
  STARTING_STARS,
  starCounterVisible,
  projectedStars,
  reconcileStars,
  starDescentMultiplier,
  effectiveMsPerStar,
  castEclipse,
  eclipsed,
  eclipseUntilMs,
  ECLIPSE_UNTIL_KEY,
} from '@/engine/content/starCounter'
import { STAGE_ACCEL } from '@/content/sun/observationDeck'
import { ECLIPSE_DURATION_MS } from '@/content/void/voidWhale'
import { DYSON_STAGE_DONE_FLAGS, STAR_COUNTER_FROZEN_FLAG } from '@/content/flags'
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

// --- Act 4 — ending 2: FEED THE SUN freezes the counter forever (up or down) ----------------------------

/** Telescope owned + the starCounterFrozen flag set (ending 2). */
function frozen(over: Partial<GameState> = {}): GameState {
  const base = telescopeOwned(over)
  return { ...base, flags: { ...base.flags, starCounterFrozen: true } }
}

describe('ending 2 — FEED THE SUN freezes the counter (projectedStars / reconcileStars stop)', () => {
  it('projectedStars returns the stored count unchanged no matter how much time has passed', () => {
    const s = frozen({ accumulatedGameTimeMs: 1000 * MS_PER_STAR, starsRemaining: 4321 })
    expect(projectedStars(s)).toBe(4321)
  })

  it('reconcileStars is a SAME-reference no-op even with many whole stars of elapsed time', () => {
    const s = frozen({ accumulatedGameTimeMs: 500 * MS_PER_STAR, starsRemaining: 4321 })
    expect(reconcileStars(s)).toBe(s)
  })

  it('freeze beats acceleration: dyson stages do not unfreeze the descent', () => {
    const base = withStages(5, { accumulatedGameTimeMs: 1000 * MS_PER_STAR, starsRemaining: 4321 })
    const s = { ...base, flags: { ...base.flags, starCounterFrozen: true } }
    expect(projectedStars(s)).toBe(4321)
    expect(reconcileStars(s)).toBe(s)
  })

  it('the counter is still visible while frozen (the stopped sky shows)', () => {
    expect(starCounterVisible(frozen())).toBe(true)
  })
})

// --- Act 4 — ending 1: LET IT HATCH inverts the counter (the ONLY up-tick in the game) ------------------

/** Telescope owned + the starsRelighting flag set (ending 1 — the up-tick branch). */
function relighting(over: Partial<GameState> = {}): GameState {
  const base = telescopeOwned(over)
  return { ...base, flags: { ...base.flags, starsRelighting: true } }
}

describe('ending 1 — LET IT HATCH relights the stars (projectedStars / reconcileStars tick UP toward 8128)', () => {
  it('projectedStars rises by one per MS_PER_STAR of accumulated time (the first up-tick in the game)', () => {
    const oneLater = relighting({ accumulatedGameTimeMs: MS_PER_STAR, starsRemaining: 5000 })
    expect(projectedStars(oneLater)).toBe(5001)
    const tenLater = relighting({ accumulatedGameTimeMs: 10 * MS_PER_STAR, starsRemaining: 5000 })
    expect(projectedStars(tenLater)).toBe(5010)
  })

  it('clamps the rise at STARTING_STARS (8128) — the sky cannot over-fill', () => {
    const s = relighting({ accumulatedGameTimeMs: 1e15, starsRemaining: 8000 })
    expect(projectedStars(s)).toBe(STARTING_STARS)
    expect(projectedStars(s)).toBe(8128)
  })

  it('reconcileStars adds the elapsed whole stars and re-anchors the boughtAt stamp', () => {
    const s = relighting({ accumulatedGameTimeMs: 3 * MS_PER_STAR, starsRemaining: 5000 })
    const next = reconcileStars(s)
    expect(next.starsRemaining).toBe(5003)
    expect(next.numbers['telescopeBoughtAtMs']).toBe(3 * MS_PER_STAR)
  })

  it('reconcileStars is a SAME-reference no-op when no whole star has elapsed', () => {
    const s = relighting({ accumulatedGameTimeMs: MS_PER_STAR - 1, starsRemaining: 5000 })
    expect(reconcileStars(s)).toBe(s)
  })

  it('reconcileStars is a SAME-reference no-op once the relight has reached the cap (no over-fill, no churn)', () => {
    const s = relighting({ accumulatedGameTimeMs: 1e9 * MS_PER_STAR, starsRemaining: STARTING_STARS })
    expect(reconcileStars(s)).toBe(s)
  })

  it('reconcileStars clamps the persisted count at 8128 even when more time than needed has elapsed', () => {
    const s = relighting({ accumulatedGameTimeMs: 1000 * MS_PER_STAR, starsRemaining: 8120 })
    const next = reconcileStars(s)
    expect(next.starsRemaining).toBe(8128)
  })

  it('is MONOTONE UP: reconcile never DECREASES starsRemaining under relight', () => {
    const s = relighting({ accumulatedGameTimeMs: 7 * MS_PER_STAR, starsRemaining: 5000 })
    const next = reconcileStars(s)
    expect(next.starsRemaining).toBeGreaterThanOrEqual(s.starsRemaining)
  })

  it('a second pass with no new time is a SAME-reference no-op (no double-relight)', () => {
    const s = relighting({ accumulatedGameTimeMs: 3 * MS_PER_STAR, starsRemaining: 5000 })
    const once = reconcileStars(s)
    const twice = reconcileStars(once)
    expect(twice).toBe(once)
  })

  it('the relight rises FASTER under dyson acceleration (the same machinery, inverted)', () => {
    // 4 stages -> ×2.0 -> effectiveMsPerStar = MS_PER_STAR/2; three base-intervals = 6 stars relit.
    const base = withStages(4, { accumulatedGameTimeMs: 3 * MS_PER_STAR, starsRemaining: 5000 })
    const s = { ...base, flags: { ...base.flags, starsRelighting: true } }
    expect(projectedStars(s)).toBe(5006)
  })

  it('the counter is visible while relighting (the refilling sky shows)', () => {
    expect(starCounterVisible(relighting())).toBe(true)
  })
})

// The eclipse (Phase 5 — the black licorice grimoire's world spell, the void whale's hermit, §17/§18). A
// TEMPORARY, drift-free pause of the descent: while the shadow is up the count holds, and when it lifts the
// descent resumes exactly where it left off, having lost no stars to the paused window.
describe('the eclipse — a temporary, drift-free pause of the descent', () => {
  it('casting eclipse stamps the shadow-until and re-anchors, and reports eclipsed while it holds', () => {
    const s = telescopeOwned({ accumulatedGameTimeMs: 100 * MS_PER_STAR, starsRemaining: 5000 })
    expect(eclipsed(s)).toBe(false)
    const cast = castEclipse(s)
    expect(eclipseUntilMs(cast)).toBe(100 * MS_PER_STAR + ECLIPSE_DURATION_MS)
    expect(cast.numbers[ECLIPSE_UNTIL_KEY]).toBe(100 * MS_PER_STAR + ECLIPSE_DURATION_MS)
    expect(cast.numbers['telescopeBoughtAtMs']).toBe(100 * MS_PER_STAR) // re-anchored to now
    expect(eclipsed(cast)).toBe(true)
  })

  it('holds the count still while the shadow is up (projectedStars unmoved through the window)', () => {
    const s = castEclipse(telescopeOwned({ accumulatedGameTimeMs: 100 * MS_PER_STAR, starsRemaining: 5000 }))
    const before = projectedStars(s)
    expect(before).toBe(5000)
    // Advance time WITHIN the eclipse window (half its duration) — no stars fall.
    const mid = { ...s, accumulatedGameTimeMs: s.accumulatedGameTimeMs + ECLIPSE_DURATION_MS / 2 }
    expect(eclipsed(mid)).toBe(true)
    expect(projectedStars(mid)).toBe(5000)
    // reconcile mid-eclipse re-anchors forward but removes NO stars.
    const reconciled = reconcileStars(mid)
    expect(reconciled.starsRemaining).toBe(5000)
    expect(reconciled.numbers['telescopeBoughtAtMs']).toBe(mid.accumulatedGameTimeMs)
  })

  it('resumes DRIFT-FREE once the shadow lifts — the paused window is never charged as elapsed', () => {
    // Cast at t0; reconcile through the window; then advance one base-interval PAST the eclipse end.
    const t0 = 100 * MS_PER_STAR
    let s = castEclipse(telescopeOwned({ accumulatedGameTimeMs: t0, starsRemaining: 5000 }))
    // Reconcile a couple of times inside the window (offline-catchup style), advancing time each pass.
    s = { ...s, accumulatedGameTimeMs: t0 + ECLIPSE_DURATION_MS / 3 }
    s = reconcileStars(s)
    s = { ...s, accumulatedGameTimeMs: t0 + (2 * ECLIPSE_DURATION_MS) / 3 }
    s = reconcileStars(s)
    expect(s.starsRemaining).toBe(5000) // nothing lost in the shadow
    // Now step to exactly one base-interval AFTER the eclipse ends.
    s = { ...s, accumulatedGameTimeMs: t0 + ECLIPSE_DURATION_MS + MS_PER_STAR }
    expect(eclipsed(s)).toBe(false)
    // Exactly ONE star should have fallen since the shadow lifted (not the whole paused window's worth).
    expect(projectedStars(s)).toBe(4999)
    s = reconcileStars(s)
    expect(s.starsRemaining).toBe(4999)
  })

  it('a re-cast during an active eclipse EXTENDS the shadow from now (a fresh shadow, not stacked)', () => {
    const t0 = 100 * MS_PER_STAR
    const first = castEclipse(telescopeOwned({ accumulatedGameTimeMs: t0, starsRemaining: 5000 }))
    // Re-cast a third of the way through — the new end is (now + duration), measured from the re-cast.
    const later = { ...first, accumulatedGameTimeMs: t0 + ECLIPSE_DURATION_MS / 3 }
    const second = castEclipse(later)
    expect(eclipseUntilMs(second)).toBe(t0 + ECLIPSE_DURATION_MS / 3 + ECLIPSE_DURATION_MS)
  })

  it('ending 2 (permanent freeze) beats an eclipse: castEclipse is a SAME-ref no-op, eclipsed is false', () => {
    const base = telescopeOwned({ accumulatedGameTimeMs: 100 * MS_PER_STAR, starsRemaining: 5000 })
    const frozen: GameState = { ...base, flags: { ...base.flags, [STAR_COUNTER_FROZEN_FLAG]: true } }
    expect(castEclipse(frozen)).toBe(frozen)
    // even a stamped eclipse-until does not make a frozen sky "eclipsed" (frozen wins outright)
    const stamped: GameState = {
      ...frozen,
      numbers: { ...frozen.numbers, [ECLIPSE_UNTIL_KEY]: 1e18 },
    }
    expect(eclipsed(stamped)).toBe(false)
  })

  it('casting without the telescope (never revealed) is a SAME-ref no-op', () => {
    const s = createDefaultSave()
    expect(castEclipse(s)).toBe(s)
  })
})

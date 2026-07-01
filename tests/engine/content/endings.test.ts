import {
  canChoose,
  canEatIt,
  chosenEnding,
  endingChosen,
  chooseHatch,
  chooseFeed,
  chooseEat,
  chooseEnding,
} from '@/engine/content/endings'
import {
  STAR_EATER_DEFEATED_FLAG,
  ENDING_CHOSEN_FLAG,
  ENDING_HATCH,
  ENDING_FEED,
  ENDING_EAT,
  STARS_RELIGHTING_FLAG,
  STAR_COUNTER_FROZEN_FLAG,
  DARK_RUN_FLAG,
} from '@/content/flags'
import { EAT_IT_THRESHOLD } from '@/content/sun/endings'
import { addResource } from '@/engine/types/Resource'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { projectedStars, reconcileStars, MS_PER_STAR } from '@/engine/content/starCounter'
import type { GameState } from '@/engine/types/GameState'

/** A save with the star-eater driven off — the choice is open. */
const won = (over: Partial<GameState> = {}): GameState => {
  const s = createDefaultSave()
  return { ...s, flags: { ...s.flags, [STAR_EATER_DEFEATED_FLAG]: true }, ...over }
}

/** A won save holding `amount` candies (so ending 2's sacrifice has something to zero). */
const wonWithCandies = (amount: number): GameState => {
  const s = won()
  return { ...s, candies: addResource(s.candies, amount) }
}

describe('the choice — canChoose gate (starEaterDefeated && !endingChosen)', () => {
  it('is shut on a fresh save (the eater is not yet beaten)', () => {
    expect(canChoose(createDefaultSave())).toBe(false)
  })

  it('opens once the star-eater is driven off', () => {
    expect(canChoose(won())).toBe(true)
  })

  it('closes once an ending has been chosen (commit-once, terminal)', () => {
    expect(canChoose(chooseHatch(won()))).toBe(false)
    expect(canChoose(chooseFeed(won()))).toBe(false)
    // Eat returns the fresh dark save (starEaterDefeated cleared), so the light choice is shut on it too — the
    // dark run must re-beat the eater before its OWN choice can re-open (the §287 secret-completion path).
    expect(canChoose(chooseEat(won()))).toBe(false)
  })
})

describe('endingChosen / chosenEnding readers', () => {
  it('reads false / null before any choice', () => {
    expect(endingChosen(won())).toBe(false)
    expect(chosenEnding(won())).toBeNull()
  })

  it('reflects the committed ending string (hatch/feed stamp it; eat begins a fresh dark save instead)', () => {
    expect(chosenEnding(chooseHatch(won()))).toBe('hatch')
    expect(chosenEnding(chooseFeed(won()))).toBe('feed')
    // Eat does NOT stamp endingChosen — it returns the fresh dark save (endingChosen left UNSET so the dark run
    // can reach its own choice again for the §287 relight). The dark save is identified by the darkRun flag.
    expect(chosenEnding(chooseEat(won()))).toBeNull()
    expect(chooseEat(won()).flags[DARK_RUN_FLAG]).toBe(true)
    expect(endingChosen(chooseHatch(won()))).toBe(true)
  })

  it('the ending ids match the content constants', () => {
    expect(ENDING_HATCH).toBe('hatch')
    expect(ENDING_FEED).toBe('feed')
    expect(ENDING_EAT).toBe('eat')
  })
})

describe('canEatIt — ending 3 threshold gate (lifetimeCandiesEaten)', () => {
  it('is closed at or below the threshold', () => {
    expect(canEatIt(won({ lifetimeCandiesEaten: 0 }))).toBe(false)
    expect(canEatIt(won({ lifetimeCandiesEaten: EAT_IT_THRESHOLD }))).toBe(false)
  })

  it('opens strictly above the threshold', () => {
    expect(canEatIt(won({ lifetimeCandiesEaten: EAT_IT_THRESHOLD + 1 }))).toBe(true)
  })
})

describe('ending 1 — LET IT HATCH (the counter will tick UP)', () => {
  it('sets endingChosen=hatch + the starsRelighting flag in one dispatch', () => {
    const next = chooseHatch(won())
    expect(next.strings[ENDING_CHOSEN_FLAG]).toBe(ENDING_HATCH)
    expect(next.flags[STARS_RELIGHTING_FLAG]).toBe(true)
  })

  it('does NOT set the frozen flag and does NOT touch candies', () => {
    const start = wonWithCandies(5000)
    const next = chooseHatch(start)
    expect(next.flags[STAR_COUNTER_FROZEN_FLAG]).toBeUndefined()
    expect(next.candies.current).toBe(start.candies.current)
  })

  it('is a SAME-reference no-op once any ending is already chosen (commit-once)', () => {
    const once = chooseHatch(won())
    expect(chooseHatch(once)).toBe(once)
    // and a different ending cannot override a committed one
    const fed = chooseFeed(won())
    expect(chooseHatch(fed)).toBe(fed)
    expect(chosenEnding(chooseHatch(fed))).toBe('feed')
  })
})

describe('ending 2 — FEED THE SUN (zero the hoard, freeze the counter)', () => {
  it('sets endingChosen=feed + the starCounterFrozen flag + zeroes candies.current in one dispatch', () => {
    const start = wonWithCandies(12_345)
    const next = chooseFeed(start)
    expect(next.strings[ENDING_CHOSEN_FLAG]).toBe(ENDING_FEED)
    expect(next.flags[STAR_COUNTER_FROZEN_FLAG]).toBe(true)
    expect(next.candies.current).toBe(0)
  })

  it('does NOT set the relight flag', () => {
    expect(chooseFeed(won()).flags[STARS_RELIGHTING_FLAG]).toBeUndefined()
  })

  it('preserves lifetime totals when zeroing the hoard (lifetime survives NG+)', () => {
    const start = wonWithCandies(9_000)
    const before = start.candies.lifetimeAccumulated
    const next = chooseFeed(start)
    expect(next.candies.current).toBe(0)
    expect(next.candies.lifetimeAccumulated).toBe(before)
  })

  it('handles a zero hoard gracefully (still freezes, no crash)', () => {
    const start = won() // a default save has 0 candies
    const next = chooseFeed(start)
    expect(next.candies.current).toBe(0)
    expect(next.flags[STAR_COUNTER_FROZEN_FLAG]).toBe(true)
  })

  it('is a SAME-reference no-op once any ending is already chosen (the sacrifice can never re-run)', () => {
    const once = chooseFeed(wonWithCandies(5_000))
    expect(chooseFeed(once)).toBe(once)
    // a player cannot zero the hoard again to re-trigger anything
    const replayed = chooseFeed(once)
    expect(replayed.candies.current).toBe(0)
    expect(replayed).toBe(once)
  })
})

describe('ending 3 — EAT IT (begins the NG+ dark save; the round-trip lives in newGamePlus.test)', () => {
  it('returns the fresh dark save — the darkRun flag set, endingChosen left UNSET (the §287 relight path)', () => {
    const dark = chooseEat(won())
    expect(dark.flags[DARK_RUN_FLAG]).toBe(true)
    // endingChosen is deliberately NOT stamped, so the dark run can re-beat the eater and reach its own choice.
    expect(endingChosen(dark)).toBe(false)
    expect(chosenEnding(dark)).toBeNull()
  })

  it('is a SAME-reference no-op once a NON-eat ending is already committed (endingChosen holds)', () => {
    const fed = chooseFeed(won())
    expect(chooseEat(fed)).toBe(fed)
  })
})

describe('chooseEnding dispatcher', () => {
  it('routes to each ending', () => {
    expect(chosenEnding(chooseEnding(won(), 'hatch'))).toBe('hatch')
    expect(chosenEnding(chooseEnding(won(), 'feed'))).toBe('feed')
    // 'eat' routes to chooseEat -> the fresh dark save (darkRun set, endingChosen left unset).
    expect(chooseEnding(won(), 'eat').flags[DARK_RUN_FLAG]).toBe(true)
    expect(chosenEnding(chooseEnding(won(), 'eat'))).toBeNull()
  })

  it('feed via the dispatcher zeroes the hoard + freezes', () => {
    const next = chooseEnding(wonWithCandies(7_777), 'feed')
    expect(next.candies.current).toBe(0)
    expect(next.flags[STAR_COUNTER_FROZEN_FLAG]).toBe(true)
  })

  it('is a SAME-reference no-op once any ending is committed (no re-trigger / farm)', () => {
    const once = chooseEnding(won(), 'hatch')
    expect(chooseEnding(once, 'feed')).toBe(once)
    expect(chooseEnding(once, 'eat')).toBe(once)
    expect(chosenEnding(once)).toBe('hatch') // the first choice stands
  })
})

// --- the engine<->engine lock-step ACROSS the endings/starCounter boundary (the game's last payoff) -------
//
// chooseHatch / chooseFeed write the branch-flag literals (starsRelighting / starCounterFrozen); projectedStars
// / reconcileStars read their OWN independently-re-declared copies of those literals (the moonStrata idiom, ADR
// §3). endings.test.ts proves chooseX writes the CONTENT constant and starCounter.test.ts proves the counter
// reacts to flags set by ITS OWN raw-literal helpers — but nothing ties the producer to the consumer THROUGH
// the shared literal, so a drift in starCounter.ts's local copy (e.g. a typo) would pass both suites green
// while the finale's central payoff silently broke. These pipe the real chooseHatch(state) / chooseFeed(state)
// output straight into projectedStars / reconcileStars, so a drift in either local literal fails a test.

/** A telescope-owned, star-eater-beaten save with `stars` left and `elapsed` accumulated time since purchase. */
const wonWithTelescope = (stars: number, elapsed: number): GameState => {
  const s = won()
  return {
    ...s,
    flags: { ...s.flags, telescopeOwned: true },
    numbers: { ...s.numbers, telescopeBoughtAtMs: 0 },
    accumulatedGameTimeMs: elapsed,
    starsRemaining: stars,
  }
}

describe('endings -> starCounter lock-step (chooseHatch/chooseFeed pipe THROUGH the counter)', () => {
  it('chooseHatch makes the counter tick UP through projectedStars/reconcileStars (the only up-tick)', () => {
    const start = wonWithTelescope(5000, 3 * MS_PER_STAR)
    // Before the choice the counter is descending (down 3 of 5000).
    expect(projectedStars(start)).toBe(4997)
    const hatched = chooseHatch(start)
    // After hatch the SAME elapsed time relights UP (+3) — driven purely by the flag chooseHatch wrote and the
    // literal starCounter re-declares. A drift in either literal would leave this still descending.
    expect(projectedStars(hatched)).toBe(5003)
    const next = reconcileStars(hatched)
    expect(next.starsRemaining).toBeGreaterThan(start.starsRemaining)
    expect(next.starsRemaining).toBe(5003)
  })

  it('chooseFeed FREEZES the counter: projectedStars unmoved + reconcileStars a SAME-ref no-op', () => {
    const start = wonWithTelescope(4321, 500 * MS_PER_STAR)
    const fed = chooseFeed(start)
    // The stored count, unmoved, no matter how much time has passed (the freeze branch chooseFeed flagged).
    expect(projectedStars(fed)).toBe(4321)
    // And the descent stops forever — reconcile is a SAME-reference no-op (it never re-anchors or moves).
    expect(reconcileStars(fed)).toBe(fed)
  })
})

import {
  beginDarkSave,
  darkRunComplete,
  THE_DARK_OPENING_STARS,
} from '@/engine/state/newGamePlus'
import {
  canEatSun,
  chooseEat,
  chosenEnding,
  endingChosen,
} from '@/engine/content/endings'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { CURRENT_SCHEMA_VERSION } from '@/engine/types/GameState'
import {
  STAR_EATER_DEFEATED_FLAG,
  ENDING_CHOSEN_FLAG,
  ENDING_EAT,
  DARK_RUN_FLAG,
} from '@/content/flags'
import { EAT_IT_THRESHOLD } from '@/content/sun/endings'
import {
  projectedStars,
  reconcileStars,
  STARTING_STARS,
  MS_PER_STAR,
} from '@/engine/content/starCounter'
import { makeEnvelope, encodeSave } from '@/engine/save/envelope'
import { importSave } from '@/engine/save/validate'
import { addResource } from '@/engine/types/Resource'
import type { GameState } from '@/engine/types/GameState'

// The NG+ dark save round-trip (Act 4 — ending 3, EAT IT, DESIGN §204/§286/§367). The engine reducer
// (engine/state/newGamePlus.beginDarkSave) + the eat gate/commit (engine/content/endings.canEatSun/chooseEat)
// are the tested surface; the terminal scene + the reboot are the coverage-excluded screen. This proves the
// dark save is a REAL, loadable, export/import/migrate-round-tripping state — NO new resource, NO schema bump.

/** A victory save: the star-eater driven off, the choice open. `over` patches it (e.g. lifetime, candies). */
const victory = (over: Partial<GameState> = {}): GameState => {
  const s = createDefaultSave()
  return {
    ...s,
    flags: { ...s.flags, [STAR_EATER_DEFEATED_FLAG]: true },
    lifetimeCandiesEaten: EAT_IT_THRESHOLD + 1, // past the eat threshold by default
    ...over,
  }
}

describe('canEatSun — ending 3 gate (starEaterDefeated && !endingChosen && lifetime > threshold)', () => {
  it('is shut on a fresh save (the eater is not yet beaten)', () => {
    expect(canEatSun(createDefaultSave())).toBe(false)
  })

  it('is shut when the star-eater is beaten but lifetime is at or below the threshold', () => {
    expect(canEatSun(victory({ lifetimeCandiesEaten: 0 }))).toBe(false)
    expect(canEatSun(victory({ lifetimeCandiesEaten: EAT_IT_THRESHOLD }))).toBe(false)
  })

  it('opens once the eater is beaten AND lifetime is strictly past the threshold', () => {
    expect(canEatSun(victory({ lifetimeCandiesEaten: EAT_IT_THRESHOLD + 1 }))).toBe(true)
  })

  it('closes once any ending has been committed (commit-once, terminal)', () => {
    const eaten = chooseEat(victory())
    expect(canEatSun(eaten)).toBe(false)
  })
})

describe('chooseEat — commit-once + records the eat (the dark save begins)', () => {
  it('records endingChosen=eat + the darkRun flag in one dispatch', () => {
    const dark = chooseEat(victory())
    expect(dark.strings[ENDING_CHOSEN_FLAG]).toBe(ENDING_EAT)
    expect(chosenEnding(dark)).toBe('eat')
    expect(dark.flags[DARK_RUN_FLAG]).toBe(true)
  })

  it('is a SAME-reference no-op once any ending is already chosen (the dark save can never re-roll)', () => {
    const once = chooseEat(victory())
    expect(chooseEat(once)).toBe(once)
    // The committed dark save still reads endingChosen=eat, so a stray re-entry is gated.
    expect(endingChosen(once)).toBe(true)
  })
})

describe('beginDarkSave — the inverted opening (a fresh, loadable dark save)', () => {
  it('opens the sky at 8100 (the inverted opening), not the light 8128', () => {
    const dark = beginDarkSave(victory())
    expect(THE_DARK_OPENING_STARS).toBe(8100)
    expect(dark.starsRemaining).toBe(8100)
  })

  it('starts from a FRESH default — no progress carries (candies back to 1, no victory flag)', () => {
    const dark = beginDarkSave(victory({ candies: addResource(createDefaultSave().candies, 999_999) }))
    expect(dark.candies.current).toBe(1) // a fresh field: one candy
    expect(dark.flags[STAR_EATER_DEFEATED_FLAG]).toBeUndefined()
  })

  it('preserves lifetime stats (the only thing the box could not eat — grandma\'s wrapper still scales)', () => {
    const prev = victory({ lifetimeCandiesEaten: 250_000, lifetimeCandiesThrown: 42_000 })
    const dark = beginDarkSave(prev)
    expect(dark.lifetimeCandiesEaten).toBe(250_000)
    expect(dark.lifetimeCandiesThrown).toBe(42_000)
  })

  it('increments nGPlusRun (this is the next loop)', () => {
    expect(beginDarkSave(victory({ nGPlusRun: 0 })).nGPlusRun).toBe(1)
    expect(beginDarkSave(victory({ nGPlusRun: 3 })).nGPlusRun).toBe(4)
  })

  it('sets darkRun + telescopeOwned + the telescope stamp (the counter opens already falling)', () => {
    const dark = beginDarkSave(victory())
    expect(dark.flags[DARK_RUN_FLAG]).toBe(true)
    expect(dark.flags['telescopeOwned']).toBe(true)
    // anchored to the fresh save's accumulated time (0) so the descent measures from the very first frame.
    expect(dark.numbers['telescopeBoughtAtMs']).toBe(dark.accumulatedGameTimeMs)
    expect(dark.numbers['telescopeBoughtAtMs']).toBe(0)
  })

  it('populates the EXISTING ngPlusCarryover scaffold (lifetime + 8100 + the next run index)', () => {
    const prev = victory({ lifetimeCandiesEaten: 250_000, nGPlusRun: 2 })
    const dark = beginDarkSave(prev)
    expect(dark.ngPlusCarryover).toEqual({
      lifetimeCandiesEaten: 250_000,
      starsRemaining: 8100,
      nGPlusRun: 3,
    })
  })

  it('does NOT mutate the previous (victory) state — immutable', () => {
    const prev = victory({ nGPlusRun: 1 })
    const snapshot = JSON.parse(JSON.stringify(prev))
    beginDarkSave(prev)
    expect(JSON.parse(JSON.stringify(prev))).toEqual(snapshot)
  })
})

describe('the dark counter ticks DOWN from 8100 (the default descending branch, on accumulated time)', () => {
  it('descends from 8100 as accumulated game time passes (multiplier 1 on a fresh dark save)', () => {
    const dark = beginDarkSave(victory())
    // No time yet: the full 8100.
    expect(projectedStars(dark)).toBe(8100)
    // Three stars\' worth of accumulated time (no dyson stages -> multiplier 1 -> MS_PER_STAR each).
    const later = { ...dark, accumulatedGameTimeMs: 3 * MS_PER_STAR }
    expect(projectedStars(later)).toBe(8097)
    // reconcile commits the descent into starsRemaining.
    const reconciled = reconcileStars(later)
    expect(reconciled.starsRemaining).toBe(8097)
  })

  it('does NOT relight (it is not the hatch ending — a default dark save only ever falls)', () => {
    const dark = beginDarkSave(victory())
    const later = { ...dark, accumulatedGameTimeMs: 10 * MS_PER_STAR }
    // strictly below the opening — it fell, it did not rise.
    expect(projectedStars(later)).toBeLessThan(8100)
  })
})

describe('darkRunComplete — the §367 secret completion (the counter carried back to 8128)', () => {
  it('is false on a fresh dark save (it opens at 8100, far below 8128)', () => {
    expect(darkRunComplete(beginDarkSave(victory()))).toBe(false)
  })

  it('is false below 8128 even on a dark run', () => {
    const dark = beginDarkSave(victory())
    expect(darkRunComplete({ ...dark, starsRemaining: 8127 })).toBe(false)
  })

  it('is true once a dark run carries the counter to the full sky (>= 8128)', () => {
    const dark = beginDarkSave(victory())
    expect(darkRunComplete({ ...dark, starsRemaining: STARTING_STARS })).toBe(true)
    expect(darkRunComplete({ ...dark, starsRemaining: STARTING_STARS + 5 })).toBe(true)
  })

  it('requires the darkRun flag — a light save at 8128 is NOT a dark-run completion', () => {
    const light = { ...createDefaultSave(), starsRemaining: STARTING_STARS }
    expect(darkRunComplete(light)).toBe(false)
  })
})

describe('the CRITICAL round-trip — beginDarkSave -> export -> import -> migrate(v8) -> validate', () => {
  it('round-trips the dark save through the full save path with NO schema bump (stays v8)', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(8)

    const dark = beginDarkSave(victory({ lifetimeCandiesEaten: 333_000, nGPlusRun: 4 }))
    const encoded = encodeSave(makeEnvelope(dark, 1234))
    const result = importSave(encoded)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // The envelope comes back at the current schema version — no migration rung was needed.
    expect(result.envelope.v).toBe(CURRENT_SCHEMA_VERSION)
    expect(CURRENT_SCHEMA_VERSION).toBe(8)

    const loaded = result.envelope.state
    // The inverted opening survives (flags/numbers/strings ride the z.record passthroughs). beginDarkSave sets
    // the darkRun flag + the telescope stamp; the endingChosen='eat' string is stamped by chooseEat (its wrapper)
    // — asserted in the full-eat-path round-trip below.
    expect(loaded.starsRemaining).toBe(8100)
    expect(loaded.flags[DARK_RUN_FLAG]).toBe(true)
    expect(loaded.flags['telescopeOwned']).toBe(true)
    expect(loaded.numbers['telescopeBoughtAtMs']).toBe(0)
    // Lifetime + run index survive.
    expect(loaded.lifetimeCandiesEaten).toBe(333_000)
    expect(loaded.nGPlusRun).toBe(5)
    // The ngPlusCarryover scaffold survives validation intact.
    expect(loaded.ngPlusCarryover).toEqual({
      lifetimeCandiesEaten: 333_000,
      starsRemaining: 8100,
      nGPlusRun: 5,
    })
  })

  it('the round-tripped dark save is PLAYABLE — its counter then ticks DOWN from 8100', () => {
    const dark = beginDarkSave(victory())
    const result = importSave(encodeSave(makeEnvelope(dark, 0)))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const loaded = result.envelope.state
    // Open: the full 8100; after accumulated time it descends (the default branch, the dark save is a real state).
    expect(projectedStars(loaded)).toBe(8100)
    const later = { ...loaded, accumulatedGameTimeMs: 5 * MS_PER_STAR }
    expect(projectedStars(later)).toBe(8095)
  })

  it('the full eat path (chooseEat) round-trips too — the committed dark save loads back gated', () => {
    const dark = chooseEat(victory({ lifetimeCandiesEaten: EAT_IT_THRESHOLD + 5 }))
    const result = importSave(encodeSave(makeEnvelope(dark, 0)))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const loaded = result.envelope.state
    // endingChosen='eat' + darkRun carried forward, so a stray re-entry on the dark save is still gated.
    expect(loaded.strings[ENDING_CHOSEN_FLAG]).toBe(ENDING_EAT)
    expect(loaded.flags[DARK_RUN_FLAG]).toBe(true)
    expect(canEatSun(loaded)).toBe(false) // commit-once: the eat gate is shut on the dark save
    expect(loaded.starsRemaining).toBe(8100)
  })
})

// Ending 4 (the fossil-star epilogue, DESIGN §309/§16.4) is DEFERRED + signposted as polish: it would read
// stardust + the fossil and is not wired here. The dark run's only secret is darkRunComplete (carry to 8128).

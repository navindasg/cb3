import {
  beginDarkSave,
  darkRunComplete,
  THE_DARK_OPENING_STARS,
} from '@/engine/state/newGamePlus'
import {
  canChoose,
  canEatSun,
  chooseEat,
  chooseHatch,
  chosenEnding,
  endingChosen,
} from '@/engine/content/endings'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { CURRENT_SCHEMA_VERSION } from '@/engine/types/GameState'
import {
  STAR_EATER_DEFEATED_FLAG,
  ENDING_CHOSEN_FLAG,
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

describe('chooseEat — begins the fresh dark save (the light game ends)', () => {
  it('returns the dark save: the darkRun flag set, endingChosen left UNSET (the §287 relight path)', () => {
    const dark = chooseEat(victory())
    expect(dark.flags[DARK_RUN_FLAG]).toBe(true)
    // endingChosen is deliberately NOT stamped onto the dark save, so the dark run can re-beat the eater and
    // reach its own choice again to relight the counter toward 8128 (newGamePlus.darkRunComplete, §287/§367).
    expect(dark.strings[ENDING_CHOSEN_FLAG]).toBeUndefined()
    expect(chosenEnding(dark)).toBeNull()
    expect(endingChosen(dark)).toBe(false)
  })

  it('the dark save is still farm-proof despite endingChosen unset — canEatSun/canChoose shut on it', () => {
    const dark = chooseEat(victory())
    // The fresh dark save carries starEaterDefeated=false, so both gates are already shut on it regardless of
    // endingChosen — no ending can be re-triggered until the dark run itself re-beats the eater.
    expect(canEatSun(dark)).toBe(false)
    expect(dark.flags[STAR_EATER_DEFEATED_FLAG]).toBeUndefined()
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

  // The §287/§367 completion must be REACHABLE THROUGH PLAY, not only via a manually-patched starsRemaining.
  // This drives the whole path: eat the sun -> the dark save -> replay the dark loop and re-beat the eater
  // (re-set starEaterDefeated) -> the dark run's own choice re-opens -> pick 'let it hatch' -> accumulate time
  // -> the counter relights UP past 8128 -> darkRunComplete === true. If chooseEat ever re-stamped endingChosen
  // onto the dark save (locking the choice forever), canChoose would stay false and this would go unreachable.
  it('is REACHABLE through play: eat -> dark run -> re-beat eater -> hatch -> relight up to >= 8128', () => {
    // 1) Eat the sun: the fresh dark save opens at 8100, the choice shut (starEaterDefeated=false).
    const dark = chooseEat(victory())
    expect(darkRunComplete(dark)).toBe(false)
    expect(canChoose(dark)).toBe(false)

    // 2) Replay the dark loop and re-beat the star-eater — the dark run's OWN choice re-opens (endingChosen was
    //    left unset, so canChoose = starEaterDefeated && !endingChosen is true again).
    const reWon = { ...dark, flags: { ...dark.flags, [STAR_EATER_DEFEATED_FLAG]: true } }
    expect(canChoose(reWon)).toBe(true)

    // 3) Choose 'let it hatch' inside the dark run — sets starsRelighting, the counter will now tick UP.
    const relit = chooseHatch(reWon)
    expect(chosenEnding(relit)).toBe('hatch')

    // 4) Let enough accumulated game time pass for the relight to carry 8100 back up past the full sky (8128).
    //    A fresh dark save has no dyson-stage flags (multiplier 1), so each star is exactly MS_PER_STAR.
    const later = { ...relit, accumulatedGameTimeMs: 40 * MS_PER_STAR }
    const reconciled = reconcileStars(later)
    expect(reconciled.starsRemaining).toBe(STARTING_STARS) // relight clamps at 8128

    // 5) The secret completion is satisfied — not dead code.
    expect(darkRunComplete(reconciled)).toBe(true)
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
    // the darkRun flag + the telescope stamp; endingChosen is left UNSET (chooseEat does not stamp it — the §287
    // relight path) — asserted in the full-eat-path round-trip below.
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

  it('the full eat path (chooseEat) round-trips too — the fresh dark save loads back farm-proof', () => {
    const dark = chooseEat(victory({ lifetimeCandiesEaten: EAT_IT_THRESHOLD + 5 }))
    const result = importSave(encodeSave(makeEnvelope(dark, 0)))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const loaded = result.envelope.state
    // The darkRun flag survives; endingChosen is UNSET (the §287 relight path). The eat gate is still shut on the
    // loaded dark save because it carries starEaterDefeated=false — not because endingChosen is stamped.
    expect(loaded.flags[DARK_RUN_FLAG]).toBe(true)
    expect(loaded.strings[ENDING_CHOSEN_FLAG]).toBeUndefined()
    expect(loaded.flags[STAR_EATER_DEFEATED_FLAG]).toBeUndefined()
    expect(canEatSun(loaded)).toBe(false)
    expect(loaded.starsRemaining).toBe(8100)
  })
})

// Ending 4 (the fossil-star epilogue, DESIGN §309/§16.4) is DEFERRED + signposted as polish: it would read
// stardust + the fossil and is not wired here. The dark run's only secret is darkRunComplete (carry to 8128).

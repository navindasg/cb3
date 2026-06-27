import {
  coreOpen,
  coreStage,
  atDragon,
  caramelCoreReached,
  solarDragonMet,
  approachCore,
} from '@/engine/content/caramelCore'
import {
  CARAMEL_CORE_REACHED_FLAG,
  SOLAR_DRAGON_MET_FLAG,
  PHOTOSPHERE_CLEARED_FLAG,
} from '@/content/flags'
import {
  CORE_STAGE_KEY,
  CORE_STAGES,
  DRAGON_STAGE,
  CORE_ART,
  CORE_BLURB,
  DRAGON_WORDS,
} from '@/content/sun/caramelCore'
import { createDefaultSave } from '@/engine/state/defaultSave'
import type { GameState } from '@/engine/types/GameState'

/** A save with the photosphere descent cleared — the caramel-core reveal open, at the molten stage. */
const coreOpenSave = (over: Partial<GameState> = {}): GameState => {
  const s = createDefaultSave()
  return { ...s, flags: { ...s.flags, [PHOTOSPHERE_CLEARED_FLAG]: true }, ...over }
}

/** Walk the reveal all the way to the dragon (DRAGON_STAGE approach calls from molten). */
const walkToDragon = (s: GameState): GameState => {
  let state = s
  for (let i = 0; i < DRAGON_STAGE; i++) state = approachCore(state)
  return state
}

describe('the caramel core — open gate (photosphere cleared)', () => {
  it('is shut on a fresh save', () => {
    expect(coreOpen(createDefaultSave())).toBe(false)
  })

  it('opens once the photosphere descent has reached the core', () => {
    expect(coreOpen(coreOpenSave())).toBe(true)
  })

  it('gates on the EXACT content-owned cleared flag literal (lock-step with content/flags)', () => {
    // If the engine's re-declared literal drifts from content/flags this fails — guarding the moonStrata idiom.
    const s = { ...createDefaultSave(), flags: { [PHOTOSPHERE_CLEARED_FLAG]: true } }
    expect(coreOpen(s)).toBe(true)
  })

  it('approachCore does nothing (SAME reference) while the core is shut', () => {
    const before = createDefaultSave()
    const after = approachCore(before)
    expect(after).toBe(before)
    expect(coreStage(after)).toBe(0)
  })
})

describe('the caramel core — the stage march (pure, immutable, cannot skip)', () => {
  it('starts at stage 0 (molten) on a freshly-opened core', () => {
    const s = coreOpenSave()
    expect(coreStage(s)).toBe(0)
    expect(atDragon(s)).toBe(false)
    expect(caramelCoreReached(s)).toBe(false)
    expect(solarDragonMet(s)).toBe(false)
  })

  it('advances by EXACTLY one stage per call and cannot skip', () => {
    let s = coreOpenSave()
    for (let i = 1; i <= DRAGON_STAGE; i++) {
      s = approachCore(s)
      expect(coreStage(s)).toBe(i) // exactly one further each time
    }
  })

  it('does not reach the dragon (nor set the flags) before the final stage', () => {
    let s = coreOpenSave()
    for (let i = 0; i < DRAGON_STAGE - 1; i++) {
      s = approachCore(s)
      expect(atDragon(s)).toBe(false)
      expect(caramelCoreReached(s)).toBe(false)
      expect(solarDragonMet(s)).toBe(false)
    }
  })

  it('does not mutate the input state (immutability)', () => {
    const before = coreOpenSave()
    approachCore(before)
    expect(before.numbers[CORE_STAGE_KEY]).toBeUndefined()
    expect(before.flags[CARAMEL_CORE_REACHED_FLAG]).toBeUndefined()
  })

  it('reads the stage cursor from the numbers ledger, floored + clamped into range', () => {
    expect(coreStage(coreOpenSave({ numbers: { [CORE_STAGE_KEY]: 2.9 } }))).toBe(2) // floored
    expect(coreStage(coreOpenSave({ numbers: { [CORE_STAGE_KEY]: -5 } }))).toBe(0) // clamped low
    expect(coreStage(coreOpenSave({ numbers: { [CORE_STAGE_KEY]: 999 } }))).toBe(DRAGON_STAGE) // clamped high
  })
})

describe('the caramel core — reaching the dragon (commit-once, both flags atomic)', () => {
  it('sets BOTH caramelCoreReached AND solarDragonMet in ONE dispatch on the dragon-stage call', () => {
    // Build the state one step short of the dragon, then take the final step and assert atomicity.
    let s = coreOpenSave()
    for (let i = 0; i < DRAGON_STAGE - 1; i++) s = approachCore(s)
    expect(caramelCoreReached(s)).toBe(false)
    expect(solarDragonMet(s)).toBe(false)

    const reached = approachCore(s)
    expect(atDragon(reached)).toBe(true)
    expect(coreStage(reached)).toBe(DRAGON_STAGE)
    expect(caramelCoreReached(reached)).toBe(true) // both, together
    expect(solarDragonMet(reached)).toBe(true)
    expect(reached.flags[CARAMEL_CORE_REACHED_FLAG]).toBe(true)
    expect(reached.flags[SOLAR_DRAGON_MET_FLAG]).toBe(true)
  })

  it('is commit-once: a further call at the dragon stage returns the SAME reference', () => {
    const reached = walkToDragon(coreOpenSave())
    const again = approachCore(reached)
    expect(again).toBe(reached) // SAME reference — re-viewable but nothing to farm
    expect(coreStage(again)).toBe(DRAGON_STAGE) // never advances past the dragon
  })

  it('solarDragonMet ALWAYS implies caramelCoreReached (the two are set together)', () => {
    const reached = walkToDragon(coreOpenSave())
    expect(solarDragonMet(reached)).toBe(true)
    expect(caramelCoreReached(reached)).toBe(true)
    // And the converse is symmetric here: the flags are only ever set in the same dispatch.
    expect(solarDragonMet(reached)).toBe(caramelCoreReached(reached))
  })

  it('reaches the dragon in EXACTLY DRAGON_STAGE approach calls from molten', () => {
    let s = coreOpenSave()
    let steps = 0
    while (!atDragon(s)) {
      s = approachCore(s)
      steps++
      expect(steps).toBeLessThanOrEqual(DRAGON_STAGE + 1) // guard against a runaway loop
    }
    expect(steps).toBe(DRAGON_STAGE)
  })

  it('does not disturb the NG+ scaffold (carryover / nGPlusRun / starsRemaining untouched)', () => {
    const before = coreOpenSave()
    const after = walkToDragon(before)
    expect(after.ngPlusCarryover).toBe(before.ngPlusCarryover)
    expect(after.nGPlusRun).toBe(before.nGPlusRun)
    expect(after.starsRemaining).toBe(before.starsRemaining) // a reveal, not a star cost
  })

  it('does not partly-advance from an already-reached state when re-entered (no farm)', () => {
    const reached = walkToDragon(coreOpenSave())
    // Re-viewing (re-entering the open core already at the dragon) grants nothing and never moves.
    const a = approachCore(reached)
    const b = approachCore(a)
    expect(a).toBe(reached)
    expect(b).toBe(reached)
  })
})

describe('the caramel core — content config integrity', () => {
  it('DRAGON_STAGE is the last index of CORE_STAGES, and the last stage is the dragon', () => {
    expect(DRAGON_STAGE).toBe(CORE_STAGES.length - 1)
    expect(CORE_STAGES[DRAGON_STAGE]).toBe('dragon')
    expect(CORE_STAGES[0]).toBe('molten')
  })

  it('every stage has ASCII art (pure ASCII — the monospace-grid rule) and a non-empty blurb', () => {
    for (const id of CORE_STAGES) {
      expect(CORE_ART[id], id).toBeTruthy()
      expect(CORE_BLURB[id], id).toBeTruthy()
      // The ART lands in a monospace <pre> grid, so it must be STRICT ASCII (no glyph above 0x7F that
      // would break the grid). Blurb prose lands in a flowing <p> and follows the codebase em-dash voice.
      expect(/[^\x00-\x7F]/.test(CORE_ART[id]), `${id} art ascii`).toBe(false)
    }
  })

  it('the dragon speaks a few SMALL words (§278 — not a lore dump)', () => {
    expect(DRAGON_WORDS.length).toBeGreaterThan(0)
    expect(DRAGON_WORDS.length).toBeLessThanOrEqual(4)
  })
})

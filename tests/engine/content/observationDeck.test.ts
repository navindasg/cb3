import {
  deckOpen,
  starEaterSighted,
  witnessStarDie,
} from '@/engine/content/observationDeck'
import { DYSON_STAGE_DONE_FLAGS, STAR_EATER_SIGHTED_FLAG } from '@/content/flags'
import { ASTRONOMER_DIALOGUE } from '@/content/dialogue/astronomer'
import { selectVariant } from '@/engine/content/dialogue'
import { en } from '@/content/i18n/en'
import { createDefaultSave } from '@/engine/state/defaultSave'
import type { GameState } from '@/engine/types/GameState'

const STAGE4 = DYSON_STAGE_DONE_FLAGS[3]

/** A save with the observation gantry (stage 4) raised — the deck open, no star yet witnessed. */
const deckOpenSave = (over: Partial<GameState> = {}): GameState => {
  const s = createDefaultSave()
  return { ...s, flags: { ...s.flags, [STAGE4]: true }, ...over }
}

describe('the observation deck — open gate (stage 4)', () => {
  it('is shut on a fresh save and at every earlier stage', () => {
    expect(deckOpen(createDefaultSave())).toBe(false)
    for (const earlier of DYSON_STAGE_DONE_FLAGS.slice(0, 3)) {
      const s = { ...createDefaultSave(), flags: { [earlier]: true } }
      expect(deckOpen(s)).toBe(false)
    }
  })

  it('opens once the observation gantry (the fourth dyson strut) is raised', () => {
    expect(deckOpen(deckOpenSave())).toBe(true)
  })

  it('gates on the EXACT content-owned stage-4 flag literal (lock-step with content/flags)', () => {
    // If the engine's re-declared literal drifts from content/flags this fails — guarding the moonStrata idiom.
    const s = { ...createDefaultSave(), flags: { [DYSON_STAGE_DONE_FLAGS[3]]: true } }
    expect(deckOpen(s)).toBe(true)
  })
})

describe('the observation deck — witnessStarDie (the commit-once star death)', () => {
  it('removes EXACTLY one star and sets the sighted flag, both in one dispatch', () => {
    const before = deckOpenSave()
    expect(before.starsRemaining).toBe(8128)
    expect(starEaterSighted(before)).toBe(false)
    const after = witnessStarDie(before)
    expect(after.starsRemaining).toBe(8127) // exactly one removed
    expect(after.flags[STAR_EATER_SIGHTED_FLAG]).toBe(true)
    expect(starEaterSighted(after)).toBe(true)
  })

  it('is commit-once: a second call returns the SAME reference and removes nothing more', () => {
    const before = deckOpenSave()
    const once = witnessStarDie(before)
    const twice = witnessStarDie(once)
    expect(twice).toBe(once) // SAME reference — never re-fires
    expect(twice.starsRemaining).toBe(8127) // still exactly one removed, not two
  })

  it('does nothing (SAME reference) before the deck is open', () => {
    const before = createDefaultSave()
    const after = witnessStarDie(before)
    expect(after).toBe(before)
    expect(after.starsRemaining).toBe(8128)
    expect(starEaterSighted(after)).toBe(false)
  })

  it('does nothing (SAME reference) when already sighted, even if the deck is open', () => {
    const before = deckOpenSave({
      flags: { [STAGE4]: true, [STAR_EATER_SIGHTED_FLAG]: true },
    })
    const after = witnessStarDie(before)
    expect(after).toBe(before)
  })

  it('starsRemaining only ever DECREASES (a cost, not loot — nothing to farm)', () => {
    const before = deckOpenSave({ starsRemaining: 50 })
    const after = witnessStarDie(before)
    expect(after.starsRemaining).toBeLessThan(before.starsRemaining)
    expect(after.starsRemaining).toBe(49)
  })

  it('clamps at zero (never goes negative) when the sky is already empty', () => {
    const before = deckOpenSave({ starsRemaining: 0 })
    const after = witnessStarDie(before)
    expect(after.starsRemaining).toBe(0)
    expect(after.flags[STAR_EATER_SIGHTED_FLAG]).toBe(true) // still records the sighting
  })

  it('does not mutate the input state (immutability)', () => {
    const before = deckOpenSave()
    const starsBefore = before.starsRemaining
    witnessStarDie(before)
    expect(before.starsRemaining).toBe(starsBefore)
    expect(before.flags[STAR_EATER_SIGHTED_FLAG]).toBeUndefined()
  })

  it('does not disturb the NG+ scaffold (carryover / nGPlusRun untouched)', () => {
    const before = deckOpenSave()
    const after = witnessStarDie(before)
    expect(after.ngPlusCarryover).toBe(before.ngPlusCarryover)
    expect(after.nGPlusRun).toBe(before.nGPlusRun)
  })
})

describe('the astronomer goes quiet on the deck (the one place the game states the §15 truth)', () => {
  it('the grim variant is selected once the observation gantry is raised', () => {
    const variant = selectVariant(ASTRONOMER_DIALOGUE, deckOpenSave())
    expect(variant?.id).toBe('starEaterGrief')
  })

  it('the grim variant pre-empts the cheerful star murmur (highest priority)', () => {
    // Even with the telescope owned (which would otherwise pick the cheerful "postTelescope" murmur), the
    // grim variant wins on the deck.
    const s = deckOpenSave({
      flags: { [STAGE4]: true, telescopeOwned: true, seedEventFired: true },
    })
    const variant = selectVariant(ASTRONOMER_DIALOGUE, s)
    expect(variant?.id).toBe('starEaterGrief')
  })

  it('the cheerful murmur still shows BEFORE the deck (the change is stage-4 only)', () => {
    const s = { ...createDefaultSave(), flags: { telescopeOwned: true } }
    const variant = selectVariant(ASTRONOMER_DIALOGUE, s)
    expect(variant?.id).toBe('postTelescope')
  })

  it('every grim line resolves to a non-empty i18n string', () => {
    const variant = selectVariant(ASTRONOMER_DIALOGUE, deckOpenSave())!
    for (const key of variant.lines) {
      expect(en[key as keyof typeof en]).toBeTruthy()
    }
    // The one line where the game says it aloud.
    expect(en['dialogue.astronomer.grim2']).toContain('eaten')
  })
})

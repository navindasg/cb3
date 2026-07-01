import { en } from '@/content/i18n/en'
import type { GameTextKey } from '@/content/i18n/schema'
import {
  ALL_DEATH_MESSAGES,
  BESPOKE_DEATH_SOURCES,
  GENERIC_DEATH,
} from '@/content/deathMessages'
import { deathBlurb } from '@/engine/quest/deathBlurb'

const KEYS = new Set(Object.keys(en))

// §19: every death/loss SOURCE across Acts 0-4 (and the Phase-5 bosses that attach here) gets a
// bespoke, in-voice line — never the generic "You feel fine about it" fallback. This registry is
// foundational: later boss slices (wolf/reflection/hallucination/void-whale/fossil-star) attach
// their line here, so the guard below catches any un-messaged death the moment a source is added.

describe('death-message registry (§19)', () => {
  it('every message resolves to a non-empty i18n string', () => {
    for (const d of ALL_DEATH_MESSAGES) {
      expect(KEYS.has(d.message), d.message).toBe(true)
      expect(en[d.message as GameTextKey], d.message).not.toBe('')
    }
  })

  it('every source is unique (no two entries claim the same source)', () => {
    const sources = ALL_DEATH_MESSAGES.map((d) => d.source)
    expect(new Set(sources).size).toBe(sources.length)
  })

  it('includes exactly one generic fallback', () => {
    const generics = ALL_DEATH_MESSAGES.filter((d) => d.source === 'generic')
    expect(generics).toEqual([GENERIC_DEATH])
  })

  it('every bespoke source picks its OWN line, never the generic fallback', () => {
    for (const source of BESPOKE_DEATH_SOURCES) {
      const key = deathBlurb(source, ALL_DEATH_MESSAGES)
      expect(key, source).not.toBe(GENERIC_DEATH.message)
      expect(en[key as GameTextKey], source).not.toBe(en['death.generic'])
    }
  })

  it('the enumerated Act 0-4 death/loss sources each have a bespoke line', () => {
    // Enumerated by hand from every death/loss SOURCE across the game (on-foot quests + the
    // transient Act 2-4 turn-based fights + the reef strand + the zone hazards + the poignant
    // generics + the §19 samples). A missing entry here is a §19 gap.
    const REQUIRED = [
      // Act 0 (on-foot quests)
      'candyBat',
      'sugarGolem',
      'gummyWorm',
      'gummySlime',
      'gummyBear',
      'mineSentinel',
      'rockImp',
      // Act 1
      'gummyAphid',
      'cloudRat',
      'stormSprite',
      'thunderheadDjinn',
      'moonWorm',
      'fall',
      'tollGiantLoss',
      // Act 2 (transient fights + zones)
      'reefDrift',
      'sourbeardCannon',
      'sourbeardBoarding',
      'kraken',
      'sourDissolve',
      'mintLabyrinth',
      // NOTE: sourRain / sourPlanetFall / frostWyrm are intentionally NOT here — those beats are
      // canonically not deaths (sour rain = +resist achievement §335; the sour planet is a peaceful
      // first-contact zone with no loss path; the frost wyrm is a "not a fight" vigil). Author-ahead
      // is for signposted future losses, not beats that contradict canon.
      // Act 3-4 (the sun descent + the star-eater)
      'photosphereHeat',
      'starEater',
      // poignant generics + §19 samples
      'stormMerge',
      'grandmaDuck',
      'voidWhale',
    ] as const
    for (const source of REQUIRED) {
      expect(BESPOKE_DEATH_SOURCES, source).toContain(source)
    }
  })

  it('reuses the §19 sample lines verbatim where the design gives them', () => {
    // The canonical DESIGN §19 samples, quoted exactly.
    const SAMPLES: Record<string, string> = {
      reefDrift: 'You drift forever. A gummy alien waves politely.',
      stormMerge: 'You are now part of the storm. The storm says thanks.',
      photosphereHeat: 'The sun politely declines your visit.',
      sourbeardCannon: 'Sourbeard apologizes for the cannonball. He does not mean it.',
      mintLabyrinth: 'The labyrinth keeps you. It was lonely.',
      sourDissolve: 'You have been politely dissolved.',
      voidWhale: 'The void whale did not even notice. Somehow that is worse.',
      grandmaDuck: 'Grandma would have ducked.',
    }
    for (const [source, expected] of Object.entries(SAMPLES)) {
      const key = deathBlurb(source, ALL_DEATH_MESSAGES)
      expect(en[key as GameTextKey], source).toBe(expected)
    }
  })

  it('is pure ASCII (no emoji / non-ASCII glyphs in any line)', () => {
    for (const d of ALL_DEATH_MESSAGES) {
      const text = en[d.message as GameTextKey]
      // eslint-disable-next-line no-control-regex
      expect(/^[\x00-\x7F]*$/.test(text), `${d.source}: ${text}`).toBe(true)
    }
  })
})

import { en, t } from '@/content/i18n/en'
import type { GameTextKey } from '@/content/i18n/schema'
import { ALL_ITEMS } from '@/content/items/items'
import { SHOP_ENTRIES } from '@/content/shops/shop'
import { FORGE_ENTRIES } from '@/content/shops/forge'
import { OBSERVATORY_ENTRIES } from '@/content/shops/observatory'
import { GRANDMA_DIALOGUE } from '@/content/dialogue/grandma'
import { ASTRONOMER_DIALOGUE } from '@/content/dialogue/astronomer'
import { CAULDRON_RECIPES } from '@/content/recipes/cauldron'
import { GRIMOIRE_SPELLS } from '@/content/spells/grimoire'
import { ACT0_SECRETS } from '@/content/secrets'
import { TAVERN_RUMORS } from '@/content/tavern/rumors'
import { ALL_DEATH_MESSAGES, BESPOKE_DEATH_SOURCES } from '@/content/deathMessages'
import { deathBlurb } from '@/engine/quest/deathBlurb'
import { FIELD_REVEAL_THRESHOLDS } from '@/content/fieldReveal'
import { DRAGON_WORDS, DRAGON_SPEAKER_KEY } from '@/content/sun/caramelCore'

const KEYS = new Set(Object.keys(en))
const has = (key: string): boolean => KEYS.has(key)

describe('en.ts locale completeness', () => {
  it('every string in en is non-empty', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value, key).not.toBe('')
    }
  })

  it('t() resolves a known key', () => {
    expect(t('ui.candyCounter')).toBe(en['ui.candyCounter'])
  })

  it('every item display/desc key exists', () => {
    for (const item of ALL_ITEMS) {
      expect(has(item.displayKey), item.displayKey).toBe(true)
      expect(has(item.descKey), item.descKey).toBe(true)
    }
  })

  it('every shop/forge/observatory speech key exists', () => {
    for (const entry of [...SHOP_ENTRIES, ...FORGE_ENTRIES, ...OBSERVATORY_ENTRIES]) {
      expect(has(entry.speechKey), entry.speechKey).toBe(true)
    }
  })

  it('every dialogue line + speaker name key exists', () => {
    for (const def of [GRANDMA_DIALOGUE, ASTRONOMER_DIALOGUE]) {
      expect(has(def.nameKey), def.nameKey).toBe(true)
      for (const variant of def.variants) {
        for (const line of variant.lines) expect(has(line), line).toBe(true)
      }
    }
  })

  it('every recipe / spell / secret / rumor / death key exists', () => {
    for (const r of CAULDRON_RECIPES) expect(has(r.displayKey), r.displayKey).toBe(true)
    for (const s of GRIMOIRE_SPELLS) expect(has(s.displayKey), s.displayKey).toBe(true)
    for (const s of ACT0_SECRETS) expect(has(s.revealKey), s.revealKey).toBe(true)
    for (const r of TAVERN_RUMORS) expect(has(r.textKey), r.textKey).toBe(true)
    for (const d of ALL_DEATH_MESSAGES) {
      expect(has(d.message), d.message).toBe(true)
    }
  })

  it('every bespoke death source resolves to its OWN non-generic line (§19 coverage)', () => {
    for (const source of BESPOKE_DEATH_SOURCES) {
      const key = deathBlurb(source, ALL_DEATH_MESSAGES)
      expect(has(key), source).toBe(true)
      expect(key, source).not.toBe('death.generic')
    }
  })

  it('every reveal action has an i18n label key', () => {
    for (const threshold of FIELD_REVEAL_THRESHOLDS) {
      const key = `action.${threshold.action}` as GameTextKey
      expect(has(key), key).toBe(true)
    }
  })

  it('the solar dragon speaker + every small word resolve to non-empty i18n strings (Act 4 — the caramel core)', () => {
    expect(has(DRAGON_SPEAKER_KEY), DRAGON_SPEAKER_KEY).toBe(true)
    expect(t(DRAGON_SPEAKER_KEY)).toBeTruthy()
    for (const key of DRAGON_WORDS) {
      expect(has(key), key).toBe(true)
      expect(t(key), key).toBeTruthy()
    }
  })

  it("the endings' terminal sky lines resolve to non-empty i18n strings (Act 4 — the choice)", () => {
    for (const key of ['ending.hatch.sky', 'ending.feed.sky'] as const) {
      expect(has(key), key).toBe(true)
      expect(t(key), key).toBeTruthy()
    }
  })

  it('ending 3 (EAT IT) — the §367 inverted-opening lines resolve (the eater\'s line now yours)', () => {
    for (const key of ['ending.eat.darkOpening', 'ending.eat.darkSky'] as const) {
      expect(has(key), key).toBe(true)
      expect(t(key), key).toBeTruthy()
    }
    // The deadpan inversion: the light run opened on "You have 1 candy"; the dark run opens on 8,100 stars.
    expect(t('ending.eat.darkOpening')).toContain('8,100')
  })
})

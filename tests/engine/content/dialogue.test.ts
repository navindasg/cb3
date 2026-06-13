import { createDefaultSave } from '@/engine/state/defaultSave'
import { selectVariant, variantEligible, markVariantShown } from '@/engine/content/dialogue'
import { GRANDMA_DIALOGUE } from '@/content/dialogue/grandma'
import { ASTRONOMER_DIALOGUE } from '@/content/dialogue/astronomer'
import type { GameState } from '@/engine/types/GameState'

describe('grandma dialogue selection', () => {
  it('shows the intro on the first visit (metGrandma unset)', () => {
    const variant = selectVariant(GRANDMA_DIALOGUE, createDefaultSave())
    expect(variant?.id).toBe('intro')
    expect(variant?.setsFlag).toBe('metGrandma')
  })

  it('marking the intro shown sets metGrandma', () => {
    const intro = selectVariant(GRANDMA_DIALOGUE, createDefaultSave())!
    const after = markVariantShown(createDefaultSave(), intro)
    expect(after.flags['metGrandma']).toBe(true)
  })

  it('shows the mantle foreshadow on later visits (metGrandma set, intro hidden)', () => {
    const met: GameState = { ...createDefaultSave(), flags: { metGrandma: true } }
    const variant = selectVariant(GRANDMA_DIALOGUE, met)
    expect(variant?.id).toBe('mantleForeshadow')
  })
})

describe('astronomer dialogue selection', () => {
  it('pitches before the telescope is owned', () => {
    expect(selectVariant(ASTRONOMER_DIALOGUE, createDefaultSave())?.id).toBe('pitch')
  })

  it('murmurs about stars once the telescope is owned', () => {
    const owned: GameState = { ...createDefaultSave(), flags: { telescopeOwned: true } }
    expect(selectVariant(ASTRONOMER_DIALOGUE, owned)?.id).toBe('postTelescope')
  })
})

describe('variantEligible / markVariantShown edge cases', () => {
  it('requiresFlag gates a variant', () => {
    expect(
      variantEligible({ id: 'x', lines: [], requiresFlag: 'foo' }, createDefaultSave()),
    ).toBe(false)
  })

  it('hiddenWhenFlag hides a variant', () => {
    const state: GameState = { ...createDefaultSave(), flags: { foo: true } }
    expect(variantEligible({ id: 'x', lines: [], hiddenWhenFlag: 'foo' }, state)).toBe(false)
  })

  it('returns null when no variant is eligible', () => {
    const def = { speaker: 's', nameKey: 'n', variants: [{ id: 'x', lines: [], requiresFlag: 'never' }] }
    expect(selectVariant(def, createDefaultSave())).toBeNull()
  })

  it('markVariantShown is a no-op (same ref) when there is no setsFlag or it is set', () => {
    const state = createDefaultSave()
    expect(markVariantShown(state, { id: 'x', lines: [] })).toBe(state)
    const set: GameState = { ...state, flags: { done: true } }
    expect(markVariantShown(set, { id: 'x', lines: [], setsFlag: 'done' })).toBe(set)
  })
})

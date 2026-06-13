import { createDefaultSave } from '@/engine/state/defaultSave'
import { addResource } from '@/engine/types/Resource'
import { eatCandies, throwCandies } from '@/engine/state/reducers'
import { grantItem } from '@/engine/shop/purchase'
import { isRevealed, revealedActions } from '@/engine/content/reveal'
import { selectVariant, markVariantShown } from '@/engine/content/dialogue'
import { FIELD_REVEAL_THRESHOLDS } from '@/content/fieldReveal'
import { GRANDMA_DIALOGUE, GRANDMA_INTRO_VARIANT_ID } from '@/content/dialogue/grandma'
import { WOODEN_SPOON } from '@/content/items/items'
import type { GameState } from '@/engine/types/GameState'

function withCandies(n: number): GameState {
  const s = createDefaultSave()
  return { ...s, candies: addResource(s.candies, n - s.candies.current) }
}

describe('F1: your field & house — the opener', () => {
  it('eat moves a candy from the balance into lifetimeCandiesEaten', () => {
    const after = eatCandies(withCandies(3), 1)
    expect(after.candies.current).toBe(2)
    expect(after.lifetimeCandiesEaten).toBe(1)
  })

  it('only "eat" is revealed at the first candy; "throw" appears at the threshold', () => {
    expect(revealedActions(FIELD_REVEAL_THRESHOLDS, withCandies(1))).toEqual(['eat'])
    expect(isRevealed(FIELD_REVEAL_THRESHOLDS, 'throw', withCandies(1))).toBe(false)
    expect(isRevealed(FIELD_REVEAL_THRESHOLDS, 'throw', withCandies(5))).toBe(true)
  })

  it('throw accrues lifetimeCandiesThrown', () => {
    const after = throwCandies(withCandies(5), 2)
    expect(after.lifetimeCandiesThrown).toBe(2)
  })

  it('grandma grants the wooden spoon via the intro variant (sets spoonOwned + equips)', () => {
    const state = createDefaultSave()
    const variant = selectVariant(GRANDMA_DIALOGUE, state)
    expect(variant?.id).toBe(GRANDMA_INTRO_VARIANT_ID)
    // The wiring on showing the intro: mark it seen, then grant the spoon.
    const seen = markVariantShown(state, variant!)
    const granted = grantItem(seen, WOODEN_SPOON)
    expect(granted.flags['metGrandma']).toBe(true)
    expect(granted.flags['spoonOwned']).toBe(true)
    expect(granted.equipped.weapon).toBe('woodenSpoon')
  })
})

import { createDefaultSave } from '@/engine/state/defaultSave'
import { createResource } from '@/engine/types/Resource'
import { revealedActions, isRevealed } from '@/engine/content/reveal'
import { FIELD_REVEAL_THRESHOLDS } from '@/content/fieldReveal'
import type { GameState } from '@/engine/types/GameState'

function withMax(max: number): GameState {
  return { ...createDefaultSave(), candies: { current: 0, lifetimeAccumulated: max, historicalMax: max } }
}

describe('progressive reveal by candy high-water mark', () => {
  it('reveals only "eat" at the first candy', () => {
    expect(revealedActions(FIELD_REVEAL_THRESHOLDS, withMax(1))).toEqual(['eat'])
  })

  it('reveals "throw" once the high-water mark reaches 5', () => {
    expect(revealedActions(FIELD_REVEAL_THRESHOLDS, withMax(5))).toEqual(['eat', 'throw'])
  })

  it('reveals nothing below the lowest threshold', () => {
    expect(revealedActions(FIELD_REVEAL_THRESHOLDS, withMax(0))).toEqual([])
  })

  it('a control stays revealed even after the balance is spent (uses historicalMax)', () => {
    // current 0 but historicalMax 5 → throw stays revealed (CB2 invariant).
    const spent: GameState = { ...createDefaultSave(), candies: createResource(0) }
    const everHadFive: GameState = {
      ...spent,
      candies: { current: 0, lifetimeAccumulated: 5, historicalMax: 5 },
    }
    expect(isRevealed(FIELD_REVEAL_THRESHOLDS, 'throw', everHadFive)).toBe(true)
  })

  it('isRevealed is false for an unknown action', () => {
    expect(isRevealed(FIELD_REVEAL_THRESHOLDS, 'sing', withMax(1000))).toBe(false)
  })
})

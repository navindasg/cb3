import {
  flavorFusionLearned,
  learnFusion,
  canTradeSour,
  tradeSour,
} from '@/engine/content/sourPlanet'
import { SOUR_TRADE_CANDY_COST, SOUR_TRADE_BATCH } from '@/content/planet/sourPlanet'
import { FLAVOR_FUSION_FLAG } from '@/content/flags'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { createResource } from '@/engine/types/Resource'
import type { GameState } from '@/engine/types/GameState'

const withCandies = (n: number): GameState => ({ ...createDefaultSave(), candies: createResource(n) })

describe('the sour planet — learning flavor fusion', () => {
  it('starts unlearned and is learned once the elder teaches you', () => {
    const s = createDefaultSave()
    expect(flavorFusionLearned(s)).toBe(false)
    const result = learnFusion(s)
    expect(result.ok).toBe(true)
    expect(result.state.flags[FLAVOR_FUSION_FLAG]).toBe(true)
    expect(flavorFusionLearned(result.state)).toBe(true)
  })

  it('is a no-op (same reference) once already learned', () => {
    const learned = learnFusion(createDefaultSave()).state
    const again = learnFusion(learned)
    expect(again.ok).toBe(false)
    expect(again.state).toBe(learned)
  })
})

describe('the sour planet — trading for sour essence', () => {
  it('trades a candy batch for sour essence', () => {
    const s = withCandies(SOUR_TRADE_CANDY_COST * 2)
    expect(canTradeSour(s)).toBe(true)
    const result = tradeSour(s)
    expect(result.ok).toBe(true)
    expect(result.state.candies.current).toBe(SOUR_TRADE_CANDY_COST)
    expect(result.state.sour.current).toBe(SOUR_TRADE_BATCH)
  })

  it('refuses (same reference) when candies are short', () => {
    const s = withCandies(SOUR_TRADE_CANDY_COST - 1)
    expect(canTradeSour(s)).toBe(false)
    const result = tradeSour(s)
    expect(result.ok).toBe(false)
    expect(result.state).toBe(s)
  })
})

import { createDefaultSave } from '@/engine/state/defaultSave'
import { payToll, TOLL_GIANT_COST } from '@/engine/content/tollGiant'
import type { GameState } from '@/engine/types/GameState'

const FLAG = 'tollGiantPaid'
const withCandies = (n: number): GameState => ({
  ...createDefaultSave(),
  candies: { current: n, lifetimeAccumulated: n, historicalMax: n },
})

describe('the toll giant', () => {
  it('pays the toll: spends the candies and opens the bridge', () => {
    const before = withCandies(TOLL_GIANT_COST + 500)
    const result = payToll(before, TOLL_GIANT_COST, FLAG)
    expect(result.ok).toBe(true)
    expect(result.state.candies.current).toBe(500)
    expect(result.state.flags[FLAG]).toBe(true)
  })

  it('refuses when the toll is unaffordable (same reference, no flag)', () => {
    const before = withCandies(TOLL_GIANT_COST - 1)
    const result = payToll(before, TOLL_GIANT_COST, FLAG)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
    expect(before.flags[FLAG]).toBeUndefined()
  })

  it('is idempotent: refuses a second payment once already paid (no double charge)', () => {
    const first = payToll(withCandies(TOLL_GIANT_COST * 3), TOLL_GIANT_COST, FLAG)
    const second = payToll(first.state, TOLL_GIANT_COST, FLAG)
    expect(second.ok).toBe(false)
    expect(second.reason).toBe('alreadyPaid')
    expect(second.state).toBe(first.state) // unchanged — not charged again
    expect(second.state.candies.current).toBe(TOLL_GIANT_COST * 2) // only the first toll left
  })

  it('does not mutate the input state', () => {
    const before = withCandies(TOLL_GIANT_COST)
    payToll(before, TOLL_GIANT_COST, FLAG)
    expect(before.candies.current).toBe(TOLL_GIANT_COST)
    expect(before.flags[FLAG]).toBeUndefined()
  })
})

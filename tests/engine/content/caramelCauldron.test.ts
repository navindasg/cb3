import { canBoilCaramel, boilCaramel } from '@/engine/content/caramelCauldron'
import { BOIL_CANDY_COST, CARAMEL_PER_BOIL } from '@/content/recipes/caramelBoil'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { createResource } from '@/engine/types/Resource'
import type { GameState } from '@/engine/types/GameState'

/** A save with a chosen number of candies (and otherwise default; caramel starts at 0). */
const withCandies = (candies: number): GameState => ({
  ...createDefaultSave(),
  candies: createResource(candies),
})

describe('the caramel cauldron — boiling candies into caramel (§111)', () => {
  it('boils one batch: spends exactly BOIL_CANDY_COST candies and adds CARAMEL_PER_BOIL caramel', () => {
    const before = withCandies(1000)
    const result = boilCaramel(before)
    expect(result.ok).toBe(true)
    expect(result.state.candies.current).toBe(1000 - BOIL_CANDY_COST)
    expect(result.state.caramel.current).toBe(CARAMEL_PER_BOIL)
  })

  it('the §111 industry step is exactly 100 candies -> 1 caramel', () => {
    expect(BOIL_CANDY_COST).toBe(100)
    expect(CARAMEL_PER_BOIL).toBe(1)
  })

  it('refuses when candies are short (SAME reference, ok:false, nothing touched)', () => {
    const before = withCandies(BOIL_CANDY_COST - 1)
    const result = boilCaramel(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
    expect(before.candies.current).toBe(BOIL_CANDY_COST - 1)
    expect(before.caramel.current).toBe(0)
  })

  it('never overdrafts at exactly the cost (boils, leaves 0 candies)', () => {
    const result = boilCaramel(withCandies(BOIL_CANDY_COST))
    expect(result.ok).toBe(true)
    expect(result.state.candies.current).toBe(0)
    expect(result.state.caramel.current).toBe(CARAMEL_PER_BOIL)
  })

  it('does not mutate the input state (immutability)', () => {
    const before = withCandies(1000)
    const candiesRef = before.candies
    const caramelRef = before.caramel
    boilCaramel(before)
    expect(before.candies).toBe(candiesRef)
    expect(before.candies.current).toBe(1000)
    expect(before.caramel).toBe(caramelRef)
    expect(before.caramel.current).toBe(0)
  })

  it('leaves every OTHER resource untouched', () => {
    const before = { ...withCandies(1000), rockCandy: createResource(42), peppermint: createResource(7) }
    const result = boilCaramel(before)
    expect(result.ok).toBe(true)
    expect(result.state.rockCandy.current).toBe(42)
    expect(result.state.peppermint.current).toBe(7)
  })

  it('caramel.historicalMax tracks once boiled, so the HUD reveal (historicalMax > 0) fires', () => {
    const before = withCandies(1000)
    expect(before.caramel.historicalMax).toBe(0) // hidden in the status bar at the start
    const result = boilCaramel(before)
    expect(result.state.caramel.historicalMax).toBeGreaterThan(0) // now revealed
  })

  it('canBoilCaramel mirrors the candy threshold exactly', () => {
    expect(canBoilCaramel(withCandies(BOIL_CANDY_COST))).toBe(true)
    expect(canBoilCaramel(withCandies(BOIL_CANDY_COST + 1))).toBe(true)
    expect(canBoilCaramel(withCandies(BOIL_CANDY_COST - 1))).toBe(false)
    expect(canBoilCaramel(withCandies(0))).toBe(false)
  })
})

describe('anti-soft-lock guard — caramel now has at least one source', () => {
  it('caramel can be obtained from candies alone (no other resource or flag required)', () => {
    // The whole point of Increment 0: caramel was a RESOURCE_KEY with ZERO source. Boiling from a fresh
    // save's candies (plus enough to afford one batch) must produce caramel, with nothing else needed.
    const before = withCandies(BOIL_CANDY_COST)
    expect(before.caramel.current).toBe(0)
    const result = boilCaramel(before)
    expect(result.ok).toBe(true)
    expect(result.state.caramel.current).toBeGreaterThan(0)
  })
})

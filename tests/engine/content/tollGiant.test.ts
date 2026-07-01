import { createDefaultSave } from '@/engine/state/defaultSave'
import {
  payToll,
  TOLL_GIANT_COST,
  takeTollLoss,
  currentTollCost,
  hasTollMercy,
  TOLL_MERCY_FLAG,
  TOLL_SIZED_UP_FLAG,
  TOLL_MERCY_DISCOUNT,
} from '@/engine/content/tollGiant'
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

describe('the toll giant — the mercy secret (§18)', () => {
  it('starts at the full toll, no mercy', () => {
    const s = createDefaultSave()
    expect(hasTollMercy(s)).toBe(false)
    expect(currentTollCost(s)).toBe(TOLL_GIANT_COST)
  })

  /** The two-strike helper: the second deliberate loss is the one that earns mercy. */
  const beMerciful = (): GameState => takeTollLoss(takeTollLoss(createDefaultSave()).state).state

  it('the FIRST loss just sizes him up — no mercy yet, the death line plays (firstLoss)', () => {
    const s = createDefaultSave()
    const result = takeTollLoss(s)
    expect(result.ok).toBe(false)
    expect(result.firstLoss).toBe(true)
    expect(result.state.flags[TOLL_SIZED_UP_FLAG]).toBe(true)
    expect(result.state.flags[TOLL_MERCY_FLAG]).toBeUndefined()
    expect(hasTollMercy(result.state)).toBe(false)
  })

  it('the SECOND, deliberate loss earns the mercy flag', () => {
    const first = takeTollLoss(createDefaultSave())
    const second = takeTollLoss(first.state)
    expect(second.ok).toBe(true)
    expect(second.firstLoss).toBe(false)
    expect(second.state.flags[TOLL_MERCY_FLAG]).toBe(true)
    expect(hasTollMercy(second.state)).toBe(true)
  })

  it('applies exactly a 10% discount, floored to a whole candy', () => {
    const merciful = beMerciful()
    expect(TOLL_MERCY_DISCOUNT).toBe(0.1)
    expect(currentTollCost(merciful)).toBe(Math.floor(TOLL_GIANT_COST * 0.9))
    expect(currentTollCost(merciful)).toBe(90_000)
  })

  it('respects a custom base toll when discounting', () => {
    const merciful = beMerciful()
    expect(currentTollCost(merciful, 999)).toBe(Math.floor(999 * 0.9)) // 899, floored
  })

  it('is a no-op (same reference) once mercy is already granted — nothing to farm', () => {
    const merciful = beMerciful()
    const again = takeTollLoss(merciful)
    expect(again.ok).toBe(false)
    expect(again.firstLoss).toBe(false)
    expect(again.state).toBe(merciful)
  })

  it('does not mutate the input state on either loss', () => {
    const before = createDefaultSave()
    takeTollLoss(before)
    expect(before.flags[TOLL_SIZED_UP_FLAG]).toBeUndefined()
    const sizedUp = takeTollLoss(before).state
    takeTollLoss(sizedUp)
    expect(sizedUp.flags[TOLL_MERCY_FLAG]).toBeUndefined()
  })

  it('a merciful player pays the discounted toll through payToll', () => {
    const merciful: GameState = {
      ...beMerciful(),
      candies: { current: 90_000, lifetimeAccumulated: 90_000, historicalMax: 90_000 },
    }
    const cost = currentTollCost(merciful)
    // At the full toll this pile (90k) would be unaffordable; at mate's-rates it exactly covers it.
    const paid = payToll(merciful, cost, FLAG)
    expect(paid.ok).toBe(true)
    expect(paid.state.candies.current).toBe(0)
    expect(paid.state.flags[FLAG]).toBe(true)
  })
})

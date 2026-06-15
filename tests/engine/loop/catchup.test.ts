import { applyOfflineCatchup } from '@/engine/loop/catchup'
import { createDefaultSave } from '@/engine/state/defaultSave'
import type { ProducerDef } from '@/engine/types/defs'

const HOUR = 3_600_000
const oneCandyPerSec: ProducerDef[] = [{ id: 'base', resource: 'candies', getRate: () => 1 }]

describe('applyOfflineCatchup', () => {
  it('credits rate * elapsed candies', () => {
    const { state, result } = applyOfflineCatchup(createDefaultSave(), 10_000, oneCandyPerSec, {
      capMs: HOUR,
    })
    expect(result.gained).toBe(10)
    expect(state.candies.current).toBe(11) // started at 1
    expect(state.candies.lifetimeAccumulated).toBe(11) // offline candies were "earned"
  })

  it('does not advance accumulatedGameTimeMs (offline is not active play)', () => {
    const before = createDefaultSave()
    const { state } = applyOfflineCatchup(before, HOUR, oneCandyPerSec, { capMs: 24 * HOUR })
    expect(state.accumulatedGameTimeMs).toBe(before.accumulatedGameTimeMs)
  })

  it('doubles gains while the candy box is closed', () => {
    const closed = { ...createDefaultSave(), boxClosed: true }
    const { result } = applyOfflineCatchup(closed, HOUR, oneCandyPerSec, { capMs: 24 * HOUR })
    expect(result.multiplier).toBe(2)
    expect(result.gained).toBe(2 * 3600)
  })

  it('respects the cap', () => {
    const { result } = applyOfflineCatchup(createDefaultSave(), 10 * HOUR, oneCandyPerSec, {
      capMs: 2 * HOUR,
    })
    expect(result.appliedMs).toBe(2 * HOUR)
    expect(result.gained).toBe(2 * 3600)
  })

  it('does not mutate the input state', () => {
    const before = createDefaultSave()
    applyOfflineCatchup(before, HOUR, oneCandyPerSec, { capMs: 24 * HOUR })
    expect(before.candies.current).toBe(1)
  })
})

describe('applyOfflineCatchup — every produced resource accrues (not just candies)', () => {
  // Act 1 introduced the first non-candy passive producer (cotton candy, from the cloud-sheep
  // paddock). Offline catch-up must mirror the foreground tick and credit it too, else an idle
  // resource pays out only while the tab is in the foreground.
  const candyAndCotton: ProducerDef[] = [
    { id: 'field', resource: 'candies', getRate: () => 1 },
    { id: 'sheep', resource: 'cottonCandy', getRate: () => 2 },
  ]

  it('credits a non-candy resource offline using its own rate', () => {
    const { state } = applyOfflineCatchup(createDefaultSave(), 10_000, candyAndCotton, {
      capMs: HOUR,
    })
    expect(state.cottonCandy.current).toBe(20) // 2/s * 10s
    expect(state.cottonCandy.lifetimeAccumulated).toBe(20)
    expect(state.candies.current).toBe(11) // 1/s * 10s + the starting candy
  })

  it('shares the cap and the box ×2 across resources', () => {
    const closed = { ...createDefaultSave(), boxClosed: true }
    const { state, result } = applyOfflineCatchup(closed, 10 * HOUR, candyAndCotton, {
      capMs: 2 * HOUR,
    })
    const cappedSecs = 2 * 3600 // 2h cap, in seconds
    expect(result.appliedMs).toBe(2 * HOUR) // candy result, capped
    expect(state.cottonCandy.current).toBe(2 * cappedSecs * 2) // rate 2 * 2h * ×2 box = 28800
    expect(state.candies.current).toBe(1 + 1 * cappedSecs * 2) // start 1 + rate 1 * 2h * ×2 = 14401
  })

  it('does not accrue (or churn) an inert non-candy producer at rate 0', () => {
    const inertCotton: ProducerDef[] = [
      { id: 'field', resource: 'candies', getRate: () => 1 },
      { id: 'sheep', resource: 'cottonCandy', getRate: () => 0 },
    ]
    const before = createDefaultSave()
    const { state } = applyOfflineCatchup(before, HOUR, inertCotton, { capMs: 24 * HOUR })
    expect(state.cottonCandy.current).toBe(0)
    expect(state.cottonCandy).toBe(before.cottonCandy) // same reference — no zero-delta churn
  })
})

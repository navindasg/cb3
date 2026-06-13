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

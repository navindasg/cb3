import { tick } from '@/engine/loop/tick'
import { createDefaultSave } from '@/engine/state/defaultSave'
import type { ProducerDef } from '@/engine/types/defs'

const oneCandyPerSec: ProducerDef = { id: 'base', resource: 'candies', getRate: () => 1 }

describe('tick', () => {
  it('produces rate * dt over a full second', () => {
    const after = tick(createDefaultSave(), 1000, [oneCandyPerSec])
    expect(after.candies.current).toBe(2) // started at 1, +1
  })

  it('scales sub-second steps', () => {
    const after = tick(createDefaultSave(), 100, [oneCandyPerSec])
    expect(after.candies.current).toBeCloseTo(1.1, 6)
  })

  it('advances accumulatedGameTimeMs', () => {
    expect(tick(createDefaultSave(), 250, []).accumulatedGameTimeMs).toBe(250)
  })

  it('sums multiple producers on the same resource', () => {
    const p2: ProducerDef = { id: 'p2', resource: 'candies', getRate: () => 4 }
    const after = tick(createDefaultSave(), 1000, [oneCandyPerSec, p2])
    expect(after.candies.current).toBe(6) // 1 + (1+4)
  })

  it('routes each producer to its declared resource', () => {
    const farm: ProducerDef = { id: 'farm', resource: 'lollipops', getRate: () => 2 }
    const after = tick(createDefaultSave(), 1000, [farm])
    expect(after.lollipops.current).toBe(2)
    expect(after.candies.current).toBe(1) // untouched
  })

  it('reads the production rate from current state', () => {
    const s = { ...createDefaultSave(), numbers: { rate: 10 } }
    const dynamic: ProducerDef = {
      id: 'dyn',
      resource: 'candies',
      getRate: (st) => st.numbers['rate'] ?? 0,
    }
    expect(tick(s, 1000, [dynamic]).candies.current).toBe(11)
  })

  it('skips zero-rate producers (no spurious resource churn)', () => {
    const idle: ProducerDef = { id: 'idle', resource: 'candies', getRate: () => 0 }
    const s = createDefaultSave()
    const after = tick(s, 1000, [idle])
    expect(after.candies).toBe(s.candies) // untouched reference — no delta applied
    expect(after.accumulatedGameTimeMs).toBe(1000)
  })

  it('is pure: equal output, no input mutation', () => {
    const s = createDefaultSave()
    const a = tick(s, 1000, [oneCandyPerSec])
    const b = tick(s, 1000, [oneCandyPerSec])
    expect(a).toEqual(b)
    expect(s.candies.current).toBe(1)
    expect(s.accumulatedGameTimeMs).toBe(0)
  })
})

import {
  createResource,
  addResource,
  spendResource,
  canAfford,
} from '@/engine/types/Resource'

describe('createResource', () => {
  it('seeds all three fields', () => {
    expect(createResource(5)).toEqual({ current: 5, lifetimeAccumulated: 5, historicalMax: 5 })
    expect(createResource()).toEqual({ current: 0, lifetimeAccumulated: 0, historicalMax: 0 })
  })
})

describe('addResource', () => {
  it('accrues lifetime only on positive deltas', () => {
    const r1 = addResource(createResource(0), 10)
    expect(r1).toEqual({ current: 10, lifetimeAccumulated: 10, historicalMax: 10 })
    const r2 = addResource(r1, -4)
    expect(r2.current).toBe(6)
    expect(r2.lifetimeAccumulated).toBe(10) // spending-as-negative does not shrink lifetime
  })

  it('never overdrafts current below zero', () => {
    expect(addResource(createResource(3), -10).current).toBe(0)
  })

  it('tracks the high-water mark', () => {
    let r = createResource(0)
    r = addResource(r, 100)
    r = addResource(r, -100)
    expect(r.current).toBe(0)
    expect(r.historicalMax).toBe(100)
  })

  it('does not mutate its input', () => {
    const r = createResource(1)
    addResource(r, 5)
    expect(r).toEqual({ current: 1, lifetimeAccumulated: 1, historicalMax: 1 })
  })
})

describe('spendResource', () => {
  it('returns null when unaffordable', () => {
    expect(spendResource(createResource(5), 6)).toBeNull()
  })

  it('deducts exactly and preserves lifetime totals', () => {
    const after = spendResource(createResource(5), 5)
    expect(after).not.toBeNull()
    expect(after?.current).toBe(0)
    expect(after?.lifetimeAccumulated).toBe(5)
  })

  it('rejects negative amounts', () => {
    expect(() => spendResource(createResource(5), -1)).toThrow()
  })
})

describe('canAfford', () => {
  it('reflects the balance', () => {
    expect(canAfford(createResource(5), 5)).toBe(true)
    expect(canAfford(createResource(5), 6)).toBe(false)
  })
})

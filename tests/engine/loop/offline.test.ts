import { computeOfflineCatchup } from '@/engine/loop/offline'

const HOUR = 3_600_000

describe('computeOfflineCatchup', () => {
  it('awards rate * elapsed seconds', () => {
    const r = computeOfflineCatchup({ elapsedMs: 10_000, ratePerSec: 5, boxClosed: false, capMs: HOUR })
    expect(r.gained).toBe(50)
    expect(r.appliedMs).toBe(10_000)
  })

  it('clamps clock rollback to zero gain', () => {
    const r = computeOfflineCatchup({ elapsedMs: -5000, ratePerSec: 5, boxClosed: false, capMs: HOUR })
    expect(r.gained).toBe(0)
    expect(r.appliedMs).toBe(0)
  })

  it('caps elapsed at capMs and reports the discarded remainder', () => {
    const r = computeOfflineCatchup({ elapsedMs: 10 * HOUR, ratePerSec: 1, boxClosed: false, capMs: 2 * HOUR })
    expect(r.appliedMs).toBe(2 * HOUR)
    expect(r.gained).toBe(2 * 3600)
    expect(r.cappedMs).toBe(8 * HOUR)
  })

  it('doubles gains when the box is closed (the Schrödinger mechanic)', () => {
    const open = computeOfflineCatchup({ elapsedMs: HOUR, ratePerSec: 1, boxClosed: false, capMs: 24 * HOUR })
    const closed = computeOfflineCatchup({ elapsedMs: HOUR, ratePerSec: 1, boxClosed: true, capMs: 24 * HOUR })
    expect(closed.gained).toBe(open.gained * 2)
    expect(closed.multiplier).toBe(2)
  })

  it('matches summing N discrete ticks (linear production)', () => {
    const ratePerSec = 3
    const stepMs = 100
    const steps = 600
    let summed = 0
    for (let i = 0; i < steps; i++) summed += ratePerSec * (stepMs / 1000)
    const r = computeOfflineCatchup({
      elapsedMs: steps * stepMs,
      ratePerSec,
      boxClosed: false,
      capMs: HOUR,
    })
    expect(r.gained).toBeCloseTo(summed, 6)
  })
})

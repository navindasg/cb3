import { createLoopDriver, browserClock, type DriverClock } from '@/engine/loop/driver'

function fakeClock() {
  let t = 0
  let pending: (() => void) | null = null
  let handle = 0
  const clock: DriverClock = {
    now: () => t,
    schedule: (cb) => {
      pending = cb
      return ++handle
    },
    cancel: () => {
      pending = null
    },
  }
  return {
    clock,
    advance: (ms: number) => {
      t += ms
    },
    runFrame: () => {
      const cb = pending
      pending = null
      cb?.()
    },
    hasPending: () => pending !== null,
  }
}

describe('createLoopDriver', () => {
  it('runs one step per stepMs across frames', () => {
    const h = fakeClock()
    let steps = 0
    const driver = createLoopDriver(() => steps++, { clock: h.clock, stepMs: 100 })
    driver.start()
    for (let i = 0; i < 10; i++) {
      h.advance(100)
      h.runFrame()
    }
    expect(steps).toBe(10)
  })

  it('carries the sub-step remainder across frames', () => {
    const h = fakeClock()
    let steps = 0
    const driver = createLoopDriver(() => steps++, { clock: h.clock, stepMs: 100 })
    driver.start()
    h.advance(150)
    h.runFrame() // 1 step, 50ms remainder
    expect(steps).toBe(1)
    h.advance(50)
    h.runFrame() // remainder + 50 = 100 -> 1 more step
    expect(steps).toBe(2)
  })

  it('clamps a long gap to maxDelta (offline catch-up handles the rest)', () => {
    const h = fakeClock()
    let steps = 0
    const driver = createLoopDriver(() => steps++, { clock: h.clock, stepMs: 100, maxDeltaMs: 250 })
    driver.start()
    h.advance(10_000)
    h.runFrame()
    expect(steps).toBe(2) // min(10000, 250) / 100
  })

  it('breaks the spiral of death at maxUpdates', () => {
    const h = fakeClock()
    let steps = 0
    const driver = createLoopDriver(() => steps++, {
      clock: h.clock,
      stepMs: 100,
      maxDeltaMs: 1_000_000,
      maxUpdates: 3,
    })
    driver.start()
    h.advance(10_000)
    h.runFrame()
    expect(steps).toBe(3)
  })

  it('stops cleanly and ignores subsequent frames', () => {
    const h = fakeClock()
    let steps = 0
    const driver = createLoopDriver(() => steps++, { clock: h.clock, stepMs: 100 })
    driver.start()
    expect(driver.isRunning()).toBe(true)
    driver.stop()
    expect(driver.isRunning()).toBe(false)
    h.advance(1000)
    h.runFrame()
    expect(steps).toBe(0)
  })

  it('start is idempotent', () => {
    const h = fakeClock()
    let steps = 0
    const driver = createLoopDriver(() => steps++, { clock: h.clock, stepMs: 100 })
    driver.start()
    driver.start() // no-op, must not reset or double-schedule
    h.advance(100)
    h.runFrame()
    expect(steps).toBe(1)
  })

  it('browserClock exposes a numeric clock', () => {
    expect(typeof browserClock.now()).toBe('number')
  })
})

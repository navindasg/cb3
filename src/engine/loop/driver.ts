// The foreground simulation driver: one animation-frame loop with a fixed-timestep
// accumulator. It decides only *when* to step; the *amount* of offline time is
// never recovered here (a long gap is clamped to maxDelta — offline catch-up
// credits the real elapsed time separately). Clock + frame scheduling are injected
// so the whole loop is unit-testable with plain numbers, no real timers.

export interface DriverClock {
  now(): number
  schedule(callback: () => void): number
  cancel(handle: number): void
}

export interface LoopDriverOptions {
  clock: DriverClock
  stepMs?: number
  maxDeltaMs?: number
  maxUpdates?: number
}

export interface LoopDriver {
  start(): void
  stop(): void
  isRunning(): boolean
}

export function createLoopDriver(
  onStep: (stepMs: number) => void,
  options: LoopDriverOptions,
): LoopDriver {
  const { clock } = options
  const stepMs = options.stepMs ?? 100
  const maxDeltaMs = options.maxDeltaMs ?? 250
  const maxUpdates = options.maxUpdates ?? 50

  let running = false
  let handle: number | null = null
  let last = 0
  let lag = 0

  function frame(): void {
    if (!running) return
    const now = clock.now()
    lag += Math.min(now - last, maxDeltaMs) // clamp refocus spikes
    last = now

    let updates = 0
    while (lag >= stepMs) {
      onStep(stepMs)
      lag -= stepMs
      if (++updates >= maxUpdates) {
        lag = 0 // spiral-of-death break
        break
      }
    }
    handle = clock.schedule(frame)
  }

  return {
    start() {
      if (running) return
      running = true
      last = clock.now()
      lag = 0
      handle = clock.schedule(frame)
    },
    stop() {
      running = false
      if (handle !== null) {
        clock.cancel(handle)
        handle = null
      }
    },
    isRunning: () => running,
  }
}

/** Real browser clock. Tests inject a fake; production wiring uses this. */
export const browserClock: DriverClock = {
  now: () => performance.now(),
  schedule: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
}

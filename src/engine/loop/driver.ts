// The foreground simulation driver: one animation-frame loop with a fixed-timestep
// accumulator. It decides only *when* to step; the *amount* of offline time is
// never recovered here (a long gap is clamped to maxDelta — offline catch-up
// credits the real elapsed time separately). Clock + frame scheduling are injected
// so the whole loop is unit-testable with plain numbers, no real timers.
//
// A dev-only `speed` multiplier (see engine/loop/timeScale) lets a playtester blitz the
// arc: the loop still ticks at the fixed cadence, but each step advances the SIM by
// `stepMs * speed` of game time, scaling production and every accumulated-time path
// uniformly. Speed is always ≥ 1 (clamped) and defaults to 1; production builds never
// wire the control, so the multiplier stays at 1 there.

import { MIN_SPEED, clampSpeed, scaledStep } from '@/engine/loop/timeScale'

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
  /** Initial dev-only time multiplier (clamped to the timeScale range). Defaults to 1. */
  initialSpeed?: number
}

export interface LoopDriver {
  start(): void
  stop(): void
  isRunning(): boolean
  /** The current dev-only time multiplier (always ≥ 1). */
  getSpeed(): number
  /** Set the dev-only time multiplier live; the value is clamped to the sane range. */
  setSpeed(speed: number): void
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
  let speed = options.initialSpeed === undefined ? MIN_SPEED : clampSpeed(options.initialSpeed)

  function frame(): void {
    if (!running) return
    const now = clock.now()
    lag += Math.min(now - last, maxDeltaMs) // clamp refocus spikes
    last = now

    let updates = 0
    while (lag >= stepMs) {
      // The cadence is fixed (one step per stepMs of real time); speed scales only the
      // SIM game time each step represents, so production + lifecycle stretch uniformly.
      onStep(scaledStep(stepMs, speed))
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
    getSpeed: () => speed,
    setSpeed(next: number) {
      speed = clampSpeed(next)
    },
  }
}

/** Real browser clock. Tests inject a fake; production wiring uses this. */
export const browserClock: DriverClock = {
  now: () => performance.now(),
  schedule: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
}

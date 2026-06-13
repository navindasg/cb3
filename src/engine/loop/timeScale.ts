// Dev-only time acceleration (pure). A speed multiplier scales how much SIM game time one
// real sim step advances: each step feeds `scaledStep(stepMs, speed)` into the lifecycle, so
// production, accumulatedGameTimeMs, and every accumulated-time content path (the star descent,
// the seed gate) all stretch by the same factor — the loop still steps at the fixed cadence.
//
// This lives in engine/ (pure, no DOM) so the clamp/parse logic is unit-tested, even though the
// dev panel that drives it (render/devPanel) is DOM-only glue gated behind import.meta.env.DEV.
// In a production build the panel is absent and the speed is always MIN_SPEED.

/** Speed is always ≥ 1 (never slow down) and capped so a single scaled step stays sane. */
export const MIN_SPEED = 1
export const MAX_SPEED = 1000

/** Clamp an arbitrary number to the [MIN_SPEED, MAX_SPEED] integer range; non-finite ⇒ MIN. */
export function clampSpeed(value: number): number {
  if (!Number.isFinite(value)) return MIN_SPEED
  const rounded = Math.round(value)
  if (rounded < MIN_SPEED) return MIN_SPEED
  if (rounded > MAX_SPEED) return MAX_SPEED
  return rounded
}

/**
 * Read an initial speed from a query string (e.g. `?speed=100`), clamped to the sane range.
 * Anything missing or unparseable falls back to MIN_SPEED so a normal URL runs at 1×.
 */
export function parseSpeedParam(search: string): number {
  const raw = new URLSearchParams(search).get('speed')
  if (raw === null) return MIN_SPEED
  return clampSpeed(Number(raw))
}

/** The SIM game-time one real step advances at this speed: `stepMs * clampSpeed(speed)`. */
export function scaledStep(stepMs: number, speed: number): number {
  return stepMs * clampSpeed(speed)
}

// Offline / background catch-up. The single most load-bearing correctness path:
// browser tab throttling, iOS suspension, and tab discard all mean the live loop
// stops, so the *amount* of production owed is computed analytically from a
// measured wall-clock delta — never by trusting that the loop kept running.

export interface OfflineCatchupParams {
  readonly elapsedMs: number
  readonly ratePerSec: number
  readonly boxClosed: boolean
  readonly capMs: number
}

export interface OfflineCatchupResult {
  readonly appliedMs: number // time actually credited (clamped + capped)
  readonly cappedMs: number // time discarded by the cap (for a "you were away a while" note)
  readonly multiplier: number
  readonly gained: number
}

/**
 * Closed-form catch-up for a constant production rate. O(1), and exactly equal to
 * summing N discrete ticks. Clock rollback (negative delta) awards nothing; time
 * is capped at `capMs`. The Schrödinger box "×2" lives here and ONLY here, and is
 * never surfaced in any tooltip or breakdown.
 */
export function computeOfflineCatchup(params: OfflineCatchupParams): OfflineCatchupResult {
  const safeElapsed = Math.max(0, params.elapsedMs)
  const appliedMs = Math.min(safeElapsed, Math.max(0, params.capMs))
  const cappedMs = safeElapsed - appliedMs
  const multiplier = params.boxClosed ? 2 : 1
  const gained = params.ratePerSec * (appliedMs / 1000) * multiplier
  return { appliedMs, cappedMs, multiplier, gained }
}

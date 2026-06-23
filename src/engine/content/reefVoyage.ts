import type { GameState } from '@/engine/types/GameState'
import { setNumber } from '@/engine/state/reducers'
import { REEF_LEG_KEY, REEF_WAYPOINT_KEY } from '@/content/reef/voyage'

// The first voyage's plot-a-course crossing (Act 2 — DESIGN §178). Pure & immutable, mirroring
// engine/content/lighthouse + moonStrata: compute from state, return the next state, a no-op returns
// the SAME reference. You plot the galleon's course out to the reef by picking the leg waypoints in
// order (the sextant lesson, applied); completing every leg reaches the reef. Progress lives in
// numbers; the arrival lives in a flag.

/**
 * Kept in lock-step with content/flags.REEF_REACHED_FLAG (content owns the named constant — the
 * lighthouse idiom). Set on the leg that completes the crossing so "reached" is pure-engine and
 * testable; the engine writes the literal here rather than importing the content value (ADR §3).
 */
const REEF_REACHED_FLAG = 'reefReached'

export function voyageLeg(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[REEF_LEG_KEY] ?? 0))
}

export function voyageWaypoint(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[REEF_WAYPOINT_KEY] ?? 0))
}

/** Whether the reef has been reached (the crossing plotted clean) — reads the flag. */
export function reefReached(state: GameState): boolean {
  return state.flags[REEF_REACHED_FLAG] === true
}

/** The leg currently being plotted (an ordered run of waypoint ids), or null when the reef is reached. */
export function currentLeg(
  state: GameState,
  legs: readonly (readonly string[])[],
): readonly string[] | null {
  return legs[voyageLeg(state)] ?? null
}

/** The next waypoint the leg expects (the one your pick should match now), or null once reached. */
export function expectedWaypoint(state: GameState, legs: readonly (readonly string[])[]): string | null {
  if (reefReached(state)) return null
  const leg = currentLeg(state, legs)
  return leg?.[voyageWaypoint(state)] ?? null
}

export interface PlotResult {
  readonly ok: boolean
  readonly state: GameState
  /** Was the picked waypoint the leg's expected next. */
  readonly correct: boolean
  /** True on the pick that completed the current leg (the next leg opens). */
  readonly legComplete: boolean
  /** True on the pick that completed the final leg (the reef is reached). */
  readonly reached: boolean
}

/**
 * Plot one waypoint into the current leg. A correct pick advances the plot; completing a leg's full
 * run steps to the next leg (or, on the final leg, reaches the reef and sets the flag). A wrong pick
 * loses the leg — the current run restarts (plot back to 0), so the crossing can never soft-lock.
 * No-op (SAME reference, ok:false) once the reef is already reached.
 */
export function plotWaypoint(
  state: GameState,
  waypointId: string,
  legs: readonly (readonly string[])[],
): PlotResult {
  if (reefReached(state)) {
    return { ok: false, state, correct: false, legComplete: false, reached: false }
  }

  const leg = currentLeg(state, legs)
  if (!leg) {
    return { ok: false, state, correct: false, legComplete: false, reached: false }
  }

  if (waypointId !== leg[voyageWaypoint(state)]) {
    // The bearing drifts — restart this leg's run (setNumber no-ops if already 0).
    const reset = setNumber(state, REEF_WAYPOINT_KEY, 0)
    return { ok: true, state: reset, correct: false, legComplete: false, reached: false }
  }

  const plotted = voyageWaypoint(state) + 1
  if (plotted < leg.length) {
    // Mid-leg: just advance the plot.
    return { ok: true, state: setNumber(state, REEF_WAYPOINT_KEY, plotted), correct: true, legComplete: false, reached: false }
  }

  // Leg complete — reset the plot and step to the next leg.
  const nextLeg = voyageLeg(state) + 1
  const advanced = setNumber(setNumber(state, REEF_LEG_KEY, nextLeg), REEF_WAYPOINT_KEY, 0)
  if (nextLeg < legs.length) {
    return { ok: true, state: advanced, correct: true, legComplete: true, reached: false }
  }

  // The final leg closed — the reef is reached.
  const reached: GameState = { ...advanced, flags: { ...advanced.flags, [REEF_REACHED_FLAG]: true } }
  return { ok: true, state: reached, correct: true, legComplete: true, reached: true }
}

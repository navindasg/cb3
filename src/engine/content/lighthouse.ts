import type { GameState } from '@/engine/types/GameState'
import { setNumber } from '@/engine/state/reducers'
import {
  LIGHTHOUSE_COURSE_KEY,
  LIGHTHOUSE_PLOT_KEY,
} from '@/content/moon/lighthouse'

// The lunar lighthouse's plot-a-course puzzle (Act 1 — DESIGN §167/§171). Pure & immutable, mirroring
// engine/content/hollowCore + moonStrata: compute from state, return the next state, no-op returns the
// SAME reference. The cyclops names an ordered course of stars; you pick them in order. Completing
// every course teaches celestial navigation (the Act-2 galleon prereq). Progress lives in numbers;
// the learned beat lives in a flag.

/**
 * Kept in lock-step with content/flags.CELESTIAL_NAVIGATION_FLAG (content owns the named constant —
 * the moonStrata/hollowCore idiom). Set on the learning call so the "learned" state is pure-engine
 * and testable; the engine writes the literal here rather than importing a content value (ADR §3).
 */
const CELESTIAL_NAVIGATION_FLAG = 'celestialNavigationLearned'

export function lighthouseCourse(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[LIGHTHOUSE_COURSE_KEY] ?? 0))
}

export function lighthousePlot(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[LIGHTHOUSE_PLOT_KEY] ?? 0))
}

/** Whether celestial navigation has been learned (the cyclops's lesson done) — reads the flag. */
export function navigationLearned(state: GameState): boolean {
  return state.flags[CELESTIAL_NAVIGATION_FLAG] === true
}

/** The course currently being plotted (an ordered run of star ids), or null when all are done. */
export function currentCourse(
  state: GameState,
  courses: readonly (readonly string[])[],
): readonly string[] | null {
  return courses[lighthouseCourse(state)] ?? null
}

/** The next star the course expects (the one your pick should match now), or null if learned/done. */
export function expectedStar(state: GameState, courses: readonly (readonly string[])[]): string | null {
  if (navigationLearned(state)) return null
  const course = currentCourse(state, courses)
  return course?.[lighthousePlot(state)] ?? null
}

export interface PlotResult {
  readonly ok: boolean
  readonly state: GameState
  /** Was the picked star the course's expected next. */
  readonly correct: boolean
  /** True on the pick that completed the current course (the cyclops swings to a new set). */
  readonly courseComplete: boolean
  /** True on the pick that completed the final course (navigation learned). */
  readonly learned: boolean
}

/**
 * Plot one star into the current course. A correct pick advances the plot; completing the course's
 * full run steps to the next course (or, on the final course, learns navigation and sets the flag).
 * A wrong pick loses the course — the current run restarts (plot back to 0). No-op (SAME reference,
 * ok:false) once navigation is already learned.
 */
export function plotStar(
  state: GameState,
  starId: string,
  courses: readonly (readonly string[])[],
): PlotResult {
  if (navigationLearned(state)) {
    return { ok: false, state, correct: false, courseComplete: false, learned: false }
  }

  const course = currentCourse(state, courses)
  if (!course) {
    return { ok: false, state, correct: false, courseComplete: false, learned: false }
  }

  if (starId !== course[lighthousePlot(state)]) {
    // The beam wanders off — restart this course's run (setNumber no-ops if already 0).
    const reset = setNumber(state, LIGHTHOUSE_PLOT_KEY, 0)
    return { ok: true, state: reset, correct: false, courseComplete: false, learned: false }
  }

  const plotted = lighthousePlot(state) + 1
  if (plotted < course.length) {
    // Mid-course: just advance the plot.
    return { ok: true, state: setNumber(state, LIGHTHOUSE_PLOT_KEY, plotted), correct: true, courseComplete: false, learned: false }
  }

  // Course complete — reset the plot and step to the next course.
  const nextCourse = lighthouseCourse(state) + 1
  const advanced = setNumber(setNumber(state, LIGHTHOUSE_COURSE_KEY, nextCourse), LIGHTHOUSE_PLOT_KEY, 0)
  if (nextCourse < courses.length) {
    return { ok: true, state: advanced, correct: true, courseComplete: true, learned: false }
  }

  // The final course closed — navigation is learned.
  const learned: GameState = { ...advanced, flags: { ...advanced.flags, [CELESTIAL_NAVIGATION_FLAG]: true } }
  return { ok: true, state: learned, correct: true, courseComplete: true, learned: true }
}

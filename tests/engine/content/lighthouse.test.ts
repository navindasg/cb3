import { createDefaultSave } from '@/engine/state/defaultSave'
import {
  plotStar,
  lighthouseCourse,
  lighthousePlot,
  navigationLearned,
  currentCourse,
  expectedStar,
} from '@/engine/content/lighthouse'
import {
  NAV_COURSES,
  STAR_FIELD,
  LIGHTHOUSE_COURSE_KEY,
  LIGHTHOUSE_PLOT_KEY,
} from '@/content/moon/lighthouse'
import { CELESTIAL_NAVIGATION_FLAG } from '@/content/flags'
import type { GameState } from '@/engine/types/GameState'

const withLighthouse = (over: Record<string, number> = {}): GameState => ({
  ...createDefaultSave(),
  numbers: { ...over },
})

/** A star id NOT next in the given course (any wrong pick). */
const wrongStar = (expected: string): string => {
  const other = STAR_FIELD.find((s) => s.id !== expected)
  return other!.id
}

/** Plot the current course exactly right; returns the final result + state. */
const plotCourse = (start: GameState) => {
  let s = start
  const course = currentCourse(s, NAV_COURSES)!
  let last
  for (const starId of course) {
    last = plotStar(s, starId, NAV_COURSES)
    s = last.state
  }
  return last!
}

describe('the lunar lighthouse — plot-a-course', () => {
  it('starts on the first course with nothing plotted', () => {
    const s = withLighthouse()
    expect(lighthouseCourse(s)).toBe(0)
    expect(lighthousePlot(s)).toBe(0)
    expect(currentCourse(s, NAV_COURSES)).toEqual(NAV_COURSES[0])
    expect(expectedStar(s, NAV_COURSES)).toBe(NAV_COURSES[0]![0])
    expect(navigationLearned(s)).toBe(false)
  })

  it('a correct pick advances the plot without completing the course', () => {
    const before = withLighthouse()
    const result = plotStar(before, NAV_COURSES[0]![0]!, NAV_COURSES)
    expect(result.ok).toBe(true)
    expect(result.correct).toBe(true)
    expect(result.courseComplete).toBe(false)
    expect(result.learned).toBe(false)
    expect(lighthousePlot(result.state)).toBe(1)
    expect(expectedStar(result.state, NAV_COURSES)).toBe(NAV_COURSES[0]![1])
  })

  it('a wrong pick loses the course — the run restarts (plot back to 0)', () => {
    const stepped = plotStar(withLighthouse(), NAV_COURSES[0]![0]!, NAV_COURSES).state
    expect(lighthousePlot(stepped)).toBe(1)
    const lost = plotStar(stepped, wrongStar(NAV_COURSES[0]![1]!), NAV_COURSES)
    expect(lost.ok).toBe(true)
    expect(lost.correct).toBe(false)
    expect(lighthousePlot(lost.state)).toBe(0)
    expect(lighthouseCourse(lost.state)).toBe(0) // the course itself is not lost
  })

  it('completing a course steps to the next one', () => {
    const result = plotCourse(withLighthouse())
    expect(result.correct).toBe(true)
    expect(result.courseComplete).toBe(true)
    expect(result.learned).toBe(false)
    expect(lighthouseCourse(result.state)).toBe(1)
    expect(lighthousePlot(result.state)).toBe(0)
    expect(currentCourse(result.state, NAV_COURSES)).toEqual(NAV_COURSES[1])
  })

  it('plotting every course learns navigation and sets the flag', () => {
    let s = withLighthouse()
    let last
    for (let c = 0; c < NAV_COURSES.length; c++) {
      last = plotCourse(s)
      s = last.state
    }
    expect(last!.learned).toBe(true)
    expect(lighthouseCourse(s)).toBe(NAV_COURSES.length)
    expect(navigationLearned(s)).toBe(true)
    expect(s.flags[CELESTIAL_NAVIGATION_FLAG]).toBe(true)
  })

  it('once learned, further picks are a no-op (same reference)', () => {
    const learnedState: GameState = {
      ...withLighthouse(),
      flags: { [CELESTIAL_NAVIGATION_FLAG]: true },
    }
    const result = plotStar(learnedState, NAV_COURSES[0]![0]!, NAV_COURSES)
    expect(result.ok).toBe(false)
    expect(result.learned).toBe(false)
    expect(result.state).toBe(learnedState)
    expect(expectedStar(learnedState, NAV_COURSES)).toBeNull()
  })

  it('is a no-op past the last course when somehow not yet flagged (defensive guard)', () => {
    const past = withLighthouse({ [LIGHTHOUSE_COURSE_KEY]: NAV_COURSES.length })
    expect(currentCourse(past, NAV_COURSES)).toBeNull()
    const result = plotStar(past, NAV_COURSES[0]![0]!, NAV_COURSES)
    expect(result.ok).toBe(false)
    expect(result.state).toBe(past)
  })

  it('does not mutate the input state', () => {
    const before = withLighthouse({ [LIGHTHOUSE_COURSE_KEY]: 0, [LIGHTHOUSE_PLOT_KEY]: 0 })
    plotStar(before, NAV_COURSES[0]![0]!, NAV_COURSES)
    plotStar(before, wrongStar(NAV_COURSES[0]![0]!), NAV_COURSES)
    expect(lighthousePlot(before)).toBe(0)
    expect(lighthouseCourse(before)).toBe(0)
  })

  it('every course is drawn from the star field (the buttons can plot it)', () => {
    const fieldIds = new Set(STAR_FIELD.map((s) => s.id))
    for (const course of NAV_COURSES) {
      for (const id of course) expect(fieldIds.has(id)).toBe(true)
    }
  })
})

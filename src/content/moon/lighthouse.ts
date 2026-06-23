// The lunar lighthouse (Quest/landmark, DESIGN §167/§171 — Act 1) — kept by a cyclops who teaches
// celestial navigation, the prerequisite for the Act-2 candied galleon. Pure data the engine
// (engine/content/lighthouse) reads. You learn by plotting courses: the cyclops names an ordered
// run of stars and you pick them in order from the field (decoys included). Plot every course and
// navigation is learned. Deterministic by design — save-safe across reload and testable.

/** numbers-namespace keys for the lighthouse's plotting progress. */
export const LIGHTHOUSE_COURSE_KEY = 'lighthouseCourse' // courses plotted clean (0..NAV_COURSES.length)
export const LIGHTHOUSE_PLOT_KEY = 'lighthousePlot' // stars of the current course plotted so far

/** A star in the cyclops's field — an id the courses reference + a pure-ASCII display name. */
export interface NavStar {
  readonly id: string
  readonly name: string
}

/** The star field the beam sweeps; the buttons you choose from (course stars + decoys). */
export const STAR_FIELD: readonly NavStar[] = [
  { id: 'lantern', name: 'the Lantern' },
  { id: 'spoon', name: 'the Spoon' },
  { id: 'anchor', name: 'the Anchor' },
  { id: 'wreck', name: 'the Wreck' },
  { id: 'kettle', name: 'the Kettle' },
  { id: 'hook', name: 'the Hook' },
]

/**
 * The courses the cyclops has you plot, each longer than the last — plot them all and you have
 * learned to read the sky (sets the celestial-navigation flag, the galleon prereq). Each is an
 * ordered list of STAR_FIELD ids. Lengths 2,3,4 — a capstone teaching, not a grind. §22-open tuning.
 */
export const NAV_COURSES: readonly (readonly string[])[] = [
  ['lantern', 'anchor'],
  ['wreck', 'lantern', 'hook'],
  ['anchor', 'kettle', 'spoon', 'wreck'],
]

// The first voyage — plotting the candied galleon's course out to the rock candy reef (Act 2,
// DESIGN §178). You learned to read the sky at the lunar lighthouse; now you USE it, plotting the
// leg markers in order with the brass sextant. Pure data the engine (engine/content/reefVoyage)
// reads. Mirrors the lighthouse's plot-a-course shape, but these are sailing WAYPOINTS (bearings),
// not the cyclops's constellations — applying the skill, not relearning it. Deterministic by design,
// so the crossing is save-safe across reload and behaviorally testable.

/** numbers-namespace keys for the voyage's plotting progress. */
export const REEF_LEG_KEY = 'reefVoyageLeg' // legs plotted clean (0..VOYAGE_LEGS.length)
export const REEF_WAYPOINT_KEY = 'reefVoyageWaypoint' // waypoints of the current leg plotted so far

/** A waypoint on the crossing — an id the legs reference + a pure-ASCII display name. */
export interface Waypoint {
  readonly id: string
  readonly name: string
}

/** The bearings you choose from when plotting (leg waypoints + decoys), read off the sextant. */
export const WAYPOINTS: readonly Waypoint[] = [
  { id: 'moonShadow', name: "the moon's shadow" },
  { id: 'driftLine', name: 'the drift line' },
  { id: 'gullet', name: 'the gullet' },
  { id: 'paleStar', name: 'the pale star' },
  { id: 'reefEdge', name: 'the reef-edge' },
]

/**
 * The legs you plot to reach the reef, each longer than the last. A SHORT crossing (lengths 2,3) —
 * the lighthouse was the lesson, this is the application, not a grind. Each is an ordered list of
 * WAYPOINTS ids. §22-open tuning.
 */
export const VOYAGE_LEGS: readonly (readonly string[])[] = [
  ['moonShadow', 'driftLine'],
  ['paleStar', 'gullet', 'reefEdge'],
]

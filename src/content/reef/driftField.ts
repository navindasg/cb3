// The rock candy reef's drift field (Act 2 — zero-G drift combat, DESIGN §125/§178). Pure config the
// drift sim (engine/content/driftReef) reads. The gumball cannon is BOTH weapon AND engine: each shot
// flies out and breaks an asteroid, and recoils you the opposite way (Newton's third law as a resource
// decision). Asteroids split large -> medium -> small -> gone, each break freeing rock candy. Ammo =
// gumballs, crafted cheaply from candies; out of gumballs while adrift strands you (respawn at the
// ship). v1 has no collision damage (asteroids are targets, not threats — HP/anti-gravity-cola weird-
// ness, the squirrel, and reef escalation are Act-2 follow-ons). All tuning here is a §22-open knob.
//
// Positions/velocities are plain {x,y} data (NOT engine Vec2 — content imports no engine runtime
// values, ADR §3); the sim lifts them into Vec2.

/** A plain 2D coordinate / velocity — the sim converts these to engine Vec2. */
export interface Coord {
  readonly x: number
  readonly y: number
}

/** numbers-namespace key for the player's gumball ammo (crafted from candies). */
export const GUMBALLS_KEY = 'gumballs'

/** Crafting one batch of gumballs: spend candies, get this many. Cheap, so you can never hard-strand. */
export const GUMBALL_CRAFT_CANDY_COST = 100
export const GUMBALL_CRAFT_BATCH = 12

/** The arena (cells). The pod and asteroids WRAP at the edges — classic Asteroids, in ASCII. */
export const ARENA_W = 28
export const ARENA_H = 16

/** Where the pod starts / respawns after a strand — the ship's berth at the field's centre. */
export const PLAYER_START: Coord = { x: 14, y: 8 }

/** Velocity (cells/s) the recoil of one shot imparts, opposite the fire direction. */
export const RECOIL = 5
/** The pod's drift speed is clamped here so recoil builds momentum without running away. */
export const MAX_PLAYER_SPEED = 7

/** Each shot advances the field this many integration steps of DRIFT_DT (the inertial drift after a
 * shot). DELIBERATE MODEL CHOICE: drift is DISCRETE-IMPULSE, not a real-time arcade loop — one shot is
 * one resource decision (ammo + momentum), then a fixed burst of coast. This trades continuous
 * twitch-steering for determinism (pure, unit-testable, no rAF flake) while keeping §125's "Newton's
 * third law as a resource decision" feel, which is what that mechanic is actually about. */
export const DRIFT_BURST_STEPS = 8
export const DRIFT_DT = 0.1

/** Hitscan: a shot hits the nearest asteroid whose centre lies within this perpendicular corridor of
 * the fire ray (plus the asteroid's own radius), out to HIT_RANGE cells ahead. A miss still costs a
 * gumball and still recoils you — firing into empty dark is a real waste. */
export const CORRIDOR_HALF = 1.6
export const HIT_RANGE = 32

/** Perpendicular speed (cells/s) the two split children fly apart with, off the impact line. */
export const SPLIT_SPREAD = 2.2

/** An asteroid size tier — its glyph, collision radius, and the rock candy a break frees. */
export interface AsteroidSize {
  readonly radius: number
  readonly yield: number
  readonly glyph: string
}

/** Sizes indexed by tier: 0 = small (gone when broken), 1 = medium, 2 = large. Pure-ASCII glyphs. */
export const ASTEROID_SIZES: readonly AsteroidSize[] = [
  { radius: 1.0, yield: 6, glyph: '.' },
  { radius: 1.6, yield: 8, glyph: 'o' },
  { radius: 2.4, yield: 10, glyph: 'O' },
]

/** A starting asteroid: where it sits, how it drifts, and its size tier. */
export interface AsteroidSeed {
  readonly pos: Coord
  readonly vel: Coord
  readonly size: number
}

/** The field at the start of the run — three large asteroids drifting slowly (clearing one fully:
 * 10 + 2*8 + 4*6 = 50 rock candy; the whole field ~150, a generous far source). */
export const DRIFT_SEEDS: readonly AsteroidSeed[] = [
  { pos: { x: 6, y: 4 }, vel: { x: 1.1, y: 0.6 }, size: 2 },
  { pos: { x: 22, y: 5 }, vel: { x: -0.9, y: 0.8 }, size: 2 },
  { pos: { x: 13, y: 13 }, vel: { x: 0.7, y: -1.0 }, size: 2 },
]

/** A fire direction — a pure-ASCII label + the unit vector it fires along (recoil is the opposite). */
export interface FireDir {
  readonly id: string
  readonly label: string
  readonly vec: Coord
}

const D = 1 / Math.SQRT2 // diagonal unit component

/** The eight compass directions you can fire. */
export const FIRE_DIRS: readonly FireDir[] = [
  { id: 'n', label: 'fire up', vec: { x: 0, y: -1 } },
  { id: 'ne', label: 'fire up-right', vec: { x: D, y: -D } },
  { id: 'e', label: 'fire right', vec: { x: 1, y: 0 } },
  { id: 'se', label: 'fire down-right', vec: { x: D, y: D } },
  { id: 's', label: 'fire down', vec: { x: 0, y: 1 } },
  { id: 'sw', label: 'fire down-left', vec: { x: -D, y: D } },
  { id: 'w', label: 'fire left', vec: { x: -1, y: 0 } },
  { id: 'nw', label: 'fire up-left', vec: { x: -D, y: -D } },
]

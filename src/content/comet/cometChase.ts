// The comet (Act 2 — "the comet passes", DESIGN §175/§180). Pure config the comet sim
// (engine/content/cometChase) reads. A new interaction: the LEAD-THE-TARGET harpoon. The comet streaks
// across the dark at a constant velocity from a fixed launch point (the galleon's berth); each shot you
// nudge an aim angle and loose a harpoon. Crucially the harpoon and the comet BOTH advance during the
// harpoon's flight, so you must aim where the comet WILL be, not where it is — projectile lead, the
// thing this mechanic is actually about. It is a discrete, synchronous, deterministic resolution per
// shot (no rAF), the same model choice as the reef drift sim, but a distinct feel: a stationary
// ballistic launcher rather than recoil hitscan.
//
// Positions/velocities are plain {x,y} data (NOT engine Vec2 — content imports no engine runtime
// values, ADR §3); the sim lifts them into Vec2.

/** A plain 2D coordinate / velocity — the sim converts these to engine Vec2. */
export interface Coord {
  readonly x: number
  readonly y: number
}

/** The arena (cells), drawn as an ASCII grid. The comet crosses it; nothing wraps (unlike the reef). */
export const ARENA_W = 40
export const ARENA_H = 16

/** The galleon's harpoon battery — fixed at the lower-left, firing up and across the comet's path. */
export const LAUNCH: Coord = { x: 3, y: 14 }

/** Where the comet enters (upper-right) and the constant velocity it crosses with (cells/s), heading
 * down and to the left. It exits when it leaves the arena bounds — that closes the window. */
export const COMET_START: Coord = { x: 37, y: 2 }
export const COMET_VEL: Coord = { x: -3.2, y: 1.1 }

/** The harpoon's flight speed (cells/s) — faster than the comet so a well-led shot can catch it. */
export const HARPOON_SPEED = 14

/** A catch lands when the harpoon passes within this many cells of the comet's centre during flight. */
export const CATCH_RADIUS = 1.8

/** Flight integration: each loosed harpoon is stepped forward this many times at DT, or until it leaves
 * the arena. The comet advances alongside it (that is the lead). DELIBERATE MODEL CHOICE: one shot is
 * one synchronous resolution — pure, unit-testable, no rAF flake — mirroring the reef drift sim. */
export const FLIGHT_DT = 0.04
export const MAX_FLIGHT_STEPS = 80

/** Aim is an angle in radians, measured from +x (east), negative = upward. The player nudges it within
 * [AIM_MIN, AIM_MAX] by AIM_STEP per press; the lead solution for the seed comet sits inside this arc. */
export const AIM_MIN = -1.45 // ~ -83 deg (steeply up)
export const AIM_MAX = -0.05 // ~  -3 deg (nearly flat)
export const AIM_STEP = 0.05
/** The aim the battery starts trained at (roughly toward the comet's entry point). */
export const AIM_START = -0.55

/** Harpoons available per pass. Generous enough to find the lead by eye; the window (the comet exiting,
 * and the once-per-pass cooldown) is the real limit, not ammo. §22-open tuning. */
export const HARPOONS_PER_PASS = 6

/** numbers-namespace key: the comet pass index already harvested (farm rate-limit — one catch per pass).
 * A pass is COMET_PERIOD_MS of accumulated GAME time (never the wall clock — offline-catchup safe). */
export const COMET_LAST_PASS_KEY = 'cometLastPass'

/** The comet returns on this period (accumulated game-time ms). A catch is gated to one per period; an
 * already-harvested pass shows the comet guttering until the next one. ~90s — anticipation, not a wall.
 * DEFERRED (DESIGN §180): the scripted FIRST arrival (~5 min after buying the telescope, to guarantee the
 * player witnesses the mechanic) is not wired yet — entry is currently gated on `reefReached`, and every
 * pass thereafter is a plain time-window. The scripted-first-pass hook lands with the Act-2 telescope. */
export const COMET_PERIOD_MS = 90_000

/** Pop rocks a catch frees: a base haul, plus a one-time bonus the FIRST time you ride one down. */
export const POP_ROCKS_PER_CATCH = 40
export const POP_ROCKS_FIRST_CATCH_BONUS = 60

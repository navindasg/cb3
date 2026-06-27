import { Vec2 } from '@/engine/quest/Vec2'
import type { GameState } from '@/engine/types/GameState'
import { canAfford, spendResource } from '@/engine/types/Resource'
import type { Coord } from '@/content/comet/cometChase'
import {
  LAUNCH,
  COMET_START,
  COMET_VEL,
  HARPOON_SPEED,
  CATCH_RADIUS,
  FLIGHT_DT,
  MAX_FLIGHT_STEPS,
  ARENA_W,
  ARENA_H,
  AIM_MIN,
  AIM_MAX,
  AIM_STEP,
  AIM_START,
  HARPOONS_PER_PASS,
  COMET_LAST_PASS_KEY,
  COMET_PERIOD_MS,
  RIDE_STARDUST_COST,
} from '@/content/comet/cometChase'

// The comet's lead-the-target harpoon sim (Act 2 — "the comet passes", DESIGN §175/§180). A pure,
// immutable, TRANSIENT 2D simulation — like the reef drift sim it never touches GameState; a chase that
// is abandoned is forfeit, and only the harvested pop rocks + the once-per-pass marker are persisted
// (owned by the screen). The comet crosses at a constant velocity; each loosed harpoon flies from the
// fixed battery and the comet KEEPS MOVING during its flight, so a catch demands leading the target.
// Resolution is synchronous per shot (no rAF) — deterministic and unit-testable. Reuses engine Vec2;
// reads content/comet/cometChase as config data.

const v = (c: Coord): Vec2 => new Vec2(c.x, c.y)

/** Dot product (Vec2 carries no dot/normalize — kept local to the sim). */
const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y

/** Whether a point lies inside the arena bounds (the comet/harpoon do NOT wrap — leaving ends things). */
function inArena(p: Vec2): boolean {
  return p.x >= 0 && p.x <= ARENA_W && p.y >= 0 && p.y <= ARENA_H
}

export interface ChaseState {
  /** The comet's live position (advances during every harpoon flight — the lead). */
  readonly comet: Vec2
  /** The battery's current aim, radians from +x (negative = upward). */
  readonly aimRad: number
  readonly harpoonsLeft: number
  /** Latched once a harpoon lands within CATCH_RADIUS of the comet mid-flight. */
  readonly caught: boolean
}

/** A fresh chase: the comet at its entry point, the battery trained at its start aim, ammo full. */
export function createChase(): ChaseState {
  return { comet: v(COMET_START), aimRad: AIM_START, harpoonsLeft: HARPOONS_PER_PASS, caught: false }
}

/** Clamp an aim angle into the battery's arc. */
const clampAim = (rad: number): number => Math.min(AIM_MAX, Math.max(AIM_MIN, rad))

/** Nudge the aim by `deltaRad` (the screen's "aim higher/lower"), clamped to the arc. Pure; a no-op at
 * an arc limit returns the SAME reference. */
export function aimBy(state: ChaseState, deltaRad: number): ChaseState {
  const aimRad = clampAim(state.aimRad + deltaRad)
  return aimRad === state.aimRad ? state : { ...state, aimRad }
}

/** Whether the comet has crossed out of the arena (the window has closed). */
export function cometExited(state: ChaseState): boolean {
  return !inArena(state.comet)
}

/** The chase ends on a catch, when the comet has left the arena, or when the harpoons run out. */
export function chaseOver(state: ChaseState): boolean {
  return state.caught || cometExited(state) || state.harpoonsLeft <= 0
}

export interface LooseResult {
  readonly state: ChaseState
  /** Whether this harpoon caught the comet. */
  readonly caught: boolean
}

/**
 * Loose one harpoon along the current aim. The harpoon and the comet are stepped forward together (the
 * comet keeps drifting — that is the lead); a catch lands if they pass within CATCH_RADIUS at any step.
 * The flight ends on a catch, when the harpoon leaves the arena, or after MAX_FLIGHT_STEPS. The comet
 * rests wherever it drifted to, and a harpoon is spent. Pure; a no-op (SAME reference) once the chase
 * is over or out of ammo.
 */
export function looseHarpoon(state: ChaseState): LooseResult {
  if (chaseOver(state)) return { state, caught: false }

  const dir = new Vec2(Math.cos(state.aimRad), Math.sin(state.aimRad))
  const harpoonVel = dir.scale(HARPOON_SPEED)
  const cometVel = v(COMET_VEL)

  let harpoon = v(LAUNCH)
  let comet = state.comet
  let caught = false
  for (let step = 0; step < MAX_FLIGHT_STEPS; step++) {
    harpoon = harpoon.add(harpoonVel.scale(FLIGHT_DT))
    comet = comet.add(cometVel.scale(FLIGHT_DT))
    if (harpoon.sub(comet).length() <= CATCH_RADIUS) {
      caught = true
      break
    }
    if (!inArena(harpoon)) break
  }

  return {
    state: { comet, aimRad: state.aimRad, harpoonsLeft: state.harpoonsLeft - 1, caught },
    caught,
  }
}

/**
 * Where the harpoon should be aimed to lead the comet — the projectile-intercept point. Solve
 * |R + Vc·t| = s·t for the smallest positive flight time t, then return where the comet will be at t.
 * The config guarantees the harpoon outpaces the comet (HARPOON_SPEED > |COMET_VEL|), so `a` is strictly
 * negative and a single positive intercept time always exists; should a future mistuning break that
 * invariant the solver falls back to the comet's current position. Drives the on-screen ghost marker.
 */
export function interceptPoint(state: ChaseState): Coord {
  const cometVel = v(COMET_VEL)
  const rel = state.comet.sub(v(LAUNCH))
  const s = HARPOON_SPEED

  const a = dot(cometVel, cometVel) - s * s // < 0 while the harpoon outpaces the comet
  const b = 2 * dot(rel, cometVel)
  const c = dot(rel, rel)
  const disc = b * b - 4 * a * c

  // Lead point if a positive intercept time exists; otherwise aim directly at the comet now.
  let aimPoint = state.comet
  if (disc >= 0) {
    const sq = Math.sqrt(disc)
    const roots = [(-b + sq) / (2 * a), (-b - sq) / (2 * a)].filter((r) => r > 1e-9)
    if (roots.length > 0) aimPoint = state.comet.add(cometVel.scale(Math.min(...roots)))
  }
  return { x: aimPoint.x, y: aimPoint.y }
}

/** The exact aim (radians) that would lead the comet — atan2 of the intercept point off the battery.
 * The player aims by eye; this drives the deterministic tests and the advice hint. */
export function interceptAimRad(state: ChaseState): number {
  const p = interceptPoint(state)
  return Math.atan2(p.y - LAUNCH.y, p.x - LAUNCH.x)
}

export type AimAdvice = 'fire' | 'higher' | 'lower'

/** The battery's lead advice: 'fire' when the current aim is within one nudge of the intercept lead,
 * else which way to swing it (negative aim = upward, so a lead below the current aim reads 'higher').
 * The reef's bestFireDir analogue — the bucketing decision lives in the engine, not the screen. */
export function aimAdvice(state: ChaseState): AimAdvice {
  const diff = interceptAimRad(state) - state.aimRad
  return Math.abs(diff) <= AIM_STEP ? 'fire' : diff < 0 ? 'higher' : 'lower'
}

// --- the once-per-pass cooldown (the soft-timer faucet rate-limit) ------------------------------------

/** The current comet pass index — floor(accumulated GAME time / period). Driven by accumulatedGameTimeMs
 * (never the wall clock), so it is offline-catchup safe and deterministic. */
export function currentPass(state: GameState): number {
  return Math.floor(Math.max(0, state.accumulatedGameTimeMs) / COMET_PERIOD_MS)
}

/** The pass index already harvested (defaults to a sentinel below any real pass, so the first visit can
 * always catch). */
function harvestedPass(state: GameState): number {
  return state.numbers[COMET_LAST_PASS_KEY] ?? -1
}

/** Whether the comet can be caught right now: a fresh pass that has not yet been harvested. The harvest
 * rate is thus gated to one catch per period — the soft-timer faucet — with no farm-by-re-entry. */
export function cometCatchable(state: GameState): boolean {
  return currentPass(state) !== harvestedPass(state)
}

/** Milliseconds of game time until the next (unharvested) pass begins — for the cooldown readout. 0 when
 * the comet is already catchable. */
export function msUntilNextPass(state: GameState): number {
  if (cometCatchable(state)) return 0
  const elapsedInPass = Math.max(0, state.accumulatedGameTimeMs) % COMET_PERIOD_MS
  return COMET_PERIOD_MS - elapsedInPass
}

// --- riding the comet: the §175 fast-travel between strata, fuelled by stardust -----------------------

/** Whether you can afford a ride right now (a ride burns RIDE_STARDUST_COST stardust). The screen also
 * gates the option on having ever caught the comet — that flag is the screen's to own (the comet sim never
 * persists), so this helper stays a pure affordability check. */
export function canRide(state: GameState): boolean {
  return canAfford(state.stardust, RIDE_STARDUST_COST)
}

export interface RideResult {
  readonly ok: boolean
  /** The state after the ride's fare (a new object on success, the SAME reference otherwise). */
  readonly state: GameState
  readonly reason?: 'unaffordable'
}

/** Pay a ride's fare: burn RIDE_STARDUST_COST stardust. Pure — returns a new state on success, the SAME
 * reference (no overdraft) when there is not enough stardust. The destination itself is the screen's to
 * navigate to; this only spends the fuel. */
export function rideComet(state: GameState): RideResult {
  const spent = spendResource(state.stardust, RIDE_STARDUST_COST)
  if (!spent) return { ok: false, state, reason: 'unaffordable' }
  return { ok: true, state: { ...state, stardust: spent } }
}

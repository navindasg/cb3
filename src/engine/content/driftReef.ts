import { Vec2 } from '@/engine/quest/Vec2'
import type { Coord, AsteroidSeed, FireDir } from '@/content/reef/driftField'
import {
  ARENA_W,
  ARENA_H,
  PLAYER_START,
  RECOIL,
  MAX_PLAYER_SPEED,
  CORRIDOR_HALF,
  HIT_RANGE,
  SPLIT_SPREAD,
  ASTEROID_SIZES,
} from '@/content/reef/driftField'

// The rock candy reef's zero-G drift sim (Act 2 — DESIGN §125/§178). A pure, immutable, TRANSIENT 2D
// simulation (it never touches GameState — like the quest combat scenes, a drift run does not survive
// a reload; ammo, rock candy, and the cleared flag are the only persisted parts, owned by the screen).
// The gumball cannon is weapon AND engine: fireDrift breaks the nearest asteroid in the aimed corridor
// AND recoils the pod the opposite way; driftStep integrates the inertial drift (everything wraps).
// Reuses engine Vec2; reads content/reef/driftField as config data.

export interface DriftAsteroid {
  readonly id: number
  readonly pos: Vec2
  readonly vel: Vec2
  readonly size: number // tier index into ASTEROID_SIZES (0 small .. 2 large)
}

export interface DriftState {
  readonly player: { readonly pos: Vec2; readonly vel: Vec2 }
  readonly asteroids: readonly DriftAsteroid[]
  /** Monotonic id source for split children — keeps the sim deterministic (no Math.random). */
  readonly nextId: number
}

const v = (c: Coord): Vec2 => new Vec2(c.x, c.y)

/** Wrap a position into the toroidal arena [0,W) x [0,H). */
function wrap(p: Vec2): Vec2 {
  const x = ((p.x % ARENA_W) + ARENA_W) % ARENA_W
  const y = ((p.y % ARENA_H) + ARENA_H) % ARENA_H
  return new Vec2(x, y)
}

/** Clamp a velocity to the pod's top drift speed (recoil builds momentum but never runs away). */
function clampSpeed(vel: Vec2): Vec2 {
  const sp = vel.length()
  return sp > MAX_PLAYER_SPEED ? vel.scale(MAX_PLAYER_SPEED / sp) : vel
}

/** A fresh drift run: the pod at its berth, the seeded asteroids lifted into Vec2. */
export function createDrift(seeds: readonly AsteroidSeed[]): DriftState {
  const asteroids = seeds.map((s, i) => ({ id: i, pos: v(s.pos), vel: v(s.vel), size: s.size }))
  return { player: { pos: v(PLAYER_START), vel: Vec2.ZERO }, asteroids, nextId: seeds.length }
}

/** Whether the whole field has been broken (every asteroid gone). */
export function driftCleared(state: DriftState): boolean {
  return state.asteroids.length === 0
}

/** The asteroid the given fire direction would hit: nearest along the ray, within the corridor +
 * the asteroid's radius, out to HIT_RANGE ahead. null if the shot would miss. (Shots do not wrap;
 * only drift does.) */
function targetFor(state: DriftState, dir: Coord): DriftAsteroid | null {
  const d = v(dir)
  let best: DriftAsteroid | null = null
  let bestAlong = Infinity
  for (const a of state.asteroids) {
    const rel = a.pos.sub(state.player.pos)
    const along = rel.x * d.x + rel.y * d.y
    if (along <= 0 || along > HIT_RANGE) continue
    const perp = rel.sub(d.scale(along)).length()
    if (perp > CORRIDOR_HALF + ASTEROID_SIZES[a.size]!.radius) continue
    if (along < bestAlong) {
      bestAlong = along
      best = a
    }
  }
  return best
}

export interface FireResult {
  readonly state: DriftState
  /** Rock candy freed this shot (0 on a miss). */
  readonly gained: number
  /** Whether the shot broke an asteroid. */
  readonly hit: boolean
}

/**
 * Fire the gumball cannon along `dir`. Recoils the pod by RECOIL the opposite way (always — a miss
 * still shoves you). If an asteroid sits in the aimed corridor, the nearest one breaks: a large/medium
 * splits into two children of the next size down (flung apart perpendicular to the shot), a small is
 * destroyed, and its tier's rock candy is freed. Pure; returns a new state.
 */
export function fireDrift(state: DriftState, dir: Coord): FireResult {
  const d = v(dir)
  const recoiled = clampSpeed(state.player.vel.add(d.scale(-RECOIL)))
  const player = { pos: state.player.pos, vel: recoiled }

  const target = targetFor(state, dir)
  if (!target) return { state: { ...state, player }, gained: 0, hit: false }

  const rest = state.asteroids.filter((a) => a.id !== target.id)
  let nextId = state.nextId
  const children: DriftAsteroid[] = []
  if (target.size > 0) {
    const perp = new Vec2(-d.y, d.x) // unit perpendicular to the shot (d is a unit vector)
    const childVelA = target.vel.add(perp.scale(SPLIT_SPREAD))
    const childVelB = target.vel.add(perp.scale(-SPLIT_SPREAD))
    children.push(
      { id: nextId, pos: wrap(target.pos.add(perp.scale(0.5))), vel: childVelA, size: target.size - 1 },
      { id: nextId + 1, pos: wrap(target.pos.add(perp.scale(-0.5))), vel: childVelB, size: target.size - 1 },
    )
    nextId += 2
  }

  return {
    state: { player, asteroids: [...rest, ...children], nextId },
    gained: ASTEROID_SIZES[target.size]!.yield,
    hit: true,
  }
}

/** Advance the inertial drift one step: the pod and every asteroid coast at their velocity and wrap
 * at the arena edges (zero-G — velocities are unchanged). Pure; returns a new state. */
export function driftStep(state: DriftState, dtSec: number): DriftState {
  const player = { pos: wrap(state.player.pos.add(state.player.vel.scale(dtSec))), vel: state.player.vel }
  const asteroids = state.asteroids.map((a) => ({ ...a, pos: wrap(a.pos.add(a.vel.scale(dtSec))) }))
  return { player, asteroids, nextId: state.nextId }
}

/** Reset the pod to its berth, drift stilled — after a strand (out of gumballs). Asteroids unchanged. */
export function respawnPlayer(state: DriftState): DriftState {
  return { ...state, player: { pos: v(PLAYER_START), vel: Vec2.ZERO } }
}

/** The fire direction (of the given set) that would land a hit, nearest target first — or null if no
 * direction currently has a target in range. Used to aim the on-screen hint + drive deterministic
 * tests; the player aims by eye. */
export function bestFireDir(state: DriftState, dirs: readonly FireDir[]): FireDir | null {
  let best: FireDir | null = null
  let bestAlong = Infinity
  for (const dir of dirs) {
    const target = targetFor(state, dir.vec)
    if (!target) continue
    const rel = target.pos.sub(state.player.pos)
    const along = rel.x * dir.vec.x + rel.y * dir.vec.y
    if (along < bestAlong) {
      bestAlong = along
      best = dir
    }
  }
  return best
}

import {
  createDrift,
  driftCleared,
  fireDrift,
  driftStep,
  respawnPlayer,
  bestFireDir,
  type DriftState,
} from '@/engine/content/driftReef'
import {
  DRIFT_SEEDS,
  FIRE_DIRS,
  ASTEROID_SIZES,
  ARENA_W,
  ARENA_H,
  RECOIL,
  MAX_PLAYER_SPEED,
  DRIFT_BURST_STEPS,
  DRIFT_DT,
  PLAYER_START,
} from '@/content/reef/driftField'
import { Vec2 } from '@/engine/quest/Vec2'

/** A one-large-asteroid field sitting straight above the pod (an easy, deterministic target). */
const oneLargeAbove = (): DriftState => ({
  player: { pos: new Vec2(14, 8), vel: Vec2.ZERO },
  asteroids: [{ id: 0, pos: new Vec2(14, 3), vel: Vec2.ZERO, size: 2 }],
  nextId: 1,
})

const UP = FIRE_DIRS.find((d) => d.id === 'n')!.vec

describe('the drift sim — firing the gumball cannon', () => {
  it('recoils the pod opposite the fire direction (even on a miss)', () => {
    const empty: DriftState = { player: { pos: new Vec2(14, 8), vel: Vec2.ZERO }, asteroids: [], nextId: 0 }
    const fired = fireDrift(empty, UP) // up = (0,-1); recoil is down (+y)
    expect(fired.hit).toBe(false)
    expect(fired.gained).toBe(0)
    expect(fired.state.player.vel.y).toBeCloseTo(RECOIL)
    expect(fired.state.player.vel.x).toBeCloseTo(0)
  })

  it('clamps the pod drift speed as recoil accumulates', () => {
    let s: DriftState = { player: { pos: new Vec2(14, 8), vel: Vec2.ZERO }, asteroids: [], nextId: 0 }
    for (let i = 0; i < 10; i++) s = fireDrift(s, UP).state // repeated down-recoil
    expect(s.player.vel.length()).toBeLessThanOrEqual(MAX_PLAYER_SPEED + 1e-9)
  })

  it('recoil that cancels to a dead stop yields no NaN (clampSpeed guards the zero vector)', () => {
    const empty: DriftState = { player: { pos: new Vec2(14, 8), vel: Vec2.ZERO }, asteroids: [], nextId: 0 }
    const up = fireDrift(empty, UP).state // recoils down
    const down = fireDrift(up, FIRE_DIRS.find((d) => d.id === 's')!.vec).state // recoils up -> cancels
    expect(Number.isNaN(down.player.vel.x)).toBe(false)
    expect(Number.isNaN(down.player.vel.y)).toBe(false)
    expect(down.player.vel.length()).toBeCloseTo(0)
  })

  it('breaks a large asteroid into two of the next size down, freeing its rock candy', () => {
    const result = fireDrift(oneLargeAbove(), UP)
    expect(result.hit).toBe(true)
    expect(result.gained).toBe(ASTEROID_SIZES[2]!.yield)
    expect(result.state.asteroids).toHaveLength(2)
    expect(result.state.asteroids.every((a) => a.size === 1)).toBe(true)
  })

  it('children fly apart perpendicular to the shot (opposite velocities off the impact line)', () => {
    const [a, b] = fireDrift(oneLargeAbove(), UP).state.asteroids
    // Shot is vertical, so children split along x (perp). Their x-velocities are equal & opposite.
    expect(a!.vel.x).toBeCloseTo(-b!.vel.x)
    expect(Math.sign(a!.vel.x)).not.toBe(Math.sign(b!.vel.x))
  })

  it('destroys a small asteroid outright (no children), freeing its rock candy', () => {
    const small: DriftState = {
      player: { pos: new Vec2(14, 8), vel: Vec2.ZERO },
      asteroids: [{ id: 0, pos: new Vec2(14, 4), vel: Vec2.ZERO, size: 0 }],
      nextId: 1,
    }
    const result = fireDrift(small, UP)
    expect(result.hit).toBe(true)
    expect(result.gained).toBe(ASTEROID_SIZES[0]!.yield)
    expect(result.state.asteroids).toHaveLength(0)
    expect(driftCleared(result.state)).toBe(true)
  })

  it('misses (no break, no candy) when nothing sits in the aimed corridor', () => {
    const result = fireDrift(oneLargeAbove(), FIRE_DIRS.find((d) => d.id === 's')!.vec) // fire down, away
    expect(result.hit).toBe(false)
    expect(result.gained).toBe(0)
    expect(result.state.asteroids).toHaveLength(1)
  })

  it('does not mutate the input state', () => {
    const before = oneLargeAbove()
    fireDrift(before, UP)
    expect(before.asteroids).toHaveLength(1)
    expect(before.player.vel).toBe(Vec2.ZERO)
  })
})

describe('the drift sim — inertial drift + wrap', () => {
  it('coasts the pod at its velocity and wraps at the arena edge', () => {
    const s: DriftState = { player: { pos: new Vec2(ARENA_W - 1, 8), vel: new Vec2(4, 0) }, asteroids: [], nextId: 0 }
    const after = driftStep(s, 0.5) // moves +2 in x, past the right edge -> wraps
    expect(after.player.pos.x).toBeGreaterThanOrEqual(0)
    expect(after.player.pos.x).toBeLessThan(ARENA_W)
    expect(after.player.pos.x).toBeCloseTo(((ARENA_W - 1 + 2) % ARENA_W))
  })

  it('coasts asteroids and wraps them too, leaving velocities unchanged (zero-G)', () => {
    const s: DriftState = {
      player: { pos: new Vec2(14, 8), vel: Vec2.ZERO },
      asteroids: [{ id: 0, pos: new Vec2(0.5, ARENA_H - 0.5), vel: new Vec2(-1, 1), size: 1 }],
      nextId: 1,
    }
    const after = driftStep(s, 1)
    const a = after.asteroids[0]!
    expect(a.pos.x).toBeCloseTo(ARENA_W - 0.5) // 0.5 - 1 wraps to W-0.5
    expect(a.pos.y).toBeCloseTo(0.5) // H-0.5 + 1 wraps to 0.5
    expect(a.vel.equals(new Vec2(-1, 1))).toBe(true)
  })
})

describe('the drift sim — respawn + the real field is clearable', () => {
  it('respawn returns the pod to its berth, drift stilled', () => {
    const s: DriftState = { player: { pos: new Vec2(1, 1), vel: new Vec2(5, -3) }, asteroids: [], nextId: 0 }
    const r = respawnPlayer(s)
    expect(r.player.pos.equals(new Vec2(PLAYER_START.x, PLAYER_START.y))).toBe(true)
    expect(r.player.vel.equals(Vec2.ZERO)).toBe(true)
  })

  it('bestFireDir finds an aiming solution while targets remain, null when cleared', () => {
    expect(bestFireDir(createDrift(DRIFT_SEEDS), FIRE_DIRS)).not.toBeNull()
    const empty: DriftState = { player: { pos: new Vec2(14, 8), vel: Vec2.ZERO }, asteroids: [], nextId: 0 }
    expect(bestFireDir(empty, FIRE_DIRS)).toBeNull()
  })

  it('the seeded field clears within a bounded shot budget using the aim hint', () => {
    let s = createDrift(DRIFT_SEEDS)
    let shots = 0
    const BUDGET = 400 // generous; the field is 3 large -> ~21 breaks, but misses/drift cost shots
    while (!driftCleared(s) && shots < BUDGET) {
      const dir = bestFireDir(s, FIRE_DIRS)
      // If nothing is lined up, fire any direction to drift and re-aim next shot.
      s = fireDrift(s, (dir ?? FIRE_DIRS[0]!).vec).state
      for (let k = 0; k < DRIFT_BURST_STEPS; k++) s = driftStep(s, DRIFT_DT)
      shots++
    }
    expect(driftCleared(s)).toBe(true)
  })
})

import { Vec2 } from '@/engine/quest/Vec2'
import { CollisionBox } from '@/engine/quest/collision'
import { Entity } from '@/engine/quest/Entity'
import { VerticalDriver } from '@/engine/quest/physics/VerticalDriver'
import type { PhysicsBounds } from '@/engine/quest/physics/PhysicsDriver'

const BOUNDS: PhysicsBounds = { groundY: 100 }

function climber(pos: Vec2, velocity = Vec2.ZERO): Entity {
  return new Entity({ id: 'p', team: 'player', pos, velocity, width: 1, height: 2, hp: 5, maxHp: 5 })
}

const noMove = { moveX: 0, moveY: 0, jump: false }

describe('VerticalDriver', () => {
  it('keeps gravity downward (0, +y) and never allows jumping', () => {
    const d = new VerticalDriver({ gravityY: 12 })
    expect(d.gravity.equals(new Vec2(0, 12))).toBe(true)
    expect(d.canJump()).toBe(false)
  })

  it('climbs upward (decreasing screen-y) on positive moveY', () => {
    const d = new VerticalDriver({ climbSpeed: 8 })
    const e = climber(new Vec2(0, 50))
    const climbed = d.applyMovement(e, { moveX: 0, moveY: 1, jump: false }, 100, BOUNDS) // -8 * 0.1
    expect(climbed.pos.y).toBeCloseTo(49.2)
    expect(climbed.pos.y).toBeLessThan(50)
  })

  it('gravity pulls the entity down when not climbing', () => {
    const d = new VerticalDriver({ gravityY: 12 })
    const e = climber(new Vec2(0, 10))
    const grav = d.applyGravity(e, 100, BOUNDS) // +12 * 0.1 = +1.2
    expect(grav.velocity.y).toBeCloseTo(1.2)
    const moved = d.applyMovement(grav, noMove, 100, BOUNDS) // falls 1.2 * 0.1
    expect(moved.pos.y).toBeGreaterThan(10)
  })

  it('rests at the ground floor with normal gravity', () => {
    const d = new VerticalDriver({ gravityY: 12 })
    const onFloor = climber(new Vec2(0, 98)) // bottom = 100 = groundY
    const grav = d.applyGravity(onFloor, 100, BOUNDS)
    expect(grav.velocity.y).toBe(0) // resting, gravity does not accumulate
    const moved = d.applyMovement(onFloor, noMove, 100, BOUNDS)
    expect(moved.pos.y).toBe(98) // clamped to maxY (groundY - height)
  })

  it('gusts shove EVERY entity downward once per period (forceMoveAll(0,+g))', () => {
    const d = new VerticalDriver({ gustPeriodMs: 1000, gustStrength: 3 })
    const a = climber(new Vec2(0, 20))
    const b = climber(new Vec2(5, 30))

    const before = d.gust([a, b], 500) // clock 500 < 1000
    expect(before.fired).toBe(false)
    expect(before.entities).toEqual([a, b]) // same array, untouched

    const after = d.gust([a, b], 600) // clock 1100 >= 1000 -> fire
    expect(after.fired).toBe(true)
    expect(after.entities[0]?.pos.y).toBe(23) // 20 + 3
    expect(after.entities[1]?.pos.y).toBe(33) // 30 + 3
    // originals unchanged (immutability)
    expect(a.pos.y).toBe(20)
    expect(b.pos.y).toBe(30)
  })

  it('does not gust when gusts are disabled', () => {
    const d = new VerticalDriver({ gustPeriodMs: 0, gustStrength: 5 })
    const a = climber(new Vec2(0, 0))
    const r = d.gust([a], 99999)
    expect(r.fired).toBe(false)
    expect(r.entities).toEqual([a])
  })

  it('inversion volumes flip the gravity sign while the entity is inside', () => {
    const volume = { box: CollisionBox.of(0, 0, 10, 10) }
    const d = new VerticalDriver({ gravityY: 12, inversionVolumes: [volume] })

    const inside = climber(new Vec2(2, 2)) // overlaps the volume
    expect(d.isInverted(inside)).toBe(true)
    expect(d.effectiveGravity(inside).equals(new Vec2(0, -12))).toBe(true) // points up
    const grav = d.applyGravity(inside, 100, BOUNDS)
    expect(grav.velocity.y).toBeCloseTo(-1.2) // pulled upward

    const outside = climber(new Vec2(50, 50))
    expect(d.isInverted(outside)).toBe(false)
    expect(d.effectiveGravity(outside).equals(new Vec2(0, 12))).toBe(true)
  })

  it('does not clamp to the floor while inverted (can pass the bottom going up)', () => {
    const volume = { box: CollisionBox.of(0, 90, 20, 20) }
    const d = new VerticalDriver({ gravityY: 12, inversionVolumes: [volume] })
    const nearFloor = climber(new Vec2(0, 97), new Vec2(0, -5)) // moving up, inside volume
    const moved = d.applyMovement(nearFloor, noMove, 100, BOUNDS)
    expect(moved.pos.y).toBeCloseTo(96.5) // -5 * 0.1, no floor clamp
  })

  it('does not mutate inputs', () => {
    const d = new VerticalDriver({ gravityY: 12, climbSpeed: 8 })
    const e = climber(new Vec2(0, 50))
    d.applyGravity(e, 100, BOUNDS)
    d.applyMovement(e, { moveX: 0, moveY: 1, jump: false }, 100, BOUNDS)
    expect(e.pos.equals(new Vec2(0, 50))).toBe(true)
    expect(e.velocity.equals(Vec2.ZERO)).toBe(true)
  })
})

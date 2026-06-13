import { Vec2 } from '@/engine/quest/Vec2'
import { Entity } from '@/engine/quest/Entity'
import { HorizontalDriver } from '@/engine/quest/physics/HorizontalDriver'
import type { PhysicsBounds } from '@/engine/quest/physics/PhysicsDriver'

const BOUNDS: PhysicsBounds = { groundY: 10 }

function player(pos: Vec2, velocity = Vec2.ZERO): Entity {
  return new Entity({ id: 'p', team: 'player', pos, velocity, width: 1, height: 2, hp: 5, maxHp: 5 })
}

const noMove = { moveX: 0, moveY: 0, jump: false }

describe('HorizontalDriver', () => {
  it('exposes downward gravity (0, +y)', () => {
    const d = new HorizontalDriver({ gravityY: 30 })
    expect(d.gravity.equals(new Vec2(0, 30))).toBe(true)
  })

  it('reports grounded when the entity bottom reaches the floor', () => {
    const d = new HorizontalDriver()
    expect(d.isGrounded(player(new Vec2(0, 8)), BOUNDS)).toBe(true) // 8 + 2 = 10
    expect(d.isGrounded(player(new Vec2(0, 4)), BOUNDS)).toBe(false)
    expect(d.canJump(player(new Vec2(0, 8)), BOUNDS)).toBe(true)
    expect(d.canJump(player(new Vec2(0, 4)), BOUNDS)).toBe(false)
  })

  it('accumulates downward velocity while airborne and rests on the ground', () => {
    const d = new HorizontalDriver({ gravityY: 30 })
    const airborne = player(new Vec2(0, 0))
    const afterGravity = d.applyGravity(airborne, 100, BOUNDS) // +30 * 0.1 = +3
    expect(afterGravity.velocity.y).toBeCloseTo(3)

    const grounded = player(new Vec2(0, 8))
    expect(d.applyGravity(grounded, 100, BOUNDS)).toBe(grounded) // no accumulation when resting
  })

  it('wormsLike step: moveX drives a fixed horizontal step, not inertial drift', () => {
    const d = new HorizontalDriver({ moveSpeed: 8 })
    const e = player(new Vec2(0, 8))
    const right = d.applyMovement(e, { moveX: 1, moveY: 0, jump: false }, 100, BOUNDS) // 8 * 0.1
    expect(right.pos.x).toBeCloseTo(0.8)
    // velocity.x reflects the step intent, but the next step with no input stops immediately.
    const stop = d.applyMovement(right, noMove, 100, BOUNDS)
    expect(stop.pos.x).toBeCloseTo(0.8) // did not coast further
    expect(stop.velocity.x).toBe(0)
  })

  it('jump imparts an upward velocity only when grounded', () => {
    const d = new HorizontalDriver({ jumpVelocity: 18 })
    const grounded = player(new Vec2(0, 8))
    const jumped = d.applyMovement(grounded, { moveX: 0, moveY: 0, jump: true }, 100, BOUNDS)
    expect(jumped.velocity.y).toBe(-18) // negative = up
    expect(jumped.pos.y).toBeLessThan(8) // moved up off the floor

    const airborne = player(new Vec2(0, 0))
    const noDoubleJump = d.applyMovement(airborne, { moveX: 0, moveY: 0, jump: true }, 100, BOUNDS)
    expect(noDoubleJump.velocity.y).toBe(0) // cannot jump mid-air
  })

  it('falling entity lands exactly on the floor and zeroes downward velocity', () => {
    const d = new HorizontalDriver()
    const falling = player(new Vec2(0, 7), new Vec2(0, 50)) // would overshoot the floor
    const landed = d.applyMovement(falling, noMove, 100, BOUNDS)
    expect(landed.pos.y).toBe(8) // groundY(10) - height(2)
    expect(landed.velocity.y).toBe(0)
    expect(d.isGrounded(landed, BOUNDS)).toBe(true)
  })

  it('clamps movement intent magnitude to 1', () => {
    const d = new HorizontalDriver({ moveSpeed: 8 })
    const e = player(new Vec2(0, 8))
    const overdriven = d.applyMovement(e, { moveX: 5, moveY: 0, jump: false }, 100, BOUNDS)
    expect(overdriven.pos.x).toBeCloseTo(0.8) // same as moveX:1
  })

  it('does not mutate the input entity', () => {
    const d = new HorizontalDriver()
    const e = player(new Vec2(0, 0))
    d.applyGravity(e, 100, BOUNDS)
    d.applyMovement(e, { moveX: 1, moveY: 0, jump: false }, 100, BOUNDS)
    expect(e.pos.equals(new Vec2(0, 0))).toBe(true)
    expect(e.velocity.equals(Vec2.ZERO)).toBe(true)
  })
})

import { Vec2 } from '@/engine/quest/Vec2'
import type { Entity, EntityInput } from '@/engine/quest/Entity'
import type { PhysicsBounds, PhysicsDriver } from '@/engine/quest/physics/PhysicsDriver'

// Mode A: the side-scroller (ADR §6.2). Gravity pulls +y (downward on screen); the player
// drives along X with a "wormsLike" step — discrete left/right walking at a fixed speed,
// and a jump that only fires when grounded, applying an upward velocity impulse. Vertical
// motion is fully physical (gravity integrates, ground halts the fall). Immutable: every
// method returns a new Entity.

export interface HorizontalDriverConfig {
  /** Downward gravity acceleration in cells/s². */
  readonly gravityY: number
  /** Horizontal walk speed in cells/s applied per unit of moveX. */
  readonly moveSpeed: number
  /** Upward velocity (cells/s) imparted by a jump (negative y = up). */
  readonly jumpVelocity: number
}

const DEFAULTS: HorizontalDriverConfig = { gravityY: 30, moveSpeed: 8, jumpVelocity: 18 }

export class HorizontalDriver implements PhysicsDriver {
  readonly gravity: Vec2
  private readonly moveSpeed: number
  private readonly jumpVelocity: number

  constructor(config: Partial<HorizontalDriverConfig> = {}) {
    const merged = { ...DEFAULTS, ...config }
    this.gravity = new Vec2(0, merged.gravityY)
    this.moveSpeed = merged.moveSpeed
    this.jumpVelocity = merged.jumpVelocity
  }

  applyGravity(entity: Entity, dtMs: number, bounds: PhysicsBounds): Entity {
    if (this.isGrounded(entity, bounds)) return entity // resting: no accumulation
    const dtSec = dtMs / 1000
    return entity.withVelocity(entity.velocity.add(this.gravity.scale(dtSec)))
  }

  applyMovement(
    entity: Entity,
    input: EntityInput,
    dtMs: number,
    bounds: PhysicsBounds,
  ): Entity {
    const dtSec = dtMs / 1000

    // Horizontal is a direct wormsLike step: velocity.x is the walk intent, not inertial.
    let vx = clampUnit(input.moveX) * this.moveSpeed
    let vy = entity.velocity.y

    if (input.jump && this.canJump(entity, bounds)) {
      vy = -this.jumpVelocity // negative y = up
    }

    const moved = entity.pos.add(new Vec2(vx * dtSec, vy * dtSec))

    // Resolve against the ground: clamp the entity's bottom to groundY, kill downward vy.
    const maxY = bounds.groundY - entity.height
    if (moved.y >= maxY && vy >= 0) {
      return entity.withPos(moved.withY(maxY)).withVelocity(new Vec2(vx, 0))
    }
    return entity.withPos(moved).withVelocity(new Vec2(vx, vy))
  }

  canJump(entity: Entity, bounds: PhysicsBounds): boolean {
    return this.isGrounded(entity, bounds)
  }

  isGrounded(entity: Entity, bounds: PhysicsBounds): boolean {
    return entity.pos.y + entity.height >= bounds.groundY
  }
}

/** Clamp an intent axis to [-1, 1]. */
function clampUnit(v: number): number {
  return Math.max(-1, Math.min(1, v))
}

import { Vec2 } from '@/engine/quest/Vec2'
import { CollisionBox } from '@/engine/quest/collision'
import type { Entity, EntityInput } from '@/engine/quest/Entity'
import type { PhysicsBounds, PhysicsDriver } from '@/engine/quest/physics/PhysicsDriver'

// Mode B: the climb (ADR §6.2) — the beanstalk, the raison d'être of Phase 1. Gravity is
// still (0,+1) downward, but the player's input and the scroll are the Y axis: pushing
// "up" (moveY > 0) climbs against gravity. Two hazards are unique to this mode:
//   * GUSTS — periodic downward shoves applied to ALL entities (forceMoveAll(0, +g)).
//   * INVERSION VOLUMES — trigger rectangles that flip the gravity sign while an entity is
//     inside them (climb becomes a controlled descent). Sign flips per-entity, per-step.
// Immutable throughout: every method returns new entities; gust returns a new array.

/** A trigger rectangle that inverts gravity for any entity whose box overlaps it. */
export interface InversionVolume {
  readonly box: CollisionBox
}

export interface VerticalDriverConfig {
  /** Downward gravity acceleration in cells/s². */
  readonly gravityY: number
  /** Climb speed in cells/s applied per unit of (upward) moveY intent. */
  readonly climbSpeed: number
  /** Gust period in ms between shoves; <=0 disables gusts. */
  readonly gustPeriodMs: number
  /** Cells each gust pushes every entity downward (+y). */
  readonly gustStrength: number
  readonly inversionVolumes: readonly InversionVolume[]
}

const DEFAULTS: VerticalDriverConfig = {
  gravityY: 12,
  climbSpeed: 8,
  gustPeriodMs: 0,
  gustStrength: 0,
  inversionVolumes: [],
}

export class VerticalDriver implements PhysicsDriver {
  readonly gravity: Vec2
  private readonly climbSpeed: number
  readonly gustPeriodMs: number
  private readonly gustStrength: number
  private readonly inversionVolumes: readonly InversionVolume[]
  /** Accumulated ms toward the next gust; advanced by the Scene via gust(). */
  private gustClockMs = 0

  constructor(config: Partial<VerticalDriverConfig> = {}) {
    const merged = { ...DEFAULTS, ...config }
    this.gravity = new Vec2(0, merged.gravityY)
    this.climbSpeed = merged.climbSpeed
    this.gustPeriodMs = merged.gustPeriodMs
    this.gustStrength = merged.gustStrength
    this.inversionVolumes = merged.inversionVolumes
  }

  /** The gravity vector for `entity`, sign-flipped while it is inside an inversion volume. */
  effectiveGravity(entity: Entity): Vec2 {
    return this.isInverted(entity) ? this.gravity.scale(-1) : this.gravity
  }

  isInverted(entity: Entity): boolean {
    const box = entity.cbc
    return this.inversionVolumes.some((v) => box.overlaps(v.box))
  }

  applyGravity(entity: Entity, dtMs: number, bounds: PhysicsBounds): Entity {
    // At the ground floor with normal (downward) gravity, the entity rests — no fall.
    if (!this.isInverted(entity) && this.isGrounded(entity, bounds)) {
      return entity.withVelocity(entity.velocity.withY(0))
    }
    const dtSec = dtMs / 1000
    return entity.withVelocity(entity.velocity.add(this.effectiveGravity(entity).scale(dtSec)))
  }

  applyMovement(
    entity: Entity,
    input: EntityInput,
    dtMs: number,
    bounds: PhysicsBounds,
  ): Entity {
    const dtSec = dtMs / 1000
    // moveY > 0 means "climb up": subtract from screen-y. This is the rotated axis.
    const climbVy = -clampUnit(input.moveY) * this.climbSpeed
    const vy = entity.velocity.y + climbVy
    const moved = entity.pos.add(new Vec2(0, vy * dtSec))

    const maxY = bounds.groundY - entity.height
    if (moved.y >= maxY && !this.isInverted(entity)) {
      return entity.withPos(moved.withY(maxY)).withVelocity(entity.velocity.withY(0))
    }
    return entity.withPos(moved)
  }

  /**
   * Advance the gust clock by `dtMs`; when a gust fires, shove EVERY entity downward by
   * `gustStrength` cells (forceMoveAll(0, +g)). Returns the (possibly unchanged) array and
   * whether a gust fired this call. Pure w.r.t. the entities (a new array on a gust).
   */
  gust(entities: readonly Entity[], dtMs: number): { entities: readonly Entity[]; fired: boolean } {
    if (this.gustPeriodMs <= 0) return { entities, fired: false }
    this.gustClockMs += dtMs
    if (this.gustClockMs < this.gustPeriodMs) return { entities, fired: false }
    this.gustClockMs -= this.gustPeriodMs
    const shoved = entities.map((e) => e.withPos(e.pos.add(new Vec2(0, this.gustStrength))))
    return { entities: shoved, fired: true }
  }

  canJump(): boolean {
    return false // climbing replaces jumping in Mode B
  }

  isGrounded(entity: Entity, bounds: PhysicsBounds): boolean {
    return entity.pos.y + entity.height >= bounds.groundY
  }
}

/** Clamp an intent axis to [-1, 1]. */
function clampUnit(v: number): number {
  return Math.max(-1, Math.min(1, v))
}

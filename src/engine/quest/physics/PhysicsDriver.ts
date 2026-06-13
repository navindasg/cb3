import type { Vec2 } from '@/engine/quest/Vec2'
import type { Entity, EntityInput } from '@/engine/quest/Entity'

// The strategy that distinguishes the four quest modes (ADR §6.2 L2). The Scene swaps one
// driver per QuestDef.mode; everything else (entities, collision, waves, scrolling) is
// shared. A driver only decides how gravity and movement are applied and what "grounded"
// and "can jump" mean — it never touches the DOM and returns NEW entities (immutable).

/** The vertical floor of the scene, in cells: an entity rests when its bottom reaches it. */
export interface PhysicsBounds {
  /** Ground row (cell): an entity's bottom never passes below this. */
  readonly groundY: number
}

export interface PhysicsDriver {
  /** The gravity acceleration vector (cells/s²) this mode applies. */
  readonly gravity: Vec2
  /** Apply gravity to `entity`'s velocity for `dtMs`. Returns a new entity. */
  applyGravity(entity: Entity, dtMs: number, bounds: PhysicsBounds): Entity
  /** Apply movement input + integrate position, resolving against `bounds`. New entity. */
  applyMovement(entity: Entity, input: EntityInput, dtMs: number, bounds: PhysicsBounds): Entity
  /** Whether `entity` may jump right now (typically: grounded). */
  canJump(entity: Entity, bounds: PhysicsBounds): boolean
  /** Whether `entity` is resting on the ground. */
  isGrounded(entity: Entity, bounds: PhysicsBounds): boolean
}

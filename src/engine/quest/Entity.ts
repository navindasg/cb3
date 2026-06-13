import { Vec2 } from '@/engine/quest/Vec2'
import { CollisionBox } from '@/engine/quest/collision'

// An immutable quest entity (ADR §6.2 L1). Keeps CB2's composition model — an entity owns
// its position, collision box, hp, weapons, abilities and team — but every "change" returns
// a NEW Entity rather than mutating in place. `update()` returns the entity advanced by one
// scene step; the Scene replaces the old reference with the returned one.

/** Which side an entity fights for. 'neutral' entities never collide-damage. */
export type Team = 'player' | 'enemy' | 'neutral'

/** A weapon the entity can attack with (data only; combat resolution lives in the Scene). */
export interface Weapon {
  readonly id: string
  readonly damage: number
  /** Reach in cells. */
  readonly range: number
}

/** A castable ability with its own LIVE (not persisted) cooldown — see Scene per-spell map. */
export interface Ability {
  readonly id: string
  /** Cooldown in ms between casts. */
  readonly cooldownMs: number
}

/** The per-step inputs an entity reacts to (movement intent, jump, cast requests). */
export interface EntityInput {
  /** Horizontal movement intent in [-1, 1] (left/right). */
  readonly moveX: number
  /** Vertical movement intent in [-1, 1] (up = negative on screen, but Mode B uses +climb). */
  readonly moveY: number
  /** Whether a jump was requested this step. */
  readonly jump: boolean
}

const NO_INPUT: EntityInput = { moveX: 0, moveY: 0, jump: false }

export interface EntityConfig {
  readonly id: string
  readonly team: Team
  readonly pos: Vec2
  readonly width: number
  readonly height: number
  readonly hp: number
  readonly maxHp: number
  readonly velocity?: Vec2
  readonly weapons?: readonly Weapon[]
  readonly abilities?: readonly Ability[]
  readonly tags?: readonly string[]
}

export class Entity {
  readonly id: string
  readonly team: Team
  readonly pos: Vec2
  readonly velocity: Vec2
  readonly width: number
  readonly height: number
  readonly hp: number
  readonly maxHp: number
  readonly weapons: readonly Weapon[]
  readonly abilities: readonly Ability[]
  readonly tags: readonly string[]

  constructor(config: EntityConfig) {
    this.id = config.id
    this.team = config.team
    this.pos = config.pos
    this.velocity = config.velocity ?? Vec2.ZERO
    this.width = config.width
    this.height = config.height
    this.hp = config.hp
    this.maxHp = config.maxHp
    this.weapons = config.weapons ?? []
    this.abilities = config.abilities ?? []
    this.tags = config.tags ?? []
  }

  /** The entity's collision box at its current position. */
  get cbc(): CollisionBox {
    return new CollisionBox(this.pos, this.width, this.height)
  }

  get isDead(): boolean {
    return this.hp <= 0
  }

  hasTag(tag: string): boolean {
    return this.tags.includes(tag)
  }

  /** A copy at a new position. Returns a new Entity. */
  withPos(pos: Vec2): Entity {
    return this.copyWith({ pos })
  }

  /** A copy with a new velocity. Returns a new Entity. */
  withVelocity(velocity: Vec2): Entity {
    return this.copyWith({ velocity })
  }

  /** A copy with hp clamped to [0, maxHp]. Returns a new Entity. */
  withHp(hp: number): Entity {
    return this.copyWith({ hp: Math.max(0, Math.min(this.maxHp, hp)) })
  }

  /** A copy after taking `amount` damage (clamped at 0). Returns a new Entity. */
  damaged(amount: number): Entity {
    if (amount <= 0) return this
    return this.withHp(this.hp - amount)
  }

  /**
   * Advance one scene step. The base entity integrates its velocity into position
   * (drivers having already set the velocity from gravity/input). Specialised behaviour
   * (AI, weapon fire) is layered by the Scene; this keeps the primitive pure and minimal.
   */
  update(_scene: unknown, input: EntityInput = NO_INPUT, dtMs: number): Entity {
    void input
    const dtSec = dtMs / 1000
    const nextPos = this.pos.add(this.velocity.scale(dtSec))
    return this.withPos(nextPos)
  }

  private copyWith(patch: Partial<EntityConfig>): Entity {
    return new Entity({
      id: patch.id ?? this.id,
      team: patch.team ?? this.team,
      pos: patch.pos ?? this.pos,
      velocity: patch.velocity ?? this.velocity,
      width: patch.width ?? this.width,
      height: patch.height ?? this.height,
      hp: patch.hp ?? this.hp,
      maxHp: patch.maxHp ?? this.maxHp,
      weapons: patch.weapons ?? this.weapons,
      abilities: patch.abilities ?? this.abilities,
      tags: patch.tags ?? this.tags,
    })
  }
}

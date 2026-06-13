import { Vec2 } from '@/engine/quest/Vec2'
import { CollisionBox } from '@/engine/quest/collision'
import { Entity, type Ability, type EntityInput } from '@/engine/quest/Entity'
import { WaveScheduler } from '@/engine/quest/WaveScheduler'
import type { PhysicsBounds, PhysicsDriver } from '@/engine/quest/physics/PhysicsDriver'
import type {
  QuestDef,
  SafeZoneDef,
  SpawnOrder,
  WinCondition,
} from '@/engine/types/defs'

// The generic QuestDef runtime (ADR §6.2 L5). ONE Scene executes ANY quest; only the
// PhysicsDriver and the win/scroll specifics differ, and those come from data. The base
// loop per step is: schedule spawns -> update entities -> cull dead -> checkWin ->
// checkDeath -> applyScroll. On player death the scene respawns the player at the last
// banked SafeZone, losing NOTHING (full hp, same loadout) and picks a death message from
// the QuestDef. Per-spell cooldowns live ONLY on the instance (resolved decision 5: not
// persisted — quests do not survive a reload mid-run). Immutable: step() returns a NEW Scene.

/** Builds a quest entity from a spawn order's template id (content supplies the templates). */
export type EntityFactory = (order: SpawnOrder) => Entity

export type ScenePhase = 'active' | 'won' | 'dead'

/** The result of a death this step — which respawn happened and the flavor line shown. */
export interface DeathEvent {
  /** The damage source that killed the player ('generic' when unattributed). */
  readonly source: string
  /** The death message chosen from QuestDef.deathMessages. */
  readonly message: string
}

export interface SceneStepInput {
  /** Player movement/jump intent this step. */
  readonly playerInput: EntityInput
  /** Events raised externally this step (feed the wave scheduler's 'event' triggers). */
  readonly events?: readonly string[]
  /** Spell ids the player requested to cast this step (gated by live cooldowns). */
  readonly castRequests?: readonly string[]
  /** Damage dealt to the player this step (combat is resolved by the host/content). */
  readonly playerDamage?: number
  /** Optional damage source attribution for a death this step (for the message pick). */
  readonly deathSource?: string
}

export interface SceneConfig {
  readonly def: QuestDef
  readonly driver: PhysicsDriver
  readonly entityFactory: EntityFactory
  /** The player's spell loadout for this run (abilities carry their own cooldownMs). */
  readonly playerAbilities?: readonly Ability[]
}

const PLAYER_ID = '__player__'

export class Scene {
  readonly def: QuestDef
  private readonly driver: PhysicsDriver
  private readonly factory: EntityFactory

  readonly entities: readonly Entity[]
  readonly scroll: number
  readonly elapsedMs: number
  readonly phase: ScenePhase
  readonly scheduler: WaveScheduler
  /** The last banked safe-zone respawn position (lose-nothing respawn). */
  readonly respawnPos: Vec2
  /** Live per-spell cooldown end times (ms of scene-elapsed). NOT persisted. */
  readonly cooldowns: ReadonlyMap<string, number>
  /** The death event raised on the step the player died (else null). */
  readonly lastDeath: DeathEvent | null

  private constructor(
    config: SceneConfig,
    entities: readonly Entity[],
    scroll: number,
    elapsedMs: number,
    phase: ScenePhase,
    scheduler: WaveScheduler,
    respawnPos: Vec2,
    cooldowns: ReadonlyMap<string, number>,
    lastDeath: DeathEvent | null,
  ) {
    this.def = config.def
    this.driver = config.driver
    this.factory = config.entityFactory
    this.entities = entities
    this.scroll = scroll
    this.elapsedMs = elapsedMs
    this.phase = phase
    this.scheduler = scheduler
    this.respawnPos = respawnPos
    this.cooldowns = cooldowns
    this.lastDeath = lastDeath
  }

  /** Build the initial scene: spawn the player + the static entities, bank the start point. */
  static start(config: SceneConfig): Scene {
    const { def, entityFactory } = config
    const start = new Vec2(def.playerStart.x, def.playerStart.y)
    const player = new Entity({
      id: PLAYER_ID,
      team: 'player',
      pos: start,
      width: 1,
      height: 1,
      hp: def.playerMaxHp,
      maxHp: def.playerMaxHp,
      abilities: config.playerAbilities ?? [],
    })
    const statics = def.staticSpawns.map(entityFactory)
    return new Scene(
      config,
      [player, ...statics],
      0,
      0,
      'active',
      WaveScheduler.create(def.waves),
      start,
      new Map(),
      null,
    )
  }

  /** The player entity (always present while active; absent only transiently mid-death). */
  get player(): Entity | undefined {
    return this.entities.find((e) => e.id === PLAYER_ID)
  }

  private get bounds(): PhysicsBounds {
    return { groundY: this.def.height }
  }

  /** True when `spellId` is off cooldown and may be cast now. */
  canCast(spellId: string): boolean {
    const until = this.cooldowns.get(spellId)
    return until === undefined || this.elapsedMs >= until
  }

  /**
   * Advance one step. Runs the base loop (schedule -> update -> cull -> win -> death ->
   * scroll). Returns a NEW Scene; a terminal scene (won/dead) returns itself unchanged so
   * the caller can hold the result without driving it further.
   */
  step(input: SceneStepInput, dtMs: number): Scene {
    if (this.phase !== 'active') return this

    const elapsedMs = this.elapsedMs + dtMs

    // 1) schedule spawns from any triggers crossed this step.
    const evalResult = this.scheduler.evaluate({
      scroll: this.scroll,
      elapsedMs,
      events: input.events ?? [],
    })
    const spawned = evalResult.spawns.map((o) => this.factory(o))

    // 2) update entities: gravity + movement for the player, position integration for the
    //    rest. Each returns a NEW entity (no shared-Vec2 aliasing across the array).
    const updated = [...this.entities, ...spawned].map((e) =>
      e.id === PLAYER_ID
        ? this.updatePlayer(e, input.playerInput, input.playerDamage ?? 0, dtMs)
        : e.update(this, undefined, dtMs),
    )

    // 3) cull the dead (excluding the player; player death is handled in checkDeath).
    const culled = updated.filter((e) => e.id === PLAYER_ID || !e.isDead)

    // refresh cooldowns from this step's cast requests.
    const cooldowns = this.applyCasts(culled, input.castRequests ?? [], elapsedMs)

    // 4) checkWin.
    const nextScroll = this.applyScroll(culled)
    if (this.isWon(evalResult.scheduler, nextScroll, input.events ?? [])) {
      return this.derive(culled, nextScroll, elapsedMs, 'won', evalResult.scheduler, cooldowns, null)
    }

    // 5) checkDeath -> respawn at last safe zone (lose nothing) and raise a death event.
    const player = culled.find((e) => e.id === PLAYER_ID)
    if (player && player.isDead) {
      const respawned = this.respawnPlayer(player)
      const remaining = culled.map((e) => (e.id === PLAYER_ID ? respawned : e))
      return this.derive(
        remaining,
        nextScroll,
        elapsedMs,
        'active',
        evalResult.scheduler,
        cooldowns,
        this.pickDeath(input.deathSource),
      )
    }

    // 6) applyScroll + bank a new respawn point if the player stands in a safe zone.
    const banked = player ? this.bankSafeZone(player) : this.respawnPos
    return new Scene(
      { def: this.def, driver: this.driver, entityFactory: this.factory },
      culled,
      nextScroll,
      elapsedMs,
      'active',
      evalResult.scheduler,
      banked,
      cooldowns,
      null,
    )
  }

  private updatePlayer(player: Entity, input: EntityInput, damage: number, dtMs: number): Entity {
    const gravved = this.driver.applyGravity(player, dtMs, this.bounds)
    const moved = this.driver.applyMovement(gravved, input, dtMs, this.bounds)
    return damage > 0 ? moved.damaged(damage) : moved
  }

  private applyCasts(
    entities: readonly Entity[],
    requests: readonly string[],
    elapsedMs: number,
  ): ReadonlyMap<string, number> {
    if (requests.length === 0) return this.cooldowns
    const player = entities.find((e) => e.id === PLAYER_ID)
    if (!player) return this.cooldowns
    const next = new Map(this.cooldowns)
    for (const spellId of requests) {
      const ability = player.abilities.find((a) => a.id === spellId)
      if (!ability) continue
      const until = next.get(spellId)
      if (until !== undefined && elapsedMs < until) continue // still on cooldown
      next.set(spellId, elapsedMs + ability.cooldownMs)
    }
    return next
  }

  private applyScroll(entities: readonly Entity[]): number {
    // Scroll follows the player toward the win axis; horizontal quests scroll on X, vertical
    // on Y (the player's distance from start along the mode's axis). Clamped to >= current.
    const player = entities.find((e) => e.id === PLAYER_ID)
    if (!player) return this.scroll
    const start = this.def.playerStart
    const travelled =
      this.def.mode === 'vertical'
        ? Math.max(0, start.y - player.pos.y) // climbing = decreasing screen-y
        : Math.max(0, player.pos.x - start.x)
    return Math.max(this.scroll, travelled)
  }

  private isWon(scheduler: WaveScheduler, scroll: number, events: readonly string[]): boolean {
    return matchesWin(this.def.winCondition, scheduler, scroll, events)
  }

  /** Respawn the player at the last banked safe zone with full hp and the same loadout. */
  private respawnPlayer(player: Entity): Entity {
    return player.withPos(this.respawnPos).withVelocity(Vec2.ZERO).withHp(player.maxHp)
  }

  /** Bank a new respawn point when the player's box overlaps a safe zone; else keep current. */
  private bankSafeZone(player: Entity): Vec2 {
    const box = player.cbc
    const inZone = this.def.safeZones.some((z) => box.overlaps(safeZoneBox(z)))
    return inZone ? player.pos : this.respawnPos
  }

  /** Pick the death message for `source`, falling back to the 'generic' entry. */
  private pickDeath(source: string | undefined): DeathEvent {
    const src = source ?? 'generic'
    const exact = this.def.deathMessages.find((m) => m.source === src)
    const chosen = exact ?? this.def.deathMessages.find((m) => m.source === 'generic')
    return { source: src, message: chosen?.message ?? '' }
  }

  private derive(
    entities: readonly Entity[],
    scroll: number,
    elapsedMs: number,
    phase: ScenePhase,
    scheduler: WaveScheduler,
    cooldowns: ReadonlyMap<string, number>,
    lastDeath: DeathEvent | null,
  ): Scene {
    return new Scene(
      { def: this.def, driver: this.driver, entityFactory: this.factory },
      entities,
      scroll,
      elapsedMs,
      phase,
      scheduler,
      this.respawnPos,
      cooldowns,
      lastDeath,
    )
  }
}

/** The collision box of a safe zone. */
function safeZoneBox(z: SafeZoneDef): CollisionBox {
  return CollisionBox.of(z.x, z.y, z.width, z.height)
}

/** Whether the win condition is satisfied. Exported-shape pure helper. */
function matchesWin(
  win: WinCondition,
  scheduler: WaveScheduler,
  scroll: number,
  events: readonly string[],
): boolean {
  switch (win.kind) {
    case 'reachScroll':
      return scroll >= win.atScroll
    case 'clearWaves':
      return scheduler.allFired
    case 'event':
      return events.includes(win.event)
  }
}

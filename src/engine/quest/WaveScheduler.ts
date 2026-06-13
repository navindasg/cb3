import type { SpawnOrder, WaveDef } from '@/engine/types/defs'

// The wave trigger state machine (ADR §6.2 L4). It evaluates each wave's trigger
// (distance | timer | event) against the scene's progress and emits the spawn orders of
// every wave that crossed its threshold THIS step — each wave fires at most once. All
// progress lives in one plain, snapshottable object (`firedIds`), so a quest's wave state
// could in principle be serialized. Pure & immutable: evaluate() returns a NEW scheduler.

/** The scene progress the scheduler reads each step. */
export interface WaveContext {
  /** Accumulated scroll distance in cells (drives 'distance' triggers). */
  readonly scroll: number
  /** Accumulated scene time in ms (drives 'timer' triggers). */
  readonly elapsedMs: number
  /** Events raised this step (drives 'event' triggers), e.g. ['bossEnraged']. */
  readonly events: readonly string[]
}

export interface WaveEvaluation {
  /** The scheduler advanced past the waves that fired. */
  readonly scheduler: WaveScheduler
  /** The spawn orders emitted this step (concatenation of all newly-fired waves). */
  readonly spawns: readonly SpawnOrder[]
  /** The ids of the waves that fired this step. */
  readonly firedIds: readonly string[]
}

export class WaveScheduler {
  private readonly waves: readonly WaveDef[]
  /** The ids of waves already fired — the entire mutable progress, snapshottable. */
  readonly firedIds: ReadonlySet<string>

  private constructor(waves: readonly WaveDef[], firedIds: ReadonlySet<string>) {
    this.waves = waves
    this.firedIds = firedIds
  }

  static create(waves: readonly WaveDef[]): WaveScheduler {
    return new WaveScheduler(waves, new Set())
  }

  /** True when every wave has fired (lets the Scene end a 'clearWaves' quest). */
  get allFired(): boolean {
    return this.firedIds.size >= this.waves.length
  }

  /** A copy with the given wave ids marked fired (for restoring a snapshot). */
  withFired(ids: Iterable<string>): WaveScheduler {
    return new WaveScheduler(this.waves, new Set([...this.firedIds, ...ids]))
  }

  /**
   * Evaluate every not-yet-fired wave against `ctx`. Returns a new scheduler with the
   * crossed waves marked fired plus their concatenated spawn orders. A given wave can never
   * fire twice — once its id is in `firedIds` it is skipped forever.
   */
  evaluate(ctx: WaveContext): WaveEvaluation {
    const newlyFired: string[] = []
    const spawns: SpawnOrder[] = []

    for (const wave of this.waves) {
      if (this.firedIds.has(wave.id)) continue
      if (!triggerMet(wave, ctx)) continue
      newlyFired.push(wave.id)
      for (const spawn of wave.spawns) spawns.push(spawn)
    }

    if (newlyFired.length === 0) {
      return { scheduler: this, spawns: [], firedIds: [] }
    }
    return {
      scheduler: this.withFired(newlyFired),
      spawns,
      firedIds: newlyFired,
    }
  }
}

/** Whether `wave`'s trigger condition is satisfied by the current context. */
function triggerMet(wave: WaveDef, ctx: WaveContext): boolean {
  const t = wave.trigger
  switch (t.kind) {
    case 'distance':
      return ctx.scroll >= t.atScroll
    case 'timer':
      return ctx.elapsedMs >= t.atMs
    case 'event':
      return ctx.events.includes(t.event)
  }
}

import { Scene, type SceneConfig, type SceneStepInput } from '@/engine/quest/Scene'
import { VerticalDriver } from '@/engine/quest/physics/VerticalDriver'

// The host that drives a Scene from the outside (Block H wiring). The Scene base loop is pure
// and deliberately does NOT call the VerticalDriver gust (the periodic downward shove of every
// entity) — that is a host responsibility so the gust cadence is owned by whoever owns the
// frame. This host advances the gust each step (feeding the shoved entities back through
// Scene.mapEntities, per the prior block note) and then steps the scene. It holds the single
// live Scene reference; each step replaces it with the returned (immutable) successor.

export interface QuestStepResult {
  /** The scene after this step. */
  readonly scene: Scene
  /** True when a gust fired this step (for the arena to flash the gust cue). */
  readonly gusted: boolean
}

export interface QuestHost {
  scene(): Scene
  /** Advance one step: apply the gust (if any), then run the Scene loop. */
  step(input: SceneStepInput, dtMs: number): QuestStepResult
}

/** Build a quest host around a Scene config. The driver may be any PhysicsDriver. */
export function createQuestHost(config: SceneConfig): QuestHost {
  let scene = Scene.start(config)
  const driver = config.driver

  function step(input: SceneStepInput, dtMs: number): QuestStepResult {
    let gusted = false
    // Only the VerticalDriver gusts; advance its clock against the current entities and feed
    // the shoved entities back into the scene before the regular step.
    if (driver instanceof VerticalDriver) {
      const result = driver.gust(scene.entities, dtMs)
      gusted = result.fired
      if (result.fired) {
        const shoved = result.entities
        scene = scene.mapEntities((e) => shoved.find((s) => s.id === e.id) ?? e)
      }
    }
    scene = scene.step(input, dtMs)
    return { scene, gusted }
  }

  return {
    scene: () => scene,
    step,
  }
}

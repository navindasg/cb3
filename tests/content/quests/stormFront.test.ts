import { createDefaultSave } from '@/engine/state/defaultSave'
import { Scene, type SceneStepInput } from '@/engine/quest/Scene'
import { VerticalDriver } from '@/engine/quest/physics/VerticalDriver'
import { createEntityFactory } from '@/engine/content/entityFactory'
import { applyQuestWin } from '@/engine/quest/questRewards'
import { TEMPLATE_MAP } from '@/content/quests/entityTemplates'
import { STORM_FRONT } from '@/content/quests/stormFront'
import { STORM_FRONT_CLEARED_FLAG } from '@/content/flags'

const factory = createEntityFactory(TEMPLATE_MAP)
const climbUp: SceneStepInput = { playerInput: { moveX: 0, moveY: 1, jump: false } }

/** A fast climb driver: climb speed easily beats gravity so the player ascends past obstacles. */
function climbDriver(): VerticalDriver {
  return new VerticalDriver({ gravityY: 6, climbSpeed: 30, gustPeriodMs: 0, gustStrength: 0 })
}

function startStorm(): Scene {
  return Scene.start({ def: STORM_FRONT, driver: climbDriver(), entityFactory: factory })
}

describe('the storm front (Quest 3) — the second VerticalDriver Scene quest', () => {
  it('is authored as a vertical quest', () => {
    expect(STORM_FRONT.mode).toBe('vertical')
  })

  it('starts active with the player at the bridge head and storm sprites on the climb', () => {
    const scene = startStorm()
    expect(scene.phase).toBe('active')
    expect(scene.player?.hp).toBe(STORM_FRONT.playerMaxHp)
    expect(scene.entities.some((e) => e.hasTag('stormSprite'))).toBe(true)
  })

  it('the thunderhead djinn looms near the summit as the climb scrolls', () => {
    let scene = startStorm()
    let sawDjinn = false
    let guard = 0
    while (scene.phase === 'active' && guard++ < 6000) {
      scene = scene.step(climbUp, 100)
      if (scene.entities.some((e) => e.hasTag('thunderheadDjinn'))) sawDjinn = true
    }
    expect(sawDjinn).toBe(true)
  })

  it('completes via the VerticalDriver by reaching the top scroll', () => {
    let scene = startStorm()
    let guard = 0
    while (scene.phase === 'active' && guard++ < 6000) scene = scene.step(climbUp, 100)
    expect(scene.phase).toBe('won')
  })

  it('clearing it sets the storm-front flag and drops candies', () => {
    const after = applyQuestWin(createDefaultSave(), STORM_FRONT)
    expect(after.flags[STORM_FRONT_CLEARED_FLAG]).toBe(true)
    expect(after.candies.current).toBe(createDefaultSave().candies.current + 800)
  })

  it('death respawns the player at the last safe zone (farmable, lose nothing)', () => {
    let scene = startStorm()
    scene = scene.step(climbUp, 100) // bank the bridge-head safe zone
    scene = scene.step({ ...climbUp, playerDamage: 999, deathSource: 'thunderheadDjinn' }, 100)
    expect(scene.phase).toBe('active') // respawn, not game over
    expect(scene.lastDeath?.message).toBe('death.thunderheadDjinn')
  })

  it('declares a generic death-message fallback', () => {
    expect(STORM_FRONT.deathMessages.some((m) => m.source === 'generic')).toBe(true)
  })
})

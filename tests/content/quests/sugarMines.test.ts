import { createDefaultSave } from '@/engine/state/defaultSave'
import { Scene, type SceneStepInput } from '@/engine/quest/Scene'
import { HorizontalDriver } from '@/engine/quest/physics/HorizontalDriver'
import { createEntityFactory } from '@/engine/content/entityFactory'
import { applyQuestWin } from '@/engine/quest/questRewards'
import { TEMPLATE_MAP } from '@/content/quests/entityTemplates'
import { SUGAR_MINES } from '@/content/quests/sugarMines'

const factory = createEntityFactory(TEMPLATE_MAP)
const stepRight: SceneStepInput = { playerInput: { moveX: 1, moveY: 0, jump: false } }

function driveToWin(maxSteps = 2000): Scene {
  let scene = Scene.start({
    def: SUGAR_MINES,
    driver: new HorizontalDriver({ moveSpeed: 8 }),
    entityFactory: factory,
  })
  let guard = 0
  while (scene.phase === 'active' && guard++ < maxSteps) {
    scene = scene.step(stepRight, 100)
  }
  return scene
}

describe('the sugar mines (Quest 1) as a horizontal Scene quest', () => {
  it('starts active with the player at the entrance and a rock-candy vein present', () => {
    const scene = Scene.start({
      def: SUGAR_MINES,
      driver: new HorizontalDriver(),
      entityFactory: factory,
    })
    expect(scene.phase).toBe('active')
    expect(scene.player?.hp).toBe(SUGAR_MINES.playerMaxHp)
    expect(scene.entities.some((e) => e.hasTag('rockCandyVein'))).toBe(true)
  })

  it('spawns waves (candy bats, sugar golems, the fossil) as the descent scrolls', () => {
    let scene = Scene.start({
      def: SUGAR_MINES,
      driver: new HorizontalDriver({ moveSpeed: 8 }),
      entityFactory: factory,
    })
    let sawBat = false
    let sawFossil = false
    let guard = 0
    while (scene.phase === 'active' && guard++ < 2000) {
      scene = scene.step(stepRight, 100)
      if (scene.entities.some((e) => e.hasTag('candyBat'))) sawBat = true
      if (scene.entities.some((e) => e.hasTag('fossil'))) sawFossil = true
    }
    expect(sawBat).toBe(true)
    expect(sawFossil).toBe(true)
  })

  it('completes by reaching the win scroll', () => {
    expect(driveToWin().phase).toBe('won')
  })

  it('awards rock candy + unlocks rock candy as a resource on win (applyQuestWin)', () => {
    const won = driveToWin()
    expect(won.phase).toBe('won')
    const after = applyQuestWin(createDefaultSave(), SUGAR_MINES)
    expect(after.rockCandy.current).toBe(10)
    expect(after.flags['rockCandyUnlocked']).toBe(true)
    // The mines no longer reveal the observatory — that is the mountain climb's job.
    expect(after.flags['observatoryUnlocked']).toBeUndefined()
  })

  it('respawns the player at a safe ledge on a lethal hit (loses nothing)', () => {
    let scene = Scene.start({
      def: SUGAR_MINES,
      driver: new HorizontalDriver({ moveSpeed: 8 }),
      entityFactory: factory,
    })
    scene = scene.step(stepRight, 100) // bank the entrance safe zone
    scene = scene.step({ ...stepRight, playerDamage: 99, deathSource: 'candyBat' }, 100)
    expect(scene.phase).toBe('active') // respawn, not game over
    expect(scene.player?.hp).toBe(SUGAR_MINES.playerMaxHp)
    expect(scene.lastDeath?.source).toBe('candyBat')
    expect(scene.lastDeath?.message).toBe('death.candyBat')
  })

  it('declares a generic death-message fallback', () => {
    expect(SUGAR_MINES.deathMessages.some((m) => m.source === 'generic')).toBe(true)
  })
})

import { createDefaultSave } from '@/engine/state/defaultSave'
import { Scene, type SceneStepInput } from '@/engine/quest/Scene'
import { VerticalDriver } from '@/engine/quest/physics/VerticalDriver'
import { createEntityFactory } from '@/engine/content/entityFactory'
import { applyQuestWin } from '@/engine/quest/questRewards'
import { spellAbilities } from '@/engine/content/spells'
import { GRIMOIRE_SPELLS } from '@/content/spells/grimoire'
import { TEMPLATE_MAP } from '@/content/quests/entityTemplates'
import { BEANSTALK_CLIMB } from '@/content/quests/beanstalkClimb'
import { BEANSTALK_ELEVATOR_FLAG, elevatorUnlocked } from '@/engine/content/beanstalkElevator'
import type { GameState } from '@/engine/types/GameState'

const factory = createEntityFactory(TEMPLATE_MAP)
const climbUp: SceneStepInput = { playerInput: { moveX: 0, moveY: 1, jump: false } }

/** A fast climb driver: climb speed easily beats gravity so the player ascends. */
function climbDriver(): VerticalDriver {
  return new VerticalDriver({ gravityY: 6, climbSpeed: 30, gustPeriodMs: 0, gustStrength: 0 })
}

function startClimb(driver = climbDriver(), abilities: readonly { id: string; cooldownMs: number }[] = []): Scene {
  return Scene.start({
    def: BEANSTALK_CLIMB,
    driver,
    entityFactory: factory,
    playerAbilities: abilities,
  })
}

function driveToWin(driver = climbDriver(), maxSteps = 4000): Scene {
  let scene = startClimb(driver)
  let guard = 0
  while (scene.phase === 'active' && guard++ < maxSteps) {
    scene = scene.step(climbUp, 100)
  }
  return scene
}

describe('the beanstalk climb (Quest 2) — the first VerticalDriver Scene quest', () => {
  it('is authored as a vertical quest', () => {
    expect(BEANSTALK_CLIMB.mode).toBe('vertical')
  })

  it('starts active with the player at the garden floor and gummy aphids on the stalk', () => {
    const scene = startClimb()
    expect(scene.phase).toBe('active')
    expect(scene.player?.hp).toBe(BEANSTALK_CLIMB.playerMaxHp)
    expect(scene.entities.some((e) => e.hasTag('gummyAphid'))).toBe(true)
  })

  it('climbs upward (the player ascends and the vertical scroll grows)', () => {
    let scene = startClimb()
    const startY = scene.player!.pos.y
    for (let i = 0; i < 20; i++) scene = scene.step(climbUp, 100)
    expect(scene.player!.pos.y).toBeLessThan(startY) // climbed up (screen-y decreased)
    expect(scene.scroll).toBeGreaterThan(0)
  })

  it('spawns cloud rats higher up as the climb scrolls', () => {
    let scene = startClimb()
    let sawCloudRat = false
    let guard = 0
    while (scene.phase === 'active' && guard++ < 4000) {
      scene = scene.step(climbUp, 100)
      if (scene.entities.some((e) => e.hasTag('cloudRat'))) sawCloudRat = true
    }
    expect(sawCloudRat).toBe(true)
  })

  it('completes via the VerticalDriver by reaching the top scroll', () => {
    expect(driveToWin().phase).toBe('won')
  })

  it('reaching the top permanently sets the beanstalk-elevator fast-travel flag', () => {
    const won = driveToWin()
    expect(won.phase).toBe('won')
    const after = applyQuestWin(createDefaultSave(), BEANSTALK_CLIMB)
    expect(after.flags[BEANSTALK_ELEVATOR_FLAG]).toBe(true)
    expect(elevatorUnlocked(after)).toBe(true)
  })

  it('death respawns the player at the last safe zone (lose nothing)', () => {
    let scene = startClimb()
    scene = scene.step(climbUp, 100) // bank the garden-floor safe zone
    scene = scene.step({ ...climbUp, playerDamage: 99, deathSource: 'gummyAphid' }, 100)
    expect(scene.phase).toBe('active') // respawn, not game over
    expect(scene.player?.hp).toBe(BEANSTALK_CLIMB.playerMaxHp)
    expect(scene.lastDeath?.source).toBe('gummyAphid')
    expect(scene.lastDeath?.message).toBe('death.gummyAphid')
  })

  it('runs the grimoire spell loadout when owned (reuses the spell-ability bridge)', () => {
    const grimoire: GameState = { ...createDefaultSave(), flags: { beginnerGrimoireOwned: true } }
    const abilities = spellAbilities(GRIMOIRE_SPELLS, grimoire)
    expect(abilities.length).toBeGreaterThan(0)
    const scene = startClimb(climbDriver(), abilities)
    expect(scene.player?.abilities.length).toBe(abilities.length)
  })

  it('declares a generic death-message fallback', () => {
    expect(BEANSTALK_CLIMB.deathMessages.some((m) => m.source === 'generic')).toBe(true)
  })
})

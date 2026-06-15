import { createDefaultSave } from '@/engine/state/defaultSave'
import { Scene, type SceneStepInput } from '@/engine/quest/Scene'
import { HorizontalDriver } from '@/engine/quest/physics/HorizontalDriver'
import { nearestHostileDistance } from '@/engine/quest/combat'
import { createEntityFactory } from '@/engine/content/entityFactory'
import { applyQuestWin } from '@/engine/quest/questRewards'
import { TEMPLATE_MAP } from '@/content/quests/entityTemplates'
import { MOUNTAIN } from '@/content/quests/mountain'
import { playerQuestWeapons } from '@/content/items/playerLoadout'
import type { GameState } from '@/engine/types/GameState'

// The mountain — the climb to the observatory. Unlike the mines loot-run it is an armed fight
// (rock imps + a gummy bear), so a geared player can clear it; topping out sets `mountainClimbed`,
// which reveals the observatory on the overworld.

const factory = createEntityFactory(TEMPLATE_MAP)
const equip = (weaponId: string): GameState => {
  const s = createDefaultSave()
  return { ...s, equipped: { ...s.equipped, weapon: weaponId } }
}

function driveToWin(weaponId: string, playerMaxHp = 30, maxSteps = 4000): Scene {
  let scene = Scene.start({
    def: { ...MOUNTAIN, playerMaxHp },
    driver: new HorizontalDriver({ gravityY: 30, moveSpeed: 7, jumpVelocity: 14 }),
    entityFactory: factory,
    playerWeapons: playerQuestWeapons(equip(weaponId)),
  })
  let guard = 0
  while (scene.phase === 'active' && guard++ < maxSteps) {
    const player = scene.player
    const reach = player ? player.weapons.reduce((m, w) => Math.max(m, w.range), 0) : 0
    const dist = player ? nearestHostileDistance(player, scene.entities) : Infinity
    const moveX = dist <= reach ? 0 : 1
    scene = scene.step({ playerInput: { moveX, moveY: 0, jump: false } } as SceneStepInput, 100)
  }
  return scene
}

describe('the mountain quest (the climb to the observatory)', () => {
  it('starts active with the player at the trailhead and a rock imp ahead', () => {
    const scene = Scene.start({ def: MOUNTAIN, driver: new HorizontalDriver(), entityFactory: factory })
    expect(scene.phase).toBe('active')
    expect(scene.entities.some((e) => e.hasTag('rockImp'))).toBe(true)
  })

  it('is a real armed fight (its foes carry attack stats, unlike the mines loot-run)', () => {
    const scene = Scene.start({ def: MOUNTAIN, driver: new HorizontalDriver(), entityFactory: factory })
    const imp = scene.entities.find((e) => e.hasTag('rockImp'))!
    expect(imp.weapons.length).toBeGreaterThan(0)
  })

  it('a geared player tops out, and the win reveals the observatory (mountainClimbed)', () => {
    expect(driveToWin('ironSword').phase).toBe('won')
    const before = createDefaultSave()
    const after = applyQuestWin(before, MOUNTAIN)
    expect(after.flags['mountainClimbed']).toBe(true)
    expect(after.candies.current).toBe(before.candies.current + 300)
  })
})

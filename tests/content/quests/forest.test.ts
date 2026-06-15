import type { QuestDef } from '@/engine/types/defs'
import { Scene, type SceneStepInput } from '@/engine/quest/Scene'
import { HorizontalDriver } from '@/engine/quest/physics/HorizontalDriver'
import { createEntityFactory } from '@/engine/content/entityFactory'
import { nearestHostileDistance } from '@/engine/quest/combat'
import { TEMPLATE_MAP } from '@/content/quests/entityTemplates'
import { FOREST_QUEST, FOREST_GOAL } from '@/content/quests/forest'
import { GUMMY_BEAR_DEATH, GENERIC_DEATH } from '@/content/deathMessages'

const factory = createEntityFactory(TEMPLATE_MAP)

describe('the forest quest', () => {
  it('is a horizontal quest that reveals the village on victory and drops candy', () => {
    expect(FOREST_QUEST.mode).toBe('horizontal')
    expect(FOREST_QUEST.onWinFlags).toContain('forestCleared')
    expect(FOREST_QUEST.onWinDrops?.some((d) => d.resource === 'candies')).toBe(true)
    // The death-message table must carry the generic fallback (else the Scene yields '').
    expect(FOREST_QUEST.deathMessages.some((m) => m.source === 'generic')).toBe(true)
  })

  it('is winnable: marching east (fighting in reach) reaches the far edge', () => {
    const reach = 3
    let scene = Scene.start({
      def: FOREST_QUEST,
      driver: new HorizontalDriver({ moveSpeed: 7 }),
      entityFactory: factory,
      playerWeapons: [{ id: 'test', damage: 99, range: reach, cooldownMs: 100 }],
    })
    let guard = 0
    while (scene.phase === 'active' && guard++ < 1000) {
      const player = scene.player
      const dist = player ? nearestHostileDistance(player, scene.entities) : Infinity
      const moveX = dist <= reach ? 0 : 1
      scene = scene.step({ playerInput: { moveX, moveY: 0, jump: false } }, 100)
    }
    expect(scene.phase).toBe('won')
    expect(scene.scroll).toBeGreaterThanOrEqual(FOREST_GOAL)
  })

  it('combat damage kills an unarmed player, who respawns at the treeline (source attributed)', () => {
    // A minimal arena with an armed gummy bear right next to a fragile, weaponless player.
    const def: QuestDef = {
      ...FOREST_QUEST,
      playerMaxHp: 3,
      playerStart: { x: 1, y: 6 },
      staticSpawns: [{ entityId: 'gummyBear', x: 2, y: 6 }],
      waves: [],
      winCondition: { kind: 'reachScroll', atScroll: 999 }, // never auto-win
      safeZones: [{ x: 0, y: 0, width: 6, height: 8 }],
      deathMessages: [GUMMY_BEAR_DEATH, GENERIC_DEATH],
    }
    const idle: SceneStepInput = { playerInput: { moveX: 0, moveY: 0, jump: false } }
    let scene = Scene.start({ def, driver: new HorizontalDriver(), entityFactory: factory })
    let guard = 0
    while (scene.phase === 'active' && scene.lastDeath === null && guard++ < 60) {
      scene = scene.step(idle, 100)
    }
    expect(scene.lastDeath?.source).toBe('gummyBear')
    expect(scene.player?.hp).toBe(scene.player?.maxHp) // respawned at full hp, losing nothing
  })
})

import { createDefaultSave } from '@/engine/state/defaultSave'
import { Scene, type SceneStepInput } from '@/engine/quest/Scene'
import { HorizontalDriver } from '@/engine/quest/physics/HorizontalDriver'
import { createEntityFactory } from '@/engine/content/entityFactory'
import { applyQuestWin } from '@/engine/quest/questRewards'
import { TEMPLATE_MAP } from '@/content/quests/entityTemplates'
import { GUMMY_WORM_CELLAR } from '@/content/quests/gummyWormCellar'

const factory = createEntityFactory(TEMPLATE_MAP)
const stepRight: SceneStepInput = { playerInput: { moveX: 1, moveY: 0, jump: false } }

describe('the gummy-worm cellar mini-quest (CB2 rat-cellar homage)', () => {
  it('starts with three gummy worms and the player', () => {
    const scene = Scene.start({
      def: GUMMY_WORM_CELLAR,
      driver: new HorizontalDriver(),
      entityFactory: factory,
    })
    expect(scene.entities.filter((e) => e.hasTag('gummyWorm')).length).toBe(3)
  })

  it('completes by reaching the far end and grants its lollipop reward', () => {
    let scene = Scene.start({
      def: GUMMY_WORM_CELLAR,
      driver: new HorizontalDriver({ moveSpeed: 8 }),
      entityFactory: factory,
    })
    let guard = 0
    while (scene.phase === 'active' && guard++ < 1000) {
      scene = scene.step(stepRight, 100)
    }
    expect(scene.phase).toBe('won')
    const after = applyQuestWin(createDefaultSave(), GUMMY_WORM_CELLAR)
    expect(after.flags['gummyWormCellarCleared']).toBe(true)
    expect(after.lollipops.current).toBe(1)
  })
})

import { createQuestHost } from '@/engine/quest/questHost'
import { VerticalDriver } from '@/engine/quest/physics/VerticalDriver'
import { HorizontalDriver } from '@/engine/quest/physics/HorizontalDriver'
import { createEntityFactory } from '@/engine/content/entityFactory'
import { TEMPLATE_MAP } from '@/content/quests/entityTemplates'
import { GUMMY_WORM_CELLAR } from '@/content/quests/gummyWormCellar'
import { BEANSTALK_CLIMB } from '@/content/quests/beanstalkClimb'
import type { SceneStepInput } from '@/engine/quest/Scene'

const factory = createEntityFactory(TEMPLATE_MAP)
const climbUp: SceneStepInput = { playerInput: { moveX: 0, moveY: 1, jump: false } }
const idle: SceneStepInput = { playerInput: { moveX: 0, moveY: 0, jump: false } }

function climbDriver(gustPeriodMs = 0, gustStrength = 0): VerticalDriver {
  return new VerticalDriver({ gravityY: 6, climbSpeed: 30, gustPeriodMs, gustStrength })
}

describe('createQuestHost', () => {
  it('exposes the live scene starting active', () => {
    const host = createQuestHost({
      def: BEANSTALK_CLIMB,
      driver: climbDriver(),
      entityFactory: factory,
    })
    expect(host.scene().phase).toBe('active')
  })

  it('steps the scene: climbing ascends and grows the vertical scroll', () => {
    const host = createQuestHost({ def: BEANSTALK_CLIMB, driver: climbDriver(), entityFactory: factory })
    const startY = host.scene().player!.pos.y
    for (let i = 0; i < 20; i++) host.step(climbUp, 100)
    expect(host.scene().player!.pos.y).toBeLessThan(startY)
    expect(host.scene().scroll).toBeGreaterThan(0)
  })

  it('applies a gust each step: a periodic downward shove the bare Scene loop never calls', () => {
    // A gust every 100ms shoving 5 cells down; idle player so only the gust + gravity move it.
    const host = createQuestHost({
      def: BEANSTALK_CLIMB,
      driver: climbDriver(100, 5),
      entityFactory: factory,
    })
    // The player is grounded at the floor; a gust would shove past the floor and the driver
    // re-clamps. Verify the gust fired (the host reports it) rather than the clamped position.
    const result = host.step(idle, 100)
    expect(result.gusted).toBe(true)
  })

  it('reports a win once the climb reaches the top scroll', () => {
    const host = createQuestHost({ def: BEANSTALK_CLIMB, driver: climbDriver(), entityFactory: factory })
    let guard = 0
    while (host.scene().phase === 'active' && guard++ < 4000) host.step(climbUp, 100)
    expect(host.scene().phase).toBe('won')
  })

  it('does not gust when the driver has no gust configured', () => {
    const host = createQuestHost({ def: BEANSTALK_CLIMB, driver: climbDriver(0, 0), entityFactory: factory })
    expect(host.step(climbUp, 100).gusted).toBe(false)
  })

  it('never gusts a horizontal quest (only the VerticalDriver gusts)', () => {
    const host = createQuestHost({
      def: GUMMY_WORM_CELLAR,
      driver: new HorizontalDriver({ moveSpeed: 8 }),
      entityFactory: factory,
    })
    const result = host.step({ playerInput: { moveX: 1, moveY: 0, jump: false } }, 100)
    expect(result.gusted).toBe(false)
    expect(result.scene.phase).toBe('active')
  })
})

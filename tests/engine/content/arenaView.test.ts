import { Scene } from '@/engine/quest/Scene'
import { HorizontalDriver } from '@/engine/quest/physics/HorizontalDriver'
import { VerticalDriver } from '@/engine/quest/physics/VerticalDriver'
import { createEntityFactory } from '@/engine/content/entityFactory'
import { toArenaModel } from '@/engine/content/arenaView'
import { TEMPLATE_MAP } from '@/content/quests/entityTemplates'
import { GUMMY_WORM_CELLAR } from '@/content/quests/gummyWormCellar'
import { BEANSTALK_CLIMB } from '@/content/quests/beanstalkClimb'

const factory = createEntityFactory(TEMPLATE_MAP)

function scene(): Scene {
  return Scene.start({ def: GUMMY_WORM_CELLAR, driver: new HorizontalDriver(), entityFactory: factory })
}

describe('toArenaModel', () => {
  it('projects scene size into the model', () => {
    const model = toArenaModel(scene(), TEMPLATE_MAP)
    expect(model.width).toBe(GUMMY_WORM_CELLAR.width)
    expect(model.height).toBe(GUMMY_WORM_CELLAR.height)
  })

  it('draws the player with the @ glyph', () => {
    const model = toArenaModel(scene(), TEMPLATE_MAP)
    const player = model.entities.find((e) => e.glyph === '@')
    expect(player).toBeDefined()
    expect(player?.maxHp).toBe(GUMMY_WORM_CELLAR.playerMaxHp)
  })

  it('maps enemy glyphs/colours from the template registry', () => {
    const model = toArenaModel(scene(), TEMPLATE_MAP)
    const worms = model.entities.filter((e) => e.glyph === '~')
    expect(worms.length).toBe(3)
    expect(worms[0]?.color).toBe('#6c6')
  })

  it('uses "?" for an entity whose tag is not in the (here empty) template map', () => {
    // Build the scene with the full factory (so the worms exist as entities) but project with
    // an EMPTY template map → the player still resolves to '@', the worms fall back to '?'.
    const model = toArenaModel(scene(), new Map())
    expect(model.entities.some((e) => e.glyph === '@')).toBe(true)
    expect(model.entities.filter((e) => e.glyph === '?').length).toBe(3) // the three worms
  })

  it('passes through an exit affordance', () => {
    const model = toArenaModel(scene(), TEMPLATE_MAP, {
      exit: { x: 0, y: 0, label: '[exit]', action: 'leave' },
    })
    expect(model.exit?.action).toBe('leave')
  })

  it('rounds the player position so a fractional climb y still renders (regression)', () => {
    // The VerticalDriver integrates the player position fractionally; a non-integer row index
    // is silently dropped by CellBuffer.drawString, which made the climber '@' invisible for the
    // whole climb. The model must hand the renderer integer cells.
    let s = Scene.start({
      def: BEANSTALK_CLIMB,
      driver: new VerticalDriver({ gravityY: 0.6, climbSpeed: 9 }),
      entityFactory: factory,
    })
    s = s.step({ playerInput: { moveX: 0, moveY: 1, jump: false } }, 100)
    const fractional = s.player?.pos.y
    expect(fractional !== undefined && !Number.isInteger(fractional)).toBe(true) // precondition
    const model = toArenaModel(s, TEMPLATE_MAP)
    const player = model.entities.find((e) => e.glyph === '@')
    expect(player).toBeDefined()
    expect(Number.isInteger(player?.x)).toBe(true)
    expect(Number.isInteger(player?.y)).toBe(true)
  })
})

import { createEntityFactory } from '@/engine/content/entityFactory'
import { TEMPLATE_MAP } from '@/content/quests/entityTemplates'

const factory = createEntityFactory(TEMPLATE_MAP)

describe('createEntityFactory', () => {
  it('builds an entity from a template + spawn order', () => {
    const bat = factory({ entityId: 'candyBat', x: 5, y: 3 })
    expect(bat.team).toBe('enemy')
    expect(bat.hp).toBe(2)
    expect(bat.maxHp).toBe(2)
    expect(bat.pos.x).toBe(5)
    expect(bat.pos.y).toBe(3)
    expect(bat.hasTag('candyBat')).toBe(true)
  })

  it('encodes the spawn position into a stable id', () => {
    expect(factory({ entityId: 'gummyWorm', x: 2, y: 4 }).id).toBe('gummyWorm@2,4')
  })

  it('builds a neutral rock-candy vein', () => {
    const vein = factory({ entityId: 'rockCandyVein', x: 1, y: 1 })
    expect(vein.team).toBe('neutral')
    expect(vein.hasTag('drop:rockCandy')).toBe(true)
  })

  it('throws for an unknown entity id', () => {
    expect(() => factory({ entityId: 'dragon', x: 0, y: 0 })).toThrow(/no template/)
  })
})

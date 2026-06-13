import { Vec2 } from '@/engine/quest/Vec2'
import { Entity } from '@/engine/quest/Entity'

function makeEntity(overrides: Partial<ConstructorParameters<typeof Entity>[0]> = {}): Entity {
  return new Entity({
    id: 'e1',
    team: 'enemy',
    pos: new Vec2(2, 2),
    width: 2,
    height: 2,
    hp: 10,
    maxHp: 10,
    ...overrides,
  })
}

describe('Entity', () => {
  it('defaults velocity/weapons/abilities/tags', () => {
    const e = makeEntity()
    expect(e.velocity.equals(Vec2.ZERO)).toBe(true)
    expect(e.weapons).toEqual([])
    expect(e.abilities).toEqual([])
    expect(e.tags).toEqual([])
  })

  it('derives a collision box at the current position', () => {
    const box = makeEntity().cbc
    expect(box.left).toBe(2)
    expect(box.right).toBe(4)
    expect(box.bottom).toBe(4)
  })

  it('withPos / withVelocity return new entities, never mutate', () => {
    const e = makeEntity()
    const moved = e.withPos(new Vec2(9, 9))
    expect(moved.pos.equals(new Vec2(9, 9))).toBe(true)
    expect(e.pos.equals(new Vec2(2, 2))).toBe(true)
    expect(moved).not.toBe(e)

    const fast = e.withVelocity(new Vec2(1, -1))
    expect(fast.velocity.equals(new Vec2(1, -1))).toBe(true)
    expect(e.velocity.equals(Vec2.ZERO)).toBe(true)
  })

  it('clamps hp into [0, maxHp] and reports death', () => {
    const e = makeEntity({ hp: 5 })
    expect(e.withHp(99).hp).toBe(10)
    expect(e.withHp(-3).hp).toBe(0)
    expect(e.withHp(0).isDead).toBe(true)
    expect(e.isDead).toBe(false)
  })

  it('damaged subtracts and clamps at zero; non-positive damage is a no-op', () => {
    const e = makeEntity({ hp: 4 })
    expect(e.damaged(3).hp).toBe(1)
    expect(e.damaged(10).hp).toBe(0)
    expect(e.damaged(0)).toBe(e) // same reference
    expect(e.damaged(-1)).toBe(e)
  })

  it('hasTag checks membership', () => {
    const e = makeEntity({ tags: ['flying', 'aphid'] })
    expect(e.hasTag('aphid')).toBe(true)
    expect(e.hasTag('boss')).toBe(false)
  })

  it('update integrates velocity into position by dt without mutating', () => {
    const e = makeEntity({ pos: new Vec2(0, 0), velocity: new Vec2(10, 0) })
    const after = e.update(null, { moveX: 0, moveY: 0, jump: false }, 100) // 0.1s
    expect(after.pos.equals(new Vec2(1, 0))).toBe(true) // 10 * 0.1
    expect(e.pos.equals(new Vec2(0, 0))).toBe(true)
    expect(after).not.toBe(e)
  })

  it('update defaults to no input', () => {
    const e = makeEntity({ pos: new Vec2(0, 0), velocity: new Vec2(0, 5) })
    const after = e.update(null, undefined, 200) // 0.2s
    expect(after.pos.equals(new Vec2(0, 1))).toBe(true)
  })
})

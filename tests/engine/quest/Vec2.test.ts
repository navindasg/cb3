import { Vec2 } from '@/engine/quest/Vec2'

describe('Vec2', () => {
  it('constructs and exposes components', () => {
    const v = new Vec2(3, -4)
    expect(v.x).toBe(3)
    expect(v.y).toBe(-4)
    expect(Vec2.of(1, 2).equals(new Vec2(1, 2))).toBe(true)
  })

  it('exposes a shared ZERO without aliasing into results', () => {
    const moved = Vec2.ZERO.add(new Vec2(2, 3))
    expect(Vec2.ZERO.x).toBe(0)
    expect(Vec2.ZERO.y).toBe(0)
    expect(moved).not.toBe(Vec2.ZERO)
  })

  it('add/sub/scale return NEW vectors and never mutate the receiver', () => {
    const a = new Vec2(1, 2)
    const b = new Vec2(10, 20)
    const sum = a.add(b)
    expect(sum.equals(new Vec2(11, 22))).toBe(true)
    expect(a.equals(new Vec2(1, 2))).toBe(true) // unchanged
    expect(sum).not.toBe(a)

    expect(a.sub(b).equals(new Vec2(-9, -18))).toBe(true)
    expect(a.scale(3).equals(new Vec2(3, 6))).toBe(true)
    expect(a.equals(new Vec2(1, 2))).toBe(true)
  })

  it('withX/withY replace one axis only, returning new vectors', () => {
    const v = new Vec2(5, 6)
    expect(v.withX(9).equals(new Vec2(9, 6))).toBe(true)
    expect(v.withY(9).equals(new Vec2(5, 9))).toBe(true)
    expect(v.equals(new Vec2(5, 6))).toBe(true)
  })

  it('computes Euclidean length', () => {
    expect(new Vec2(3, 4).length()).toBe(5)
    expect(Vec2.ZERO.length()).toBe(0)
  })

  it('equals distinguishes differing components', () => {
    expect(new Vec2(1, 2).equals(new Vec2(1, 3))).toBe(false)
    expect(new Vec2(1, 2).equals(new Vec2(2, 2))).toBe(false)
  })
})

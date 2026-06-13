import { Vec2 } from '@/engine/quest/Vec2'
import { CollisionBox, CollisionBoxCollection } from '@/engine/quest/collision'

describe('CollisionBox AABB', () => {
  it('exposes edges from position + size', () => {
    const box = CollisionBox.of(2, 3, 4, 5)
    expect(box.left).toBe(2)
    expect(box.right).toBe(6)
    expect(box.top).toBe(3)
    expect(box.bottom).toBe(8)
  })

  it('detects overlap and non-overlap', () => {
    const a = CollisionBox.of(0, 0, 4, 4)
    expect(a.overlaps(CollisionBox.of(2, 2, 4, 4))).toBe(true) // corner overlap
    expect(a.overlaps(CollisionBox.of(5, 0, 2, 2))).toBe(false) // to the right, no touch
    expect(a.overlaps(CollisionBox.of(0, 5, 2, 2))).toBe(false) // below, no touch
  })

  it('treats touching edges as NOT overlapping', () => {
    const a = CollisionBox.of(0, 0, 4, 4)
    expect(a.overlaps(CollisionBox.of(4, 0, 4, 4))).toBe(false) // right edge touches left edge
    expect(a.overlaps(CollisionBox.of(0, 4, 4, 4))).toBe(false)
  })

  it('contains a point (left/top inclusive, right/bottom exclusive)', () => {
    const a = CollisionBox.of(0, 0, 4, 4)
    expect(a.contains(0, 0)).toBe(true)
    expect(a.contains(3, 3)).toBe(true)
    expect(a.contains(4, 4)).toBe(false) // exclusive
    expect(a.contains(-1, 0)).toBe(false)
  })

  it('movedTo returns a new box at a new origin, same size', () => {
    const a = CollisionBox.of(0, 0, 4, 4)
    const moved = a.movedTo(new Vec2(10, 10))
    expect(moved.left).toBe(10)
    expect(moved.width).toBe(4)
    expect(a.left).toBe(0) // unchanged
    expect(moved).not.toBe(a)
  })
})

describe('CollisionBoxCollection', () => {
  it('set/remove return new collections (immutable)', () => {
    const empty = CollisionBoxCollection.empty()
    const one = empty.set('a', CollisionBox.of(0, 0, 2, 2))
    expect(empty.size).toBe(0)
    expect(one.size).toBe(1)
    expect(one).not.toBe(empty)

    const back = one.remove('a')
    expect(back.size).toBe(0)
    expect(one.size).toBe(1) // unchanged
    expect(one.remove('missing')).toBe(one) // same ref when nothing removed
  })

  it('finds the ids overlapping a query, excluding its own id', () => {
    const c = CollisionBoxCollection.from([
      ['a', CollisionBox.of(0, 0, 4, 4)],
      ['b', CollisionBox.of(2, 2, 4, 4)],
      ['c', CollisionBox.of(20, 20, 2, 2)],
    ])
    expect([...c.overlapping(CollisionBox.of(1, 1, 2, 2))].sort()).toEqual(['a', 'b'])
    expect(c.overlapping(c.get('a') as CollisionBox, 'a')).toEqual(['b'])
  })

  it('brute-force colliding pairs (sorted, each once)', () => {
    const c = CollisionBoxCollection.from([
      ['a', CollisionBox.of(0, 0, 4, 4)],
      ['b', CollisionBox.of(2, 2, 4, 4)],
      ['c', CollisionBox.of(100, 100, 2, 2)],
    ])
    expect(c.collidingPairs()).toEqual([['a', 'b']])
  })

  it('spatial-grid bucketing returns the same pairs as brute force', () => {
    const entries: [string, CollisionBox][] = [
      ['a', CollisionBox.of(0, 0, 4, 4)],
      ['b', CollisionBox.of(2, 2, 4, 4)], // overlaps a
      ['c', CollisionBox.of(50, 50, 3, 3)],
      ['d', CollisionBox.of(51, 51, 3, 3)], // overlaps c (different bucket from a/b)
      ['e', CollisionBox.of(200, 200, 2, 2)], // isolated
    ]
    const brute = CollisionBoxCollection.from(entries, false).collidingPairs()
    const grid = CollisionBoxCollection.from(entries, true).collidingPairs()
    const norm = (ps: readonly (readonly [string, string])[]) =>
      [...ps].map((p) => p.join('|')).sort()
    expect(norm(grid)).toEqual(norm(brute))
    expect(norm(grid)).toEqual(['a|b', 'c|d'])
  })

  it('grid de-dupes a pair that straddles a bucket boundary', () => {
    // Two boxes spanning the x=10 grid line both land in buckets 0 and 1 → would be paired
    // twice without de-duplication.
    const entries: [string, CollisionBox][] = [
      ['a', CollisionBox.of(8, 0, 6, 2)], // covers buckets x=0 and x=1
      ['b', CollisionBox.of(9, 0, 6, 2)], // overlaps a, also covers buckets 0 and 1
    ]
    const grid = CollisionBoxCollection.from(entries, true).collidingPairs()
    expect(grid).toEqual([['a', 'b']]) // exactly once
  })
})

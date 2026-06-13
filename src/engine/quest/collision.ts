import { Vec2 } from '@/engine/quest/Vec2'

// Axis-aligned bounding boxes and their collections (ADR §6.2 L0). Brute-force AABB is
// O(n²) but fine for the side-scroller and climb (<50 entities); for dense scenes (the
// Phase-3 drift asteroid field) a 10×10 spatial-grid bucketing pass can be toggled on so
// only co-located boxes are pair-tested. Pure, immutable, plain numbers — no DOM.

/** A rectangle by its top-left corner and size, in scene-local cells. */
export class CollisionBox {
  readonly pos: Vec2
  readonly width: number
  readonly height: number

  constructor(pos: Vec2, width: number, height: number) {
    this.pos = pos
    this.width = width
    this.height = height
  }

  static of(x: number, y: number, width: number, height: number): CollisionBox {
    return new CollisionBox(new Vec2(x, y), width, height)
  }

  get left(): number {
    return this.pos.x
  }
  get right(): number {
    return this.pos.x + this.width
  }
  get top(): number {
    return this.pos.y
  }
  get bottom(): number {
    return this.pos.y + this.height
  }

  /** A copy translated to a new top-left. Returns a new box. */
  movedTo(pos: Vec2): CollisionBox {
    return new CollisionBox(pos, this.width, this.height)
  }

  /** True when this box overlaps `other` (touching edges do NOT count as overlap). */
  overlaps(other: CollisionBox): boolean {
    return (
      this.left < other.right &&
      this.right > other.left &&
      this.top < other.bottom &&
      this.bottom > other.top
    )
  }

  /** True when the point (px, py) is inside this box (left/top inclusive, right/bottom exclusive). */
  contains(px: number, py: number): boolean {
    return px >= this.left && px < this.right && py >= this.top && py < this.bottom
  }
}

/** An ordered, immutable collection of boxes (keyed by an external id) for pair queries. */
export class CollisionBoxCollection {
  /** Whether to bucket boxes into a coarse grid before pair-testing (dense scenes). */
  readonly useSpatialGrid: boolean
  private readonly boxes: ReadonlyMap<string, CollisionBox>

  private constructor(boxes: ReadonlyMap<string, CollisionBox>, useSpatialGrid: boolean) {
    this.boxes = boxes
    this.useSpatialGrid = useSpatialGrid
  }

  static empty(useSpatialGrid = false): CollisionBoxCollection {
    return new CollisionBoxCollection(new Map(), useSpatialGrid)
  }

  static from(
    entries: Iterable<readonly [string, CollisionBox]>,
    useSpatialGrid = false,
  ): CollisionBoxCollection {
    return new CollisionBoxCollection(new Map(entries), useSpatialGrid)
  }

  get size(): number {
    return this.boxes.size
  }

  /** A copy with `box` set for `id`. Returns a new collection. */
  set(id: string, box: CollisionBox): CollisionBoxCollection {
    const next = new Map(this.boxes)
    next.set(id, box)
    return new CollisionBoxCollection(next, this.useSpatialGrid)
  }

  /** A copy with `id` removed. Returns a new collection (the same one if absent). */
  remove(id: string): CollisionBoxCollection {
    if (!this.boxes.has(id)) return this
    const next = new Map(this.boxes)
    next.delete(id)
    return new CollisionBoxCollection(next, this.useSpatialGrid)
  }

  get(id: string): CollisionBox | undefined {
    return this.boxes.get(id)
  }

  /** The ids whose boxes overlap `query` (excludes `query`'s own id when given). */
  overlapping(query: CollisionBox, excludeId?: string): readonly string[] {
    const hits: string[] = []
    for (const [id, box] of this.boxes) {
      if (id === excludeId) continue
      if (query.overlaps(box)) hits.push(id)
    }
    return hits
  }

  /**
   * All colliding id-pairs in the collection. With `useSpatialGrid`, boxes are bucketed
   * into GRID×GRID cells so only co-located boxes are pair-tested; otherwise brute O(n²).
   * The two strategies return the same set of pairs (each pair once, ids sorted).
   */
  collidingPairs(): readonly (readonly [string, string])[] {
    return this.useSpatialGrid ? this.griddedPairs() : this.bruteForcePairs()
  }

  private bruteForcePairs(): readonly (readonly [string, string])[] {
    const ids = [...this.boxes.keys()]
    const pairs: [string, string][] = []
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i] as string
        const b = ids[j] as string
        if ((this.boxes.get(a) as CollisionBox).overlaps(this.boxes.get(b) as CollisionBox)) {
          pairs.push(orderedPair(a, b))
        }
      }
    }
    return pairs
  }

  private griddedPairs(): readonly (readonly [string, string])[] {
    const buckets = new Map<string, string[]>()
    for (const [id, box] of this.boxes) {
      for (const key of bucketKeys(box)) {
        const list = buckets.get(key)
        if (list) list.push(id)
        else buckets.set(key, [id])
      }
    }
    const seen = new Set<string>()
    const pairs: [string, string][] = []
    for (const ids of buckets.values()) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const [a, b] = orderedPair(ids[i] as string, ids[j] as string)
          const pairKey = `${a}|${b}`
          if (seen.has(pairKey)) continue
          if ((this.boxes.get(a) as CollisionBox).overlaps(this.boxes.get(b) as CollisionBox)) {
            seen.add(pairKey)
            pairs.push([a, b])
          }
        }
      }
    }
    return pairs
  }
}

/** Coarse grid cell size in scene cells; a box maps to every bucket its extent touches. */
const GRID = 10

function bucketKeys(box: CollisionBox): readonly string[] {
  const x0 = Math.floor(box.left / GRID)
  const x1 = Math.floor((box.right - Number.EPSILON) / GRID)
  const y0 = Math.floor(box.top / GRID)
  const y1 = Math.floor((box.bottom - Number.EPSILON) / GRID)
  const keys: string[] = []
  for (let gx = x0; gx <= x1; gx++) {
    for (let gy = y0; gy <= y1; gy++) {
      keys.push(`${gx},${gy}`)
    }
  }
  return keys
}

/** A 2-tuple with the ids sorted, so each pair has one canonical representation. */
function orderedPair(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a]
}

// An immutable 2D vector — the spatial primitive every quest entity is positioned by.
// EVERY operation returns a NEW Vec2; the receiver is never mutated, so entities can share
// no aliased position (ADR §6.1 immutability). Pure: no DOM, plain numbers, fully testable.

export class Vec2 {
  readonly x: number
  readonly y: number

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }

  static readonly ZERO = new Vec2(0, 0)

  static of(x: number, y: number): Vec2 {
    return new Vec2(x, y)
  }

  /** A new vector translated by (dx, dy). */
  add(other: Vec2): Vec2 {
    return new Vec2(this.x + other.x, this.y + other.y)
  }

  /** A new vector = this − other. */
  sub(other: Vec2): Vec2 {
    return new Vec2(this.x - other.x, this.y - other.y)
  }

  /** A new vector with both components scaled by `k`. */
  scale(k: number): Vec2 {
    return new Vec2(this.x * k, this.y * k)
  }

  /** A new vector with x replaced (y unchanged). */
  withX(x: number): Vec2 {
    return new Vec2(x, this.y)
  }

  /** A new vector with y replaced (x unchanged). */
  withY(y: number): Vec2 {
    return new Vec2(this.x, y)
  }

  /** Euclidean length. */
  length(): number {
    return Math.hypot(this.x, this.y)
  }

  /**
   * True when both components are === equal. Coordinates are always finite (positions are
   * integers/finite floats), so === is exact: +0 and -0 compare equal (desirable here) and any
   * NaN coordinate — which should never occur — compares unequal (NaN !== NaN). Not Object.is.
   */
  equals(other: Vec2): boolean {
    return this.x === other.x && this.y === other.y
  }
}

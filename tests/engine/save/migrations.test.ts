import {
  migrateEnvelope,
  FutureVersionError,
  MigrationError,
  type RawEnvelope,
} from '@/engine/save/migrations'

const base = (v: number, state: Record<string, unknown> = {}): RawEnvelope => ({
  v,
  t: 0,
  lastTick: 0,
  state,
})

describe('migrateEnvelope', () => {
  it('passes a current-version save through unchanged', () => {
    const out = migrateEnvelope(base(1, { candies: 5 }), { currentVersion: 1 })
    expect(out.v).toBe(1)
    expect(out.state).toEqual({ candies: 5 })
  })

  it('refuses a save from a newer version', () => {
    expect(() => migrateEnvelope(base(2), { currentVersion: 1 })).toThrow(FutureVersionError)
  })

  it('applies the ladder sequentially', () => {
    const out = migrateEnvelope(base(0, { a: 1 }), {
      currentVersion: 2,
      ladder: {
        0: (s) => ({ ...s, b: 2 }),
        1: (s) => ({ ...s, c: 3 }),
      },
    })
    expect(out.v).toBe(2)
    expect(out.state).toEqual({ a: 1, b: 2, c: 3 })
  })

  it('throws when a rung is missing', () => {
    expect(() =>
      migrateEnvelope(base(0), { currentVersion: 2, ladder: { 0: (s) => s } }),
    ).toThrow(MigrationError)
  })

  it('rejects a non-integer version', () => {
    expect(() =>
      migrateEnvelope({ v: 1.5, t: 0, lastTick: 0, state: {} }, { currentVersion: 2 }),
    ).toThrow(MigrationError)
  })
})

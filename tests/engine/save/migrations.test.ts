import {
  migrateEnvelope,
  FutureVersionError,
  MigrationError,
  type RawEnvelope,
} from '@/engine/save/migrations'
import { CURRENT_SCHEMA_VERSION } from '@/engine/types/GameState'

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

describe('the real migration ladder (MIGRATIONS)', () => {
  it('climbs a v1 save all the way to the current schema version', () => {
    const out = migrateEnvelope(base(1, { candies: { current: 5 } }))
    expect(out.v).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('v1 → v2 seeds a zeroed cottonCandy resource (Act 1)', () => {
    const out = migrateEnvelope(base(1, { candies: { current: 5 } }))
    expect(out.state.cottonCandy).toEqual({ current: 0, lifetimeAccumulated: 0, historicalMax: 0 })
  })

  it('preserves a cottonCandy field a save already carries', () => {
    const carried = { current: 42, lifetimeAccumulated: 99, historicalMax: 99 }
    const out = migrateEnvelope(base(1, { cottonCandy: carried }))
    expect(out.state.cottonCandy).toEqual(carried)
  })

  it('v2 → v3 seeds a zeroed licorice resource (Act 1)', () => {
    const out = migrateEnvelope(base(2, { candies: { current: 5 } }))
    expect(out.v).toBe(CURRENT_SCHEMA_VERSION)
    expect(out.state.licorice).toEqual({ current: 0, lifetimeAccumulated: 0, historicalMax: 0 })
  })

  it('v3 → v4 seeds a zeroed popRocks resource (Act 2 — the comet)', () => {
    const out = migrateEnvelope(base(3, { candies: { current: 5 } }))
    expect(out.v).toBe(CURRENT_SCHEMA_VERSION)
    expect(out.state.popRocks).toEqual({ current: 0, lifetimeAccumulated: 0, historicalMax: 0 })
  })

  it('preserves a popRocks field a save already carries', () => {
    const carried = { current: 17, lifetimeAccumulated: 30, historicalMax: 30 }
    const out = migrateEnvelope(base(3, { popRocks: carried }))
    expect(out.state.popRocks).toEqual(carried)
  })

  it('climbs a v1 save through every rung (cottonCandy, licorice AND popRocks present)', () => {
    const out = migrateEnvelope(base(1, { candies: { current: 5 } }))
    expect(out.state.cottonCandy).toEqual({ current: 0, lifetimeAccumulated: 0, historicalMax: 0 })
    expect(out.state.licorice).toEqual({ current: 0, lifetimeAccumulated: 0, historicalMax: 0 })
    expect(out.state.popRocks).toEqual({ current: 0, lifetimeAccumulated: 0, historicalMax: 0 })
  })
})

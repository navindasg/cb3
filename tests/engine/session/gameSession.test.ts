import { createGameSession, OPENER_SEEN_FLAG } from '@/engine/session/gameSession'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { makeEnvelope, encodeSave } from '@/engine/save/envelope'
import { createSaveStore } from '@/engine/save/localStorage'
import { MAX_HP_KEY } from '@/engine/state/recomputeCaches'
import type { ProducerDef } from '@/engine/types/defs'
import { VILLAGE_UNLOCKED_FLAG, MINES_REVEALED_FLAG } from '@/engine/session/gameSession'

const oneCandyPerSec: ProducerDef[] = [{ id: 'base', resource: 'candies', getRate: () => 1 }]

// A tiny in-memory Storage stand-in (mirrors localStorage's String surface).
function memStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  }
}

// A controllable wall clock for catch-up deltas.
function fakeClock(start: number): { now: () => number; set: (t: number) => void } {
  let t = start
  return { now: () => t, set: (n) => (t = n) }
}

describe('createGameSession', () => {
  it('cold start: a new game holds exactly 1 candy', () => {
    const session = createGameSession({
      storage: memStorage(),
      producers: oneCandyPerSec,
      clock: fakeClock(0),
    })
    expect(session.getState().candies.current).toBe(1)
  })

  it('cold start recomputes derived caches before the first read', () => {
    const session = createGameSession({
      storage: memStorage(),
      producers: oneCandyPerSec,
      clock: fakeClock(0),
    })
    expect(session.getState().numbers[MAX_HP_KEY]).toBe(10)
  })

  it('warm start loads the autosaved slot and recomputes caches', () => {
    const storage = memStorage()
    const store = createSaveStore({ storage })
    const saved = { ...createDefaultSave(), candies: { current: 42, lifetimeAccumulated: 42, historicalMax: 42 } }
    store.autosave(makeEnvelope(saved, 1000))

    const session = createGameSession({ storage, producers: oneCandyPerSec, clock: fakeClock(1000) })
    expect(session.getState().candies.current).toBe(42)
    expect(session.getState().numbers[MAX_HP_KEY]).toBe(10)
  })

  it('warm start credits offline candies for the elapsed wall-clock gap', () => {
    const storage = memStorage()
    const store = createSaveStore({ storage })
    // saved at t=1000 with the rate-bearing flag on (grandma's spoon → 0.5/s) is overkill;
    // we use the injected 1 candy/s producer; the envelope lastTick is 1000.
    const saved = createDefaultSave()
    store.autosave(makeEnvelope(saved, 1000))

    // Return 10 seconds later (wall clock).
    const session = createGameSession({
      storage,
      producers: oneCandyPerSec,
      clock: fakeClock(11_000),
      offlineCapMs: 24 * 3_600_000,
    })
    // 1 start + 10s * 1/s = 11
    expect(session.getState().candies.current).toBe(11)
  })

  it('a clock rollback (negative gap) credits nothing', () => {
    const storage = memStorage()
    const store = createSaveStore({ storage })
    store.autosave(makeEnvelope(createDefaultSave(), 10_000))
    const session = createGameSession({
      storage,
      producers: oneCandyPerSec,
      clock: fakeClock(5_000), // earlier than lastTick
    })
    expect(session.getState().candies.current).toBe(1)
  })

  it('advance() runs the lifecycle pass: time + production', () => {
    const session = createGameSession({
      storage: memStorage(),
      producers: oneCandyPerSec,
      clock: fakeClock(0),
    })
    session.advance(1000)
    expect(session.getState().candies.current).toBe(2)
    expect(session.getState().accumulatedGameTimeMs).toBe(1000)
  })

  it('advance() surfaces lifecycle events to the onEvents callback', () => {
    const seen: string[] = []
    const armed = {
      ...createDefaultSave(),
      flags: { telescopeOwned: true },
      candies: { current: 0, lifetimeAccumulated: 50_000, historicalMax: 50_000 },
    }
    const storage = memStorage()
    createSaveStore({ storage }).autosave(makeEnvelope(armed, 0))
    const session = createGameSession({
      storage,
      producers: [],
      clock: fakeClock(0),
      onEvents: (e) => seen.push(...e),
    })
    session.advance(100)
    expect(seen).toContain('beanstalk.seedLands')
  })

  it('acknowledgeOpener unlocks the village (and marks the opener seen)', () => {
    const session = createGameSession({
      storage: memStorage(),
      producers: oneCandyPerSec,
      clock: fakeClock(0),
    })
    expect(session.getState().flags[VILLAGE_UNLOCKED_FLAG]).not.toBe(true)
    session.acknowledgeOpener()
    expect(session.getState().flags[OPENER_SEEN_FLAG]).toBe(true)
    expect(session.getState().flags[VILLAGE_UNLOCKED_FLAG]).toBe(true)
  })

  it('revealMines sets the mines-revealed flag', () => {
    const session = createGameSession({
      storage: memStorage(),
      producers: oneCandyPerSec,
      clock: fakeClock(0),
    })
    session.revealMines()
    expect(session.getState().flags[MINES_REVEALED_FLAG]).toBe(true)
  })

  it('dispatch applies a pure reducer and re-commits the state', () => {
    const session = createGameSession({
      storage: memStorage(),
      producers: oneCandyPerSec,
      clock: fakeClock(0),
    })
    session.dispatch((s) => ({ ...s, candies: { ...s.candies, current: s.candies.current + 5 } }))
    expect(session.getState().candies.current).toBe(6)
  })

  it('save() writes an autosave readable on the next session', () => {
    const storage = memStorage()
    const session = createGameSession({ storage, producers: oneCandyPerSec, clock: fakeClock(0) })
    session.dispatch((s) => ({ ...s, candies: { ...s.candies, current: 99, lifetimeAccumulated: 99, historicalMax: 99 } }))
    const result = session.save()
    expect(result.ok).toBe(true)

    const reopened = createGameSession({ storage, producers: oneCandyPerSec, clock: fakeClock(0) })
    expect(reopened.getState().candies.current).toBe(99)
  })

  it('reload loads the NEWEST autosave after rotation advances past slot 1', () => {
    // autosave() rotates writes across autosave1/2/3. After >=2 autosaves the rotation
    // pointer has moved past slot 1, so autosave1 is now the OLDEST slot. Reload must
    // surface the most-recent state, not the stale first slot.
    const storage = memStorage()
    const store = createSaveStore({ storage })
    const at = (n: number) => ({
      ...createDefaultSave(),
      candies: { current: n, lifetimeAccumulated: n, historicalMax: n },
    })
    store.autosave(makeEnvelope(at(1), 1_000)) // -> autosave1 (oldest)
    store.autosave(makeEnvelope(at(500), 2_000)) // -> autosave2 (newest)

    const reopened = createGameSession({ storage, producers: oneCandyPerSec, clock: fakeClock(2_000) })
    expect(reopened.getState().candies.current).toBe(500)
  })

  it('onVisible after multiple autosaves does not over-credit from a stale rotated slot', () => {
    // Drive enough autosaves that the rotation pointer has wrapped well past slot 1, so a
    // fixed autosave1 anchor would hold a much older lastTick and inflate the offline gap.
    const storage = memStorage()
    const clock = fakeClock(0)
    const session = createGameSession({ storage, producers: oneCandyPerSec, clock, offlineCapMs: 24 * 3_600_000 })

    // Saves rotate: autosave1@0, then autosave2@1_000. The fixed autosave1 slot keeps its
    // stale lastTick=0. onHidden then writes autosave3@3_000 and sets in-memory lastTick=3_000.
    session.save() // t=0 -> autosave1 (stays @0, now stale)
    clock.set(1_000)
    session.save() // t=1_000 -> autosave2
    clock.set(3_000)
    session.onHidden() // t=3_000 -> autosave3; in-memory lastTick=3_000

    clock.set(8_000) // 5 real seconds pass while hidden
    session.onVisible() // must credit exactly 5 (8_000 - 3_000); a stale autosave1 anchor (0) would credit 8
    expect(session.getState().candies.current).toBe(6) // 1 start + 5, NOT 9
  })

  it('onHidden saves and onVisible runs catch-up for the gap since hidden', () => {
    const storage = memStorage()
    const clock = fakeClock(0)
    const session = createGameSession({ storage, producers: oneCandyPerSec, clock, offlineCapMs: 24 * 3_600_000 })

    session.onHidden() // persists at t=0
    clock.set(5_000) // 5 real seconds pass while hidden
    session.onVisible() // credit 5 candies
    expect(session.getState().candies.current).toBe(6) // 1 + 5
  })

  it('onVisible tolerates an autosave slot that turned corrupt while hidden', () => {
    const storage = memStorage()
    const clock = fakeClock(0)
    const session = createGameSession({ storage, producers: oneCandyPerSec, clock, offlineCapMs: 24 * 3_600_000 })
    session.onHidden() // writes a valid autosave at t=0
    storage.setItem('cb3.slotautosave1', 'corrupt-after-the-fact!!!')
    clock.set(5_000)
    // must not throw; lastTick falls back so catch-up still credits the in-memory gap.
    expect(() => session.onVisible()).not.toThrow()
    expect(session.getState().candies.current).toBe(6)
  })

  it('a corrupted autosave falls back to a fresh new game (never crashes)', () => {
    const storage = memStorage()
    storage.setItem('cb3.slotautosave1', 'not-a-valid-save-string!!!')
    storage.setItem('cb3.autosavePtr', '1')
    const session = createGameSession({ storage, producers: oneCandyPerSec, clock: fakeClock(0) })
    expect(session.getState().candies.current).toBe(1)
  })

  it('importSaveString loads a pasted save and keeps the current save on a corrupt string', () => {
    const session = createGameSession({
      storage: memStorage(),
      producers: oneCandyPerSec,
      clock: fakeClock(0),
    })
    const good = encodeSave(
      makeEnvelope(
        { ...createDefaultSave(), candies: { current: 7, lifetimeAccumulated: 7, historicalMax: 7 } },
        0,
      ),
    )
    expect(session.importSaveString(good).ok).toBe(true)
    expect(session.getState().candies.current).toBe(7)

    const before = session.getState()
    const result = session.importSaveString('garbage!!!')
    expect(result.ok).toBe(false)
    expect(session.getState()).toBe(before) // unchanged
  })

  it('exportSaveString round-trips through importSaveString', () => {
    const session = createGameSession({
      storage: memStorage(),
      producers: oneCandyPerSec,
      clock: fakeClock(0),
    })
    session.dispatch((s) => ({ ...s, candies: { ...s.candies, current: 123, lifetimeAccumulated: 123, historicalMax: 123 } }))
    const exported = session.exportSaveString()

    const other = createGameSession({ storage: memStorage(), producers: oneCandyPerSec, clock: fakeClock(0) })
    expect(other.importSaveString(exported).ok).toBe(true)
    expect(other.getState().candies.current).toBe(123)
  })

  it('subscribe is notified on every commit and the disposer detaches it', () => {
    const session = createGameSession({
      storage: memStorage(),
      producers: oneCandyPerSec,
      clock: fakeClock(0),
    })
    let calls = 0
    const off = session.subscribe(() => (calls += 1))
    session.advance(100)
    expect(calls).toBe(1)
    off()
    session.advance(100)
    expect(calls).toBe(1)
  })
})

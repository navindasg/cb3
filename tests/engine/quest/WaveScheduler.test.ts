import type { WaveDef } from '@/engine/types/defs'
import { WaveScheduler } from '@/engine/quest/WaveScheduler'

const waves: WaveDef[] = [
  {
    id: 'w-dist',
    trigger: { kind: 'distance', atScroll: 10 },
    spawns: [{ entityId: 'bat', x: 5, y: 0 }],
  },
  {
    id: 'w-time',
    trigger: { kind: 'timer', atMs: 2000 },
    spawns: [{ entityId: 'golem', x: 8, y: 0 }],
  },
  {
    id: 'w-event',
    trigger: { kind: 'event', event: 'bossEnraged' },
    spawns: [{ entityId: 'add', x: 1, y: 1 }, { entityId: 'add', x: 2, y: 1 }],
  },
]

const ctx = (over: Partial<{ scroll: number; elapsedMs: number; events: string[] }> = {}) => ({
  scroll: 0,
  elapsedMs: 0,
  events: [] as string[],
  ...over,
})

describe('WaveScheduler', () => {
  it('fires a distance trigger when scroll crosses the threshold', () => {
    const s = WaveScheduler.create(waves)
    const below = s.evaluate(ctx({ scroll: 9 }))
    expect(below.spawns).toEqual([])
    expect(below.scheduler).toBe(s) // unchanged, same ref

    const at = s.evaluate(ctx({ scroll: 10 }))
    expect(at.firedIds).toEqual(['w-dist'])
    expect(at.spawns).toEqual([{ entityId: 'bat', x: 5, y: 0 }])
  })

  it('fires a timer trigger and an event trigger', () => {
    const s = WaveScheduler.create(waves)
    expect(s.evaluate(ctx({ elapsedMs: 2000 })).firedIds).toEqual(['w-time'])
    expect(s.evaluate(ctx({ events: ['bossEnraged'] })).firedIds).toEqual(['w-event'])
    expect(s.evaluate(ctx({ events: ['somethingElse'] })).spawns).toEqual([])
  })

  it('fires each wave at most once, even when the trigger stays satisfied', () => {
    let s = WaveScheduler.create(waves)
    const first = s.evaluate(ctx({ scroll: 50 }))
    expect(first.firedIds).toEqual(['w-dist'])
    s = first.scheduler
    // scroll is still past the threshold, but the wave already fired -> no re-spawn.
    const second = s.evaluate(ctx({ scroll: 50 }))
    expect(second.firedIds).toEqual([])
    expect(second.spawns).toEqual([])
  })

  it('emits multiple waves crossed in the same step, concatenating their spawns', () => {
    const s = WaveScheduler.create(waves)
    const r = s.evaluate(ctx({ scroll: 10, elapsedMs: 2000, events: ['bossEnraged'] }))
    expect(r.firedIds.slice().sort()).toEqual(['w-dist', 'w-event', 'w-time'])
    expect(r.spawns).toHaveLength(4) // 1 + 1 + 2
  })

  it('tracks allFired across steps for the clearWaves win condition', () => {
    let s = WaveScheduler.create(waves)
    expect(s.allFired).toBe(false)
    s = s.evaluate(ctx({ scroll: 10, elapsedMs: 2000 })).scheduler
    expect(s.allFired).toBe(false) // event wave not yet fired
    s = s.evaluate(ctx({ events: ['bossEnraged'] })).scheduler
    expect(s.allFired).toBe(true)
  })

  it('snapshots/restores progress via firedIds + withFired', () => {
    const s = WaveScheduler.create(waves).withFired(['w-dist'])
    expect([...s.firedIds]).toEqual(['w-dist'])
    // restored scheduler will not re-fire the snapshotted wave.
    expect(s.evaluate(ctx({ scroll: 999 })).firedIds).toEqual([])
  })

  it('an empty wave list is trivially allFired', () => {
    expect(WaveScheduler.create([]).allFired).toBe(true)
  })

  it('cleared requires at least one wave AND all fired (unlike allFired)', () => {
    // An empty list is allFired but NOT cleared — guards the clearWaves auto-win footgun.
    expect(WaveScheduler.create([]).cleared).toBe(false)

    let s = WaveScheduler.create(waves)
    expect(s.cleared).toBe(false) // has waves, none fired yet
    s = s.evaluate(ctx({ scroll: 10, elapsedMs: 2000 })).scheduler
    expect(s.cleared).toBe(false) // event wave still pending
    s = s.evaluate(ctx({ events: ['bossEnraged'] })).scheduler
    expect(s.cleared).toBe(true) // had waves and all fired
  })
})

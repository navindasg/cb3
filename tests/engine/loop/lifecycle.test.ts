import { runLifecyclePass } from '@/engine/loop/lifecycle'
import { createDefaultSave } from '@/engine/state/defaultSave'
import type { ProducerDef } from '@/engine/types/defs'
import { SEED_EVENT_FLAG, SEED_PRESENT_FLAG, SEED_EVENT_THRESHOLD } from '@/engine/content/seedEvent'
import { MS_PER_STAR } from '@/engine/content/starCounter'

const oneCandyPerSec: ProducerDef[] = [{ id: 'base', resource: 'candies', getRate: () => 1 }]
const noProducers: ProducerDef[] = []

describe('runLifecyclePass', () => {
  it('advances game time and credits production via tick', () => {
    const { state } = runLifecyclePass(createDefaultSave(), oneCandyPerSec, 1000)
    expect(state.accumulatedGameTimeMs).toBe(1000)
    expect(state.candies.current).toBe(2) // 1 start + 1/s * 1s
  })

  it('fires the seed event exactly once when armed, surfacing the seed-lands events', () => {
    const armed = {
      ...createDefaultSave(),
      flags: { telescopeOwned: true },
      candies: {
        current: 0,
        lifetimeAccumulated: SEED_EVENT_THRESHOLD,
        historicalMax: SEED_EVENT_THRESHOLD,
      },
    }
    const first = runLifecyclePass(armed, noProducers, 100)
    expect(first.state.flags[SEED_EVENT_FLAG]).toBe(true)
    expect(first.state.flags[SEED_PRESENT_FLAG]).toBe(true)
    expect(first.events).toContain('beanstalk.seedLands')
    expect(first.events).toContain('beanstalk.seedAppears')

    // Idempotent: a second pass does not re-fire (no duplicate events).
    const second = runLifecyclePass(first.state, noProducers, 100)
    expect(second.events).not.toContain('beanstalk.seedLands')
  })

  it('decrements one star for the seed event (separate from the time-driven descent)', () => {
    const armed = {
      ...createDefaultSave(),
      starsRemaining: 8128,
      flags: { telescopeOwned: true },
      // bought the telescope right at the start, so a full star-period has elapsed
      numbers: { telescopeBoughtAtMs: 0 },
      accumulatedGameTimeMs: MS_PER_STAR,
      candies: {
        current: 0,
        lifetimeAccumulated: SEED_EVENT_THRESHOLD,
        historicalMax: SEED_EVENT_THRESHOLD,
      },
    }
    const { state } = runLifecyclePass(armed, noProducers, 0)
    // seed event -1 AND the time-driven reconcile -1 => 8126
    expect(state.starsRemaining).toBe(8126)
  })

  it('reconciles the star descent on accumulated time even without the seed event', () => {
    const withTelescope = {
      ...createDefaultSave(),
      starsRemaining: 8128,
      flags: { telescopeOwned: true },
      numbers: { telescopeBoughtAtMs: 0 },
      accumulatedGameTimeMs: 2 * MS_PER_STAR,
    }
    const { state } = runLifecyclePass(withTelescope, noProducers, 0)
    expect(state.starsRemaining).toBe(8126)
  })

  it('never raises a cloud-reveal event (that beat is a player action, not a tick)', () => {
    const atClouds = { ...createDefaultSave(), flags: { beanstalkReachedClouds: true } }
    const { events } = runLifecyclePass(atClouds, noProducers, 100)
    expect(events).not.toContain('beanstalk.reachedClouds')
  })

  it('does not mutate the input state', () => {
    const before = createDefaultSave()
    runLifecyclePass(before, oneCandyPerSec, 1000)
    expect(before.accumulatedGameTimeMs).toBe(0)
    expect(before.candies.current).toBe(1)
  })

  it('returns no events on a quiet pass', () => {
    const { events } = runLifecyclePass(createDefaultSave(), oneCandyPerSec, 100)
    expect(events).toEqual([])
  })
})

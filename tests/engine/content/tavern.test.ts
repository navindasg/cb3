import { createDefaultSave } from '@/engine/state/defaultSave'
import {
  RUMOR_PERIOD_MS,
  rumorAvailable,
  msUntilNextRumor,
  tellRumor,
} from '@/engine/content/tavern'
import { TAVERN_RUMORS } from '@/content/tavern/rumors'
import type { GameState } from '@/engine/types/GameState'

describe('tavern rumor cadence (one free per accumulated GAME hour, never wall-clock)', () => {
  it('the first rumor is always available', () => {
    expect(rumorAvailable(createDefaultSave())).toBe(true)
    expect(msUntilNextRumor(createDefaultSave())).toBe(0)
  })

  it('tells a rumor and stamps the accumulated-time timestamp + advances the index', () => {
    const state: GameState = { ...createDefaultSave(), accumulatedGameTimeMs: 10_000 }
    const result = tellRumor(state, TAVERN_RUMORS)
    expect(result.rumor?.id).toBe(TAVERN_RUMORS[0]!.id)
    expect(result.state.numbers['lastRumorAtMs']).toBe(10_000)
    expect(result.state.numbers['rumorIndex']).toBe(1)
  })

  it('refuses a second rumor before a full game hour has passed', () => {
    const first = tellRumor({ ...createDefaultSave(), accumulatedGameTimeMs: 0 }, TAVERN_RUMORS)
    const tooSoon: GameState = { ...first.state, accumulatedGameTimeMs: RUMOR_PERIOD_MS - 1 }
    expect(rumorAvailable(tooSoon)).toBe(false)
    const denied = tellRumor(tooSoon, TAVERN_RUMORS)
    expect(denied.rumor).toBeNull()
    expect(denied.state).toBe(tooSoon) // unchanged
  })

  it('allows the next rumor once a full game hour has accumulated', () => {
    const first = tellRumor({ ...createDefaultSave(), accumulatedGameTimeMs: 0 }, TAVERN_RUMORS)
    const later: GameState = { ...first.state, accumulatedGameTimeMs: RUMOR_PERIOD_MS }
    expect(rumorAvailable(later)).toBe(true)
    const second = tellRumor(later, TAVERN_RUMORS)
    expect(second.rumor?.id).toBe(TAVERN_RUMORS[1]!.id) // index advanced → next rumor
  })

  it('msUntilNextRumor counts down on accumulated time', () => {
    const first = tellRumor({ ...createDefaultSave(), accumulatedGameTimeMs: 0 }, TAVERN_RUMORS)
    const halfway: GameState = { ...first.state, accumulatedGameTimeMs: RUMOR_PERIOD_MS / 2 }
    expect(msUntilNextRumor(halfway)).toBe(RUMOR_PERIOD_MS / 2)
  })

  it('returns null for an empty rumor registry', () => {
    expect(tellRumor(createDefaultSave(), []).rumor).toBeNull()
  })

  it('cycles back to the first rumor after the last', () => {
    let state: GameState = { ...createDefaultSave(), accumulatedGameTimeMs: 0 }
    const seen: string[] = []
    for (let i = 0; i < TAVERN_RUMORS.length + 1; i++) {
      const result = tellRumor(state, TAVERN_RUMORS)
      if (result.rumor) seen.push(result.rumor.id)
      // advance a full hour each time so the next is available
      state = { ...result.state, accumulatedGameTimeMs: (i + 1) * RUMOR_PERIOD_MS }
    }
    expect(seen[TAVERN_RUMORS.length]).toBe(TAVERN_RUMORS[0]!.id) // wrapped around
  })
})

import { createDefaultSave } from '@/engine/state/defaultSave'
import { createResource } from '@/engine/types/Resource'
import {
  SEED_EVENT_THRESHOLD,
  SEED_EVENT_FLAG,
  SEED_PRESENT_FLAG,
  seedGateArmed,
  seedEventFired,
  shouldFireSeedEvent,
  fireSeedEvent,
} from '@/engine/content/seedEvent'
import type { GameState } from '@/engine/types/GameState'

/** A state with the telescope owned and `lifetime` candies ever earned. */
function armed(lifetime = SEED_EVENT_THRESHOLD, over: Partial<GameState> = {}): GameState {
  const base = createDefaultSave()
  return {
    ...base,
    flags: { ...base.flags, telescopeOwned: true },
    candies: { current: 100, lifetimeAccumulated: lifetime, historicalMax: lifetime },
    ...over,
  }
}

describe('seed gate (telescope owned AND lifetime candies past the threshold)', () => {
  it('is not armed before the telescope is owned, even past the threshold', () => {
    const noTelescope: GameState = {
      ...createDefaultSave(),
      candies: createResource(SEED_EVENT_THRESHOLD),
    }
    expect(seedGateArmed(noTelescope)).toBe(false)
  })

  it('is not armed below the lifetime-candy threshold', () => {
    expect(seedGateArmed(armed(SEED_EVENT_THRESHOLD - 1))).toBe(false)
  })

  it('arms exactly at the threshold with the telescope owned (resolved decision 6: lifetimeAccumulated)', () => {
    expect(seedGateArmed(armed(SEED_EVENT_THRESHOLD))).toBe(true)
  })

  it('reads lifetimeAccumulated, not the current balance (spending must not disarm it)', () => {
    const spentDown = armed(SEED_EVENT_THRESHOLD, { candies: { current: 0, lifetimeAccumulated: SEED_EVENT_THRESHOLD, historicalMax: SEED_EVENT_THRESHOLD } })
    expect(spentDown.candies.current).toBe(0)
    expect(seedGateArmed(spentDown)).toBe(true)
  })
})

describe('seed event fires exactly once and is idempotent across reload', () => {
  it('does not fire when the gate is not armed', () => {
    const result = fireSeedEvent(armed(SEED_EVENT_THRESHOLD - 1))
    expect(result.fired).toBe(false)
  })

  it('fires once when armed: sets the guard + seed-present flags', () => {
    const result = fireSeedEvent(armed())
    expect(result.fired).toBe(true)
    expect(result.state.flags[SEED_EVENT_FLAG]).toBe(true)
    expect(result.state.flags[SEED_PRESENT_FLAG]).toBe(true)
    expect(seedEventFired(result.state)).toBe(true)
  })

  it('decrements the star counter by EXACTLY ONE (8128 -> 8127, the falling star)', () => {
    const before = armed()
    expect(before.starsRemaining).toBe(8128)
    const after = fireSeedEvent(before).state
    expect(after.starsRemaining).toBe(8127)
  })

  it('is idempotent across reload: a second pass on the fired state is inert (same reference)', () => {
    const onceFired = fireSeedEvent(armed()).state
    // Simulate a reload that re-runs the gate against the persisted (already-fired) state.
    const result = fireSeedEvent(onceFired)
    expect(result.fired).toBe(false)
    expect(result.state).toBe(onceFired)
    expect(result.state.starsRemaining).toBe(8127) // never double-decrements
    expect(shouldFireSeedEvent(onceFired)).toBe(false)
  })

  it('never drops the star counter below zero on a fire', () => {
    const lastStar = armed(SEED_EVENT_THRESHOLD, { starsRemaining: 0 })
    expect(fireSeedEvent(lastStar).state.starsRemaining).toBe(0)
  })

  it('does not mutate the input state', () => {
    const input = armed()
    fireSeedEvent(input)
    expect(input.flags[SEED_EVENT_FLAG]).toBeUndefined()
    expect(input.starsRemaining).toBe(8128)
  })
})

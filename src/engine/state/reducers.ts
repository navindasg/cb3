import type { GameState } from '@/engine/types/GameState'
import { spendResource } from '@/engine/types/Resource'
import { derivedMaxHp, MAX_HP_KEY } from '@/engine/state/recomputeCaches'

// Pure, immutable state transitions. Each returns a new state, or the SAME
// reference when nothing changed (lets signal effects skip via Object.is).

/** How many candies CB2's "throw candies" button moves to the ground in one click. */
export const THROW_BATCH = 10

/**
 * Eat `count` candies. Candies you eat are gone from the balance but counted in
 * lifetimeCandiesEaten forever (it gates ending 3 / scales "wrapper"). Eating is also food:
 * each candy eaten restores 1 HP (clamped to the max), and the lifetime total slowly raises
 * the HP ceiling (derivedMaxHp). Both the heal and the fresh maxHp cache are applied in this
 * single transition so the HP readout never reads a stale max (CB2's stale-derived-value bug).
 * Returns the SAME reference when the eat is a no-op (non-positive count / unaffordable).
 */
export function eatCandies(state: GameState, count: number): GameState {
  if (count <= 0) return state
  const candies = spendResource(state.candies, count)
  if (!candies) return state

  const lifetimeCandiesEaten = state.lifetimeCandiesEaten + count
  const maxHp = derivedMaxHp(lifetimeCandiesEaten)
  // Each candy eaten heals one HP, clamped into the freshly-recomputed [0, maxHp] band.
  const playerHpCurrent = Math.min(maxHp, state.playerHpCurrent + count)

  return {
    ...state,
    candies,
    lifetimeCandiesEaten,
    playerHpCurrent,
    numbers: { ...state.numbers, [MAX_HP_KEY]: maxHp },
  }
}

/** Eat the WHOLE current candy stack at once (CB2's "eat all your candies" button). */
export function eatAllCandies(state: GameState): GameState {
  return eatCandies(state, Math.floor(state.candies.current))
}

/**
 * Throw candies on the ground (CB1 opener; later the well-interest secret). CB2 throws a
 * fixed batch of ten per click; the default matches it. Feeds lifetimeCandiesThrown.
 */
export function throwCandies(state: GameState, count: number = THROW_BATCH): GameState {
  if (count <= 0) return state
  const candies = spendResource(state.candies, count)
  if (!candies) return state
  return { ...state, candies, lifetimeCandiesThrown: state.lifetimeCandiesThrown + count }
}

export function setFlag(state: GameState, key: string, value = true): GameState {
  if (state.flags[key] === value) return state
  return { ...state, flags: { ...state.flags, [key]: value } }
}

export function setNumber(state: GameState, key: string, value: number): GameState {
  if (state.numbers[key] === value) return state
  return { ...state, numbers: { ...state.numbers, [key]: value } }
}

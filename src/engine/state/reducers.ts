import type { GameState } from '@/engine/types/GameState'
import { spendResource } from '@/engine/types/Resource'

// Pure, immutable state transitions. Each returns a new state, or the SAME
// reference when nothing changed (lets signal effects skip via Object.is).

/** Eat candies: leave the balance, feed lifetimeCandiesEaten (gates ending 3 / scales "wrapper"). */
export function eatCandies(state: GameState, count: number): GameState {
  if (count <= 0) return state
  const candies = spendResource(state.candies, count)
  if (!candies) return state
  return { ...state, candies, lifetimeCandiesEaten: state.lifetimeCandiesEaten + count }
}

/** Throw candies on the ground (CB1 opener; later the well-interest secret). */
export function throwCandies(state: GameState, count: number): GameState {
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

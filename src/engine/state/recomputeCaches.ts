import type { GameState } from '@/engine/types/GameState'

// The single post-load/post-migration derived-values pass (resolved decision 4). maxHp is a
// DERIVED cache — never stored as the source of truth, always recomputed from
// lifetimeCandiesEaten so a hand-edited or migrated save can never carry a stale maxHp (the
// CB2 stale-derived-value bug). It is run ONCE after load/import and before the driver starts.
// playerHpCurrent is then clamped into the fresh [0, maxHp] range. Pure & immutable: returns a
// new state (or the SAME reference when nothing needed correcting).

/** Base player max HP at zero candies eaten. */
export const BASE_MAX_HP = 10

/** Candies eaten per +1 max HP (a slow, deadpan power curve). */
export const HP_PER_CANDY_THRESHOLD = 50

/** numbers key the derived maxHp cache is stamped into (read by the UI/quests). */
export const MAX_HP_KEY = 'playerMaxHp'

/** The derived max HP for a lifetime-candies-eaten total. Integer, monotonic, base-floored. */
export function derivedMaxHp(lifetimeCandiesEaten: number): number {
  const eaten = Math.max(0, Math.floor(lifetimeCandiesEaten))
  return BASE_MAX_HP + Math.floor(eaten / HP_PER_CANDY_THRESHOLD)
}

/**
 * Recompute every derived cache and clamp dependent live values. Stamps numbers.playerMaxHp
 * from lifetimeCandiesEaten and clamps playerHpCurrent into [0, maxHp]. Returns the SAME
 * reference when the cache and the clamp are already correct, so signal effects can skip.
 */
export function recomputeCaches(state: GameState): GameState {
  const maxHp = derivedMaxHp(state.lifetimeCandiesEaten)
  const clampedHp = Math.max(0, Math.min(maxHp, state.playerHpCurrent))

  const cacheCurrent = state.numbers[MAX_HP_KEY] === maxHp
  const hpCurrent = clampedHp === state.playerHpCurrent
  if (cacheCurrent && hpCurrent) return state

  return {
    ...state,
    playerHpCurrent: clampedHp,
    numbers: { ...state.numbers, [MAX_HP_KEY]: maxHp },
  }
}

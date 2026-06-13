import type { GameState } from '@/engine/types/GameState'
import type { RumorDef } from '@/engine/types/defs'

// The tavern gives one free rumor (a hint) per accumulated GAME hour (resolved decision 8 —
// a SOFT floor on accumulated game time, NEVER the wall clock, consistent with the comet
// rule). The last-told timestamp lives in numbers.lastRumorAtMs; eligibility compares it to
// accumulatedGameTimeMs so the cadence survives reload/background.

/** One accumulated game hour in ms — the rumor cooldown. */
export const RUMOR_PERIOD_MS = 60 * 60 * 1000

const LAST_RUMOR_KEY = 'lastRumorAtMs'
const RUMOR_INDEX_KEY = 'rumorIndex'

/** Whether a free rumor is available now (≥ one game hour since the last one). */
export function rumorAvailable(state: GameState): boolean {
  const last = state.numbers[LAST_RUMOR_KEY]
  if (last === undefined) return true // never asked → first rumor is free
  return state.accumulatedGameTimeMs - last >= RUMOR_PERIOD_MS
}

/** Ms of accumulated game time until the next free rumor (0 when one is available now). */
export function msUntilNextRumor(state: GameState): number {
  const last = state.numbers[LAST_RUMOR_KEY]
  if (last === undefined) return 0
  return Math.max(0, RUMOR_PERIOD_MS - (state.accumulatedGameTimeMs - last))
}

export interface RumorResult {
  /** The rumor told (cycles through the registry); null when none is available yet. */
  readonly rumor: RumorDef | null
  /** The state after telling (advances the timer + index); same reference when none told. */
  readonly state: GameState
}

/**
 * Tell the next rumor if one is available. Cycles through `rumors` in order, stamps the
 * accumulated-time timestamp, and advances the index. Immutable; SAME state when on cooldown
 * (or when there are no rumors).
 */
export function tellRumor(state: GameState, rumors: readonly RumorDef[]): RumorResult {
  if (rumors.length === 0 || !rumorAvailable(state)) return { rumor: null, state }
  const index = state.numbers[RUMOR_INDEX_KEY] ?? 0
  const rumor = rumors[index % rumors.length] ?? rumors[0]
  if (!rumor) return { rumor: null, state }
  const next: GameState = {
    ...state,
    numbers: {
      ...state.numbers,
      [LAST_RUMOR_KEY]: state.accumulatedGameTimeMs,
      [RUMOR_INDEX_KEY]: index + 1,
    },
  }
  return { rumor, state: next }
}

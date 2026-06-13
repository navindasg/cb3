import type { GameState } from '@/engine/types/GameState'
import type { RevealThreshold } from '@/engine/types/defs'

// CB2's opener reveals controls one at a time as candy accumulates: first "eat", then
// "throw", … gated by the candy high-water mark (candies.historicalMax — it never regresses
// when you spend, so a control once revealed stays revealed). Pure resolver over the data.

/** The action ids currently revealed: those whose threshold ≤ the candy high-water mark. */
export function revealedActions(
  thresholds: readonly RevealThreshold[],
  state: GameState,
): readonly string[] {
  const max = state.candies.historicalMax
  return thresholds.filter((t) => max >= t.atHistoricalMax).map((t) => t.action)
}

/** Whether a single action is revealed at the current candy high-water mark. */
export function isRevealed(
  thresholds: readonly RevealThreshold[],
  action: string,
  state: GameState,
): boolean {
  const t = thresholds.find((x) => x.action === action)
  return t !== undefined && state.candies.historicalMax >= t.atHistoricalMax
}

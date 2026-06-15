import type { RevealThreshold } from '@/engine/types/defs'

// The opening field reveals its controls one at a time as your candy high-water mark grows
// (CB2's CandyBox.checkCandies). "eat candies" is there from the first candy; "throw candies"
// appears once you have ever held ten (CB2's threshold, and the size of one throw batch).
// Resolved by engine/content/reveal against candies.historicalMax (never regresses on spend).

export const FIELD_REVEAL_THRESHOLDS: readonly RevealThreshold[] = [
  { action: 'eat', atHistoricalMax: 1 },
  { action: 'throw', atHistoricalMax: 10 },
]

import type { RevealThreshold } from '@/engine/types/defs'

// The opening field reveals its controls one at a time as your candy high-water mark grows
// (CB2's opener). "eat a candy" is there from the first candy; "throw a candy" appears once
// you have ever held five. Resolved by engine/content/reveal against candies.historicalMax.

export const FIELD_REVEAL_THRESHOLDS: readonly RevealThreshold[] = [
  { action: 'eat', atHistoricalMax: 1 },
  { action: 'throw', atHistoricalMax: 5 },
]

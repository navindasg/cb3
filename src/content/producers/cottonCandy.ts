import type { ProducerDef } from '@/engine/types/defs'
import { PADDOCK_CONFIG } from '@/content/sky/paddock'

// Cotton-candy producers as data (ADR §10 ProducerDef) — the cumulus commons' passive income.
// The tick sums getRate() across every producer, keyed by resource, so this slots into the same
// loop as the candy producers with no engine change: cottonCandy is inert (rate 0) until you own
// cloud sheep, then each grazing sheep adds PADDOCK_CONFIG.cottonPerSheepPerSec. Pure over state.

/** The cloud sheep paddock: each owned sheep grazes a steady trickle of cotton candy. */
const CLOUD_SHEEP_PADDOCK: ProducerDef = {
  id: 'cloudSheepPaddock',
  resource: 'cottonCandy',
  getRate: (s) =>
    Math.max(0, Math.floor(s.numbers[PADDOCK_CONFIG.countKey] ?? 0)) *
    PADDOCK_CONFIG.cottonPerSheepPerSec,
}

export const COTTON_CANDY_PRODUCERS: readonly ProducerDef[] = [CLOUD_SHEEP_PADDOCK]

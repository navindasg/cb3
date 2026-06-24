import type { ProducerDef } from '@/engine/types/defs'
import {
  PEPPERMINT_CONDENSER_KEY,
  PEPPERMINT_PER_CONDENSER_PER_SEC,
} from '@/content/planet/mintPlanet'

// Peppermint producers as data (ADR §10 ProducerDef) — the §184 act-gate grind. Once the frost wyrm is
// freed, each condenser you build sublimates peppermint from its frozen breath on a steady trickle, like
// the gummy burrowers shed rock candy. Slots into the same tick (summed by resource), accrues offline
// (catch-up is resource-agnostic). Pure over state; reads the condenser count + rate, never engine logic.
// (The count is 0 until the wyrm is freed — condensers can only be built then — so no extra gate here.)

/** The condensers' peppermint trickle scales with how many you have built. */
const PEPPERMINT_CONDENSERS: ProducerDef = {
  id: 'peppermintCondensers',
  resource: 'peppermint',
  getRate: (s) =>
    Math.max(0, Math.floor(s.numbers[PEPPERMINT_CONDENSER_KEY] ?? 0)) * PEPPERMINT_PER_CONDENSER_PER_SEC,
}

export const PEPPERMINT_PRODUCERS: readonly ProducerDef[] = [PEPPERMINT_CONDENSERS]

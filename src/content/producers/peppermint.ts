import type { ProducerDef } from '@/engine/types/defs'
import {
  PEPPERMINT_CONDENSER_KEY,
  PEPPERMINT_PER_CONDENSER_PER_SEC,
} from '@/content/planet/mintPlanet'
import {
  GUMMY_MINT_FUSED_COUNT_KEY,
  PEPPERMINT_PER_MINT_FUSED_GUMMY_PER_SEC,
  gummyWorkCrewMultiplier,
} from '@/content/gummy/molds'

// Peppermint producers as data (ADR §10 ProducerDef) — the §184 act-gate grind. Once the frost wyrm is
// freed, each condenser you build sublimates peppermint from its frozen breath on a steady trickle, like
// the gummy burrowers shed rock candy. Slots into the same tick (summed by resource), accrues offline
// (catch-up is resource-agnostic). Pure over state; reads the condenser count + rate, never engine logic.
// (The count is 0 until the wyrm is freed — condensers can only be built then — so no extra gate here.)
//
// Act 2 adds a second peppermint trickle: MINT-FUSED burrowers grown at the moon's gummy vat (worm ×
// licorice + mint) mine peppermint too — the gummy army quietly helping fill the §184 gate. Summed by
// resource on the tick, so it simply concats into the registry (the count is 0 until you grow one).
//
// Act 3 (Increment 3 — the §188/§261 mining automation): the gummy work-crews speed up the burrowers but
// NOT the inert condensers — a condenser is a machine, a burrower is the army. So only the mint-burrower
// trickle is scaled by gummyWorkCrewMultiplier (×1 until the crews are hired, so no regression). Pure
// content read; the producer stays content-only (ADR §3).

/** The condensers' peppermint trickle scales with how many you have built. */
const PEPPERMINT_CONDENSERS: ProducerDef = {
  id: 'peppermintCondensers',
  resource: 'peppermint',
  getRate: (s) =>
    Math.max(0, Math.floor(s.numbers[PEPPERMINT_CONDENSER_KEY] ?? 0)) * PEPPERMINT_PER_CONDENSER_PER_SEC,
}

/** The mint-fused burrowers' peppermint trickle scales with how many you have grown at the vat, lifted by
 * the hired work-crews (×1 until they are hired). */
const GUMMY_MINT_BURROWERS: ProducerDef = {
  id: 'gummyMintBurrowers',
  resource: 'peppermint',
  getRate: (s) =>
    Math.max(0, Math.floor(s.numbers[GUMMY_MINT_FUSED_COUNT_KEY] ?? 0)) *
    PEPPERMINT_PER_MINT_FUSED_GUMMY_PER_SEC *
    gummyWorkCrewMultiplier(s),
}

export const PEPPERMINT_PRODUCERS: readonly ProducerDef[] = [PEPPERMINT_CONDENSERS, GUMMY_MINT_BURROWERS]

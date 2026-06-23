import type { ProducerDef } from '@/engine/types/defs'
import { GUMMY_WORM_COUNT_KEY, ROCK_CANDY_PER_GUMMY_PER_SEC } from '@/content/gummy/molds'

// Rock-candy producers as data (ADR §10 ProducerDef) — the first PASSIVE rock-candy source. Each
// worm gummy grown at the vat (engine/content/gummyVat) burrows the moon and brings up rock candy on
// a steady trickle, exactly like the cloud-sheep paddock sheds cotton candy. It slots into the same
// tick (summed by resource) and accrues offline (catch-up is resource-agnostic). Pure over state;
// imports only content + a type (reads the gummy-count number + the rate, never engine logic).

/** The burrowers' trickle scales with how many worm gummies you have grown. */
const GUMMY_BURROWERS: ProducerDef = {
  id: 'gummyBurrowers',
  resource: 'rockCandy',
  getRate: (s) => Math.max(0, Math.floor(s.numbers[GUMMY_WORM_COUNT_KEY] ?? 0)) * ROCK_CANDY_PER_GUMMY_PER_SEC,
}

export const ROCK_CANDY_PRODUCERS: readonly ProducerDef[] = [GUMMY_BURROWERS]

import type { ProducerDef } from '@/engine/types/defs'
import {
  GUMMY_WORM_COUNT_KEY,
  GUMMY_FUSED_COUNT_KEY,
  ROCK_CANDY_PER_GUMMY_PER_SEC,
  ROCK_CANDY_PER_FUSED_GUMMY_PER_SEC,
  gummyWorkCrewMultiplier,
} from '@/content/gummy/molds'

// Rock-candy producers as data (ADR §10 ProducerDef) — the first PASSIVE rock-candy source. Each
// worm gummy grown at the vat (engine/content/gummyVat) burrows the moon and brings up rock candy on
// a steady trickle, exactly like the cloud-sheep paddock sheds cotton candy. It slots into the same
// tick (summed by resource) and accrues offline (catch-up is resource-agnostic). Pure over state;
// imports only content + a type (reads the gummy-count number + the rate, never engine logic).
//
// Act 2 adds a second trickle: SOUR-FUSED burrowers (the gummy folk's flavor fusion, §260) chew ~2.5×
// harder. Summed by resource on the tick, so it simply concats into the registry.
//
// Act 3 (Increment 3 — the §188/§261 mining automation): once the gummy work-crews are hired (stage 2),
// the WHOLE army mines faster. Both burrower trickles are scaled by gummyWorkCrewMultiplier (a pure
// content read — EXACTLY 1 until the crews are earned, so no regression to base rates). Still content-only:
// the producer reads a content helper, never engine logic (ADR §3).

/** The plain licorice burrowers' trickle scales with how many worm gummies you have grown, lifted by the
 * hired work-crews (×1 until they are hired). */
const GUMMY_BURROWERS: ProducerDef = {
  id: 'gummyBurrowers',
  resource: 'rockCandy',
  getRate: (s) =>
    Math.max(0, Math.floor(s.numbers[GUMMY_WORM_COUNT_KEY] ?? 0)) *
    ROCK_CANDY_PER_GUMMY_PER_SEC *
    gummyWorkCrewMultiplier(s),
}

/** The sour-fused burrowers' (faster) trickle scales with how many fused gummies you have grown, lifted by
 * the hired work-crews (×1 until they are hired). */
const GUMMY_FUSED_BURROWERS: ProducerDef = {
  id: 'gummyFusedBurrowers',
  resource: 'rockCandy',
  getRate: (s) =>
    Math.max(0, Math.floor(s.numbers[GUMMY_FUSED_COUNT_KEY] ?? 0)) *
    ROCK_CANDY_PER_FUSED_GUMMY_PER_SEC *
    gummyWorkCrewMultiplier(s),
}

export const ROCK_CANDY_PRODUCERS: readonly ProducerDef[] = [GUMMY_BURROWERS, GUMMY_FUSED_BURROWERS]

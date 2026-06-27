import type { ProducerDef } from '@/engine/types/defs'
import { STAR_TRAWLER_KEY, STARDUST_PER_TRAWLER_PER_SEC } from '@/content/sun/starSea'
import { DYSON_STAGE_DONE_FLAGS } from '@/content/flags'

// The star-trawlers as data (ADR §10 ProducerDef) — stardust's FIRST passive source (§3/§5 "sphere
// collectors"). Stardust has existed since Act 2 (schema v8 — harvested with pop rocks at the comet) but
// every grain came from a single transient comet catch; the star sea is its first FAUCET. Once the outer
// bracing is raised (dysonStage3Done) every trawler you launch sweeps the comet's wake and brings back
// stardust on a steady trickle, exactly like the solar collectors drink the star. Slots into the same tick
// (summed by resource), accrues offline (catch-up is resource-agnostic). Pure over state; reads the trawler
// count + rate + the stage-3 flag (a content value), never engine logic. The gate is belt-and-braces: the
// count is already 0 until stage 3 (trawlers can only be launched then), but we read the flag so the rate is
// honest even if a stray count slips into save data.

const STAGE3_DONE = DYSON_STAGE_DONE_FLAGS[2]

/** The trawlers' stardust stream scales with how many you have launched — 0 until the outer bracing is up. */
const STAR_TRAWLERS: ProducerDef = {
  id: 'starTrawlers',
  resource: 'stardust',
  getRate: (s) =>
    s.flags[STAGE3_DONE] === true
      ? Math.max(0, Math.floor(s.numbers[STAR_TRAWLER_KEY] ?? 0)) * STARDUST_PER_TRAWLER_PER_SEC
      : 0,
}

export const STARDUST_PRODUCERS: readonly ProducerDef[] = [STAR_TRAWLERS]

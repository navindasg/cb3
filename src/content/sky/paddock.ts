import type { PaddockConfig } from '@/engine/types/defs'

// The cloud-sheep paddock config (Act 1, the cumulus commons). Pure data the engine reads
// (engine/content/paddock for buying, content/producers/cottonCandy for the passive yield).
//
// Tuning is a §5/§22 "open, tune in playtest" knob. cottonPerSheepPerSec is set to 1/60 (one
// cotton candy per sheep per minute) — slow enough to feel idle, fast enough to SEE, and above
// the design's eventual ~1/10-min shipping target so a new resource doesn't read as broken on
// first sight. basePrice/priceGrowth put the first sheep within an Act-1 candy budget and make
// each head meaningfully dearer (the incremental idiom).

export const CLOUD_SHEEP_COUNT_KEY = 'cloudSheep'

export const PADDOCK_CONFIG: PaddockConfig = {
  countKey: CLOUD_SHEEP_COUNT_KEY,
  basePrice: 5000,
  priceGrowth: 1.5,
  cottonPerSheepPerSec: 1 / 60,
}

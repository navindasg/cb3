// The rock candy reef's asteroid field (Act 2, DESIGN §178/§90). Destructible asteroids that break
// into rock candy — the reef IS a rock-candy source. Pure data the engine (engine/content/reef)
// reads, mirroring the moon strata: a FINITE field, each asteroid taking some hits and yielding rock
// candy per hit; clearing the field harvests the reef. v1 is a plain harvest — the full zero-G DRIFT
// combat (the gumball cannon as weapon-and-engine, splitting asteroids, momentum), the space
// squirrel's acorn capsule, and later reef passes (§178 escalation) are Act-2 follow-ons. Yields are
// generous (a fresh, far source) and a §22-open tuning knob.

/** numbers-namespace keys for the reef harvest's progress. */
export const REEF_ASTEROID_KEY = 'reefAsteroidIndex' // asteroids broken (0..ASTEROID_FIELD.length)
export const REEF_HITS_KEY = 'reefAsteroidHits' // hits sunk into the current asteroid so far

/** One asteroid in the field — how many hits it takes to break and the rock candy each hit frees. */
export interface AsteroidDef {
  readonly id: string
  readonly name: string
  readonly hitsToBreak: number
  readonly yieldPerHit: number
}

/** The reef's asteroid field, near to far — larger asteroids take more hits but pay more rock candy. */
export const ASTEROID_FIELD: readonly AsteroidDef[] = [
  { id: 'pebble', name: 'a rock-candy pebble', hitsToBreak: 2, yieldPerHit: 8 },
  { id: 'cluster', name: 'a sugar-glass cluster', hitsToBreak: 3, yieldPerHit: 10 },
  { id: 'boulder', name: 'a banded boulder', hitsToBreak: 4, yieldPerHit: 12 },
  { id: 'shard', name: 'a great crystal shard', hitsToBreak: 5, yieldPerHit: 16 },
]

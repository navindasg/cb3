// The gummy army — molds × flavors (DESIGN §12), v1. Units are grown: a MOLD (shape = role) worked
// through a FLAVOR essence (= stats), at 50 candies + 1 flavor essence each. v1 is the first rung:
// the worm mold (the Quest-4 drop) × the licorice flavor (the tank flavor — and a resource you
// already produce). The grown burrowers passively mine rock candy (§12 "burrower, mining boost";
// §261 "mining automation"). Pure data the engine (engine/content/gummyVat) reads; the rest of the
// catalog is shown locked, to teach the molds×flavors shape before Act 2 fills it in.

/** numbers-namespace key for the grown worm-gummy count. */
export const GUMMY_WORM_COUNT_KEY = 'gummyWormCount'

/** Cost to grow one gummy (DESIGN §256: 50 candies + 1 flavor essence; the licorice resource is the
 * flavor input in v1). §22-open tuning knobs. */
export const GUMMY_CANDY_COST = 50
export const GUMMY_LICORICE_COST = 1

/**
 * Rock candy each worm gummy burrows up per second — the passive mining trickle. A generous, tunable
 * placeholder (mirrors the paddock/licorice rates that read 10× the design target so the loop feels
 * alive); the real balance is a §22-open knob. Additive to active mining, so it never soft-locks the
 * pick economy, and it keeps paying after the moon is mined clean.
 */
export const ROCK_CANDY_PER_GUMMY_PER_SEC = 1 / 30

/** A mold in the catalog — shape (= role). `available` is true only for molds usable in v1. */
export interface MoldDef {
  readonly id: string
  readonly name: string
  readonly role: string
  readonly available: boolean
}

/** A flavor essence — stats. `available` is true only for flavors sourceable in Act 1. */
export interface FlavorDef {
  readonly id: string
  readonly name: string
  readonly stat: string
  readonly available: boolean
}

/** The mold catalog (DESIGN §12/§258). v1: the worm is in hand; the rest are shown but not yet found
 * (the kraken-mini and dragon are the late/ship-tier molds — listed so the catalog is the full set). */
export const MOLDS: readonly MoldDef[] = [
  { id: 'worm', name: 'worm', role: 'burrower, mining boost', available: true },
  { id: 'bear', name: 'bear', role: 'frontline', available: false },
  { id: 'shark', name: 'shark', role: 'boarding', available: false },
  { id: 'knight', name: 'knight', role: 'escort', available: false },
  { id: 'krakenMini', name: 'kraken-mini', role: 'ship defense', available: false },
  { id: 'dragon', name: 'dragon', role: 'rare', available: false },
]

/** The flavor catalog (DESIGN §12). v1: licorice (the tank flavor) is sourceable; the rest come from
 * later acts (sour from the sour planet, etc.). */
export const FLAVORS: readonly FlavorDef[] = [
  { id: 'licorice', name: 'licorice', stat: 'tank', available: true },
  { id: 'sour', name: 'sour', stat: 'attack', available: false },
  { id: 'mint', name: 'mint', stat: 'regen', available: false },
  { id: 'cherry', name: 'cherry', stat: 'HP', available: false },
  { id: 'cola', name: 'cola', stat: 'speed', available: false },
  { id: 'grape', name: 'grape', stat: 'magic', available: false },
]

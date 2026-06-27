import type { GameState } from '@/engine/types/GameState'

// The gummy army — molds × flavors (DESIGN §12), v1. Units are grown: a MOLD (shape = role) worked
// through a FLAVOR essence (= stats), at 50 candies + 1 flavor essence each. v1 is the first rung:
// the worm mold (the Quest-4 drop) × the licorice flavor (the tank flavor — and a resource you
// already produce). The grown burrowers passively mine rock candy (§12 "burrower, mining boost";
// §261 "mining automation"). Pure data the engine (engine/content/gummyVat) reads; the rest of the
// catalog is shown locked, to teach the molds×flavors shape before Act 2 fills it in.
//
// Act 3 (Increment 3 — the §188/§261 mining-automation payoff): the gummy folk you met on the sour
// planet send WORK-CREWS once the second dyson strut is raised. They do not change what a burrower IS —
// they multiply the WHOLE standing army's output (rock candy AND peppermint) by a count-driven factor.
// The crew count is a one-way numbers ledger; gummyWorkCrewMultiplier is a pure read of it (× the
// stage-2 flag), and BOTH producers (rockCandy + peppermint) fold it into their getRate. A small warm
// beat in a cold act: the army that was a war machine now just moves candy. Type-only engine import.

/** numbers-namespace key for the grown worm-gummy count. */
export const GUMMY_WORM_COUNT_KEY = 'gummyWormCount'
/** numbers-namespace key for the grown SOUR-FUSED worm-gummy count (Act 2 — flavor fusion, §260). */
export const GUMMY_FUSED_COUNT_KEY = 'gummyFusedCount'
/** numbers-namespace key for the grown MINT-FUSED worm-gummy count (Act 2 — the frost wyrm's mint, §259).
 * These burrowers mine PEPPERMINT, not rock candy — the gummy army farms the very §184 act-gate resource. */
export const GUMMY_MINT_FUSED_COUNT_KEY = 'gummyMintFusedCount'

/** Cost to grow one gummy (DESIGN §256: 50 candies + 1 flavor essence; the licorice resource is the
 * flavor input in v1). §22-open tuning knobs. */
export const GUMMY_CANDY_COST = 50
export const GUMMY_LICORICE_COST = 1

/** Cost to grow one SOUR-FUSED worm gummy (Act 2 — the gummy folk's flavor fusion, §260): the same
 * mold worked through TWO flavors (licorice + sour). The sour (= attack, §259) makes it chew harder. */
export const GUMMY_FUSED_CANDY_COST = 50
export const GUMMY_FUSED_LICORICE_COST = 1
export const GUMMY_FUSED_SOUR_COST = 1

/** Cost to grow one MINT-FUSED worm gummy (Act 2 — the frost wyrm's mint, §259): the worm mold worked
 * through licorice + mint (= regen). It mines PEPPERMINT instead of rock candy — the elegant payoff is the
 * gummy army quietly filling the §184 peppermint gate while you do everything else. */
export const GUMMY_MINT_FUSED_CANDY_COST = 50
export const GUMMY_MINT_FUSED_LICORICE_COST = 1
export const GUMMY_MINT_FUSED_MINT_COST = 1

/**
 * Rock candy each worm gummy burrows up per second — the passive mining trickle. A generous, tunable
 * placeholder (mirrors the paddock/licorice rates that read 10× the design target so the loop feels
 * alive); the real balance is a §22-open knob. Additive to active mining, so it never soft-locks the
 * pick economy, and it keeps paying after the moon is mined clean.
 */
export const ROCK_CANDY_PER_GUMMY_PER_SEC = 1 / 30
/** A sour-fused burrower mines ~2.5× a plain one — sour is the attack flavor, so it chews harder. The
 * payoff for learning fusion + trading for sour essence. §22-open tuning. */
export const ROCK_CANDY_PER_FUSED_GUMMY_PER_SEC = 1 / 12

/** PEPPERMINT each MINT-FUSED burrower sublimates per second (mint = regen, so it works the cold patiently).
 * Modest next to a condenser (0.1/s): the burrowers are a passive SUPPLEMENT toward the 10k §184 gate, not
 * a replacement for building condensers — but a standing gummy army meaningfully helps fill it. §22-open. */
export const PEPPERMINT_PER_MINT_FUSED_GUMMY_PER_SEC = 1 / 20

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
  { id: 'sour', name: 'sour', stat: 'attack', available: true }, // Act 2: traded from the gummy folk
  { id: 'mint', name: 'mint', stat: 'regen', available: true }, // Act 2: harvested from the frost wyrm's breath
  { id: 'cherry', name: 'cherry', stat: 'HP', available: false },
  { id: 'cola', name: 'cola', stat: 'speed', available: false },
  { id: 'grape', name: 'grape', stat: 'magic', available: false },
]

// --- gummy work-crews (Act 3 — stage-2 reward, the §188/§261 mining automation) -----------------------
// The gummy folk send work-crews once the second dyson strut is raised (dysonStage2Done). A hired crew
// does not add a new producer or a new resource — it multiplies EVERY existing gummy burrower's output
// (rock candy AND peppermint) by a single factor: 1 + count * WORK_CREW_BOOST. At count 0 (and pre-stage-2,
// where the count can never have risen) the multiplier is EXACTLY 1, so existing burrower rates are
// unchanged — no regression. The count is a one-way numbers ledger (the engine helper only ever ++s it);
// this is a pure read, so there is no re-triggerable income (NOT a farm). §22-open tuning.

/** numbers-namespace key for the hired gummy work-crew count (default 0 — none hired). */
export const GUMMY_WORK_CREW_COUNT_KEY = 'gummyWorkCrewCount'

/**
 * Kept in lock-step with content/flags.DYSON_STAGE_DONE_FLAGS[1] — the helper is content, so it MAY name
 * the content flag literal directly; it is re-declared here (not imported from flags) only to keep the
 * gate a local constant alongside the rest of the work-crew config. The stage-2 flag also makes the
 * multiplier honestly 1 if a stray count ever slipped into save data before the works were earned.
 */
export const GUMMY_WORK_CREW_STAGE_FLAG = 'dysonStage2Done'

/** Each hired work-crew lifts the WHOLE army's mining output by this fraction (additive in count). A crew
 * is a meaningful but not explosive boost — the army is large by Act 3, so a few crews ~double output and
 * the scaling tapers. §22-open tuning. */
export const WORK_CREW_BOOST = 0.25

/** Cost to hire one gummy work-crew: candies + a licorice essence (the same flavor input the burrowers
 * are grown through — you are paying the army to bring in more hands, in their own currency). Caramel and
 * the heavier costs stay on the dyson struts; the crews themselves are cheap, scaling automation. §22-open. */
export const WORK_CREW_CANDY_COST = 5_000_000
export const WORK_CREW_LICORICE_COST = 10

/** How many work-crews have been hired (clamped to a non-negative integer; defaults to 0). A pure read of
 * the one-way ledger — shared by the engine helpers and the multiplier so they never drift. */
export function workCrewCount(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[GUMMY_WORK_CREW_COUNT_KEY] ?? 0))
}

/**
 * The multiplier the hired work-crews apply to EVERY gummy burrower's mining output (rock candy AND
 * peppermint). EXACTLY 1 when no crews are hired OR before the stage-2 strut is raised (the count cannot
 * have risen pre-gate, but the flag guard keeps a stray save value from leaking a boost) — so base burrower
 * rates are unchanged until the crews are earned. Otherwise 1 + count * WORK_CREW_BOOST. A pure read over a
 * one-way count + a flag; both producers fold it into their getRate (producers stay content-only, ADR §3 —
 * they read this content helper, never engine logic).
 */
export function gummyWorkCrewMultiplier(state: GameState): number {
  if (state.flags[GUMMY_WORK_CREW_STAGE_FLAG] !== true) return 1
  return 1 + workCrewCount(state) * WORK_CREW_BOOST
}

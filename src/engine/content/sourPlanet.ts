import type { GameState } from '@/engine/types/GameState'
import { spendResource, addResource } from '@/engine/types/Resource'
import { setFlag, setNumber } from '@/engine/state/reducers'
import { SOUR_TRADE_CANDY_COST, SOUR_TRADE_BATCH } from '@/content/planet/sourPlanet'

// The sour planet (Act 2 — quest 9, DESIGN §181). Pure & immutable, mirroring the other content engines
// (compute from state, return the next state; a no-op returns the SAME reference). Two capabilities the
// gummy folk grant: LEARNING flavor fusion (a one-off flag) and TRADING candies for sour essence. The
// fusion itself (growing two-flavor burrowers) lives in engine/content/gummyVat, which reads the same
// learned flag. All progress lives in flags + the sour resource.

/**
 * Kept in lock-step with content/flags.FLAVOR_FUSION_FLAG (content owns the named constant — the
 * moonStrata idiom). The engine reads the literal here rather than importing the content value, so the
 * layering stays clean (ADR §3).
 */
const FLAVOR_FUSION_FLAG = 'flavorFusionLearned'

/** Whether the gummy folk have taught you flavor fusion (unlocks the vat's two-flavor burrowers). */
export function flavorFusionLearned(state: GameState): boolean {
  return state.flags[FLAVOR_FUSION_FLAG] === true
}

export interface LearnResult {
  readonly ok: boolean
  readonly state: GameState
}

/** Learn flavor fusion from the elder. A no-op (SAME reference) once already learned. Immutable. */
export function learnFusion(state: GameState): LearnResult {
  if (flavorFusionLearned(state)) return { ok: false, state }
  return { ok: true, state: setFlag(state, FLAVOR_FUSION_FLAG) }
}

/** Whether you can afford a batch of sour essence from the gummy folk right now. */
export function canTradeSour(state: GameState): boolean {
  return state.candies.current >= SOUR_TRADE_CANDY_COST
}

export interface TradeResult {
  readonly ok: boolean
  readonly state: GameState
}

/**
 * Trade a batch of candies for sour essence. Fails (SAME reference) when candies are short (spendResource
 * returns null rather than overdrafting). Immutable.
 */
export function tradeSour(state: GameState): TradeResult {
  const candies = spendResource(state.candies, SOUR_TRADE_CANDY_COST)
  if (!candies) return { ok: false, state }
  return { ok: true, state: { ...state, candies, sour: addResource(state.sour, SOUR_TRADE_BATCH) } }
}

// --- Sour-rain marinate (Phase 5 interaction secret, DESIGN §18) -----------------------------------
// Stand on the sour platforms with NO armour and let the corrosive rain work on you. Everyone who has
// ever been to the sour planet knows to armour up; the counter-intuitive act is to NOT — to take the
// corrosion on the chin for a full minute — after which the gummy folk pronounce you 'well-marinated'
// and it confers a tiny permanent sour resistance. A dwell accumulator on accumulatedGameTimeMs (never
// the wall clock — offline-safe, survives reload/background, exactly like the comet/tavern cadence): the
// anchor stamps when unarmoured dwell (re)starts; equipping armour clears it (you flinched). At 60s of
// unbroken unarmoured dwell the marinate flag latches ONCE and grants the resist number. Farm-proof.

/** content/flags: set once the player has stood unarmoured in the sour rain long enough (well-marinated). */
export const SOUR_MARINATE_FLAG = 'sourMarinated'

/** numbers: the accumulatedGameTimeMs at which the current unbroken unarmoured dwell began. A NEGATIVE
 * value (or an absent key) means "not currently dwelling" — armour writes -1 to break it. A real anchor
 * can legitimately be 0 (dwell begun at the very start of the game), so 0 is NOT a "not dwelling" sentinel. */
export const SOUR_DWELL_ANCHOR_KEY = 'sourDwellAnchorMs'

/** The "not currently dwelling" sentinel written to the anchor when armour breaks the dwell. */
const NOT_DWELLING = -1

/** numbers: the permanent sour resistance conferred by being well-marinated (+1). Pure flavor stat. */
export const SOUR_RESIST_KEY = 'sourResist'

/** The unbroken unarmoured dwell (accumulated game ms) needed to become well-marinated: one minute. */
export const SOUR_MARINATE_MS = 60_000

/** The permanent sour resist granted on marinating. */
export const SOUR_MARINATE_RESIST = 1

/** Whether the player is well-marinated (the permanent sour-resist has been earned). */
export function sourMarinated(state: GameState): boolean {
  return state.flags[SOUR_MARINATE_FLAG] === true
}

/** Whether the player currently wears armour (any armour item equipped). */
function armoured(state: GameState): boolean {
  return state.equipped.armour !== null
}

/**
 * The unbroken unarmoured dwell so far, in accumulated game ms (0 when armoured or not yet anchored).
 * A pure read used by the screen to draw the progress toward the marinate.
 */
export function sourDwellMs(state: GameState): number {
  if (armoured(state)) return 0
  const anchor = state.numbers[SOUR_DWELL_ANCHOR_KEY]
  if (anchor === undefined || anchor < 0) return 0
  return Math.max(0, state.accumulatedGameTimeMs - anchor)
}

export interface MarinateResult {
  /** True when THIS call earned the marinate (the resist was just granted). */
  readonly marinated: boolean
  /** The state after observing (a fresh anchor, a cleared anchor, or the marinate award). */
  readonly state: GameState
}

/**
 * Observe an instant of standing (still) in the sour rain. Pure & monotonic on accumulatedGameTimeMs:
 *  - already well-marinated → SAME reference (nothing more to do; farm-proof latch).
 *  - wearing armour → the dwell is broken; clear the anchor (you flinched — start over next time bare).
 *  - not yet anchored → stamp the anchor at the current accumulated game time and begin the vigil.
 *  - anchored, ≥ 60s of unbroken bare dwell → latch the marinate flag + grant the sour-resist, once.
 *  - anchored, still counting → SAME reference (no change until the minute is up).
 * Offline-safe: accumulatedGameTimeMs advances through background/catch-up, so a minute spent away
 * with the screen open still counts. Immutable throughout.
 */
export function observeSourDwell(state: GameState): MarinateResult {
  if (sourMarinated(state)) return { marinated: false, state }

  if (armoured(state)) {
    const cleared = setNumber(state, SOUR_DWELL_ANCHOR_KEY, NOT_DWELLING)
    return { marinated: false, state: cleared }
  }

  const anchor = state.numbers[SOUR_DWELL_ANCHOR_KEY]
  if (anchor === undefined || anchor < 0) {
    return { marinated: false, state: setNumber(state, SOUR_DWELL_ANCHOR_KEY, state.accumulatedGameTimeMs) }
  }

  if (state.accumulatedGameTimeMs - anchor >= SOUR_MARINATE_MS) {
    const flagged = setFlag(state, SOUR_MARINATE_FLAG)
    const resisted = setNumber(flagged, SOUR_RESIST_KEY, (state.numbers[SOUR_RESIST_KEY] ?? 0) + SOUR_MARINATE_RESIST)
    return { marinated: true, state: resisted }
  }

  return { marinated: false, state }
}

import type { GameState } from '@/engine/types/GameState'
import { spendResource, addResource } from '@/engine/types/Resource'
import { setFlag } from '@/engine/state/reducers'
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

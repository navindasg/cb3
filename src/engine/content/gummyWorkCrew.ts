import type { GameState } from '@/engine/types/GameState'
import { spendResource } from '@/engine/types/Resource'
import { setNumber } from '@/engine/state/reducers'
import {
  GUMMY_WORK_CREW_COUNT_KEY,
  WORK_CREW_CANDY_COST,
  WORK_CREW_LICORICE_COST,
  workCrewCount,
} from '@/content/gummy/molds'

// Gummy work-crews (Act 3 — Increment 3, the stage-2 reward, DESIGN §188/§261). Pure & immutable, mirroring
// mintPlanet.buildCondenser / solarWorks.buildCollector exactly: a buy-count machine gated on a flag. Hiring
// one spends candies + a licorice essence into a LOCAL paid (NEVER a partial spend — spendResource returns
// null rather than overdrafting) then ++the count; a no-op returns the SAME reference when the stage-2 gate
// is shut or an input is short. The count only ever rises, so this is NOT a farm — pure spend-and-set, like
// the collectors. There is no income here: the crews are a MULTIPLIER read by the rock-candy + peppermint
// producers (content/gummy/molds.gummyWorkCrewMultiplier), not a producer themselves.
//
// The gate is the dysonStage2Done flag literal, re-declared here in lock-step with content/flags'
// DYSON_STAGE_DONE_FLAGS[1] (the moonStrata idiom — the engine never imports a content FLAG value, ADR §3).
// The engine MAY import content CONFIG (the count key, the costs, the shared count reader), exactly as
// buildCollector imports the collector config.

/**
 * Kept in lock-step with content/flags.DYSON_STAGE_DONE_FLAGS[1] (content owns the named array; the engine
 * re-declares the literal rather than importing the content value — ADR §3, the moonStrata idiom).
 */
const DYSON_STAGE2_DONE_FLAG = 'dysonStage2Done'

/** Whether the gummy work-crews can be hired — gated on the second dyson strut being raised. The gummy
 * folk only send crews once the cage's lower ring is up. */
export function workCrewsUnlocked(state: GameState): boolean {
  return state.flags[DYSON_STAGE2_DONE_FLAG] === true
}

/** How many work-crews you have hired (re-exports the shared content reader so engine + content + the
 * multiplier never drift). */
export { workCrewCount }

/** Whether a work-crew can be hired now (stage 2 raised and both inputs affordable). */
export function canHireCrew(state: GameState): boolean {
  return (
    workCrewsUnlocked(state) &&
    state.candies.current >= WORK_CREW_CANDY_COST &&
    state.licorice.current >= WORK_CREW_LICORICE_COST
  )
}

export interface HireResult {
  readonly ok: boolean
  readonly state: GameState
  readonly reason?: 'locked' | 'unaffordable'
}

/**
 * Hire one gummy work-crew: spend candies + a licorice essence, increment the count. Fails (SAME reference)
 * until the stage-2 strut is raised, or when either input is short (spendResource returns null rather than
 * overdrafting, so nothing is touched — NEVER a partial spend). Immutable. The bumped count only ever rises;
 * the boost it grants is a pure read by the burrower producers, so this cannot be farmed.
 */
export function hireCrew(state: GameState): HireResult {
  if (!workCrewsUnlocked(state)) return { ok: false, state, reason: 'locked' }

  const candies = spendResource(state.candies, WORK_CREW_CANDY_COST)
  if (!candies) return { ok: false, state, reason: 'unaffordable' }
  const licorice = spendResource(state.licorice, WORK_CREW_LICORICE_COST)
  if (!licorice) return { ok: false, state, reason: 'unaffordable' }

  const paid: GameState = { ...state, candies, licorice }
  return { ok: true, state: setNumber(paid, GUMMY_WORK_CREW_COUNT_KEY, workCrewCount(state) + 1) }
}

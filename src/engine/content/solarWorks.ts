import type { GameState } from '@/engine/types/GameState'
import { spendResource } from '@/engine/types/Resource'
import { setNumber } from '@/engine/state/reducers'
import {
  SOLAR_COLLECTOR_KEY,
  CARAMEL_COLLECTOR_KEY,
  SOLAR_COLLECTOR_CANDY_COST,
  SOLAR_COLLECTOR_ROCK_CANDY_COST,
  SOLAR_CANDY_PER_COLLECTOR_PER_SEC,
  CARAMEL_COLLECTOR_CANDY_COST,
  CARAMEL_PER_COLLECTOR_PER_SEC,
} from '@/content/sun/solarWorks'

// The solar works (Act 3 — Increment 2, the stage-1 reward, DESIGN §5/§188). Pure & immutable, mirroring
// mintPlanet.buildCondenser exactly: a buildable, count-scaled passive producer gated on a flag. TWO of
// them — SOLAR CANDY COLLECTORS (the ~x100 income jump that funds stages 2-5) and the SOLAR-CARAMEL
// COLLECTOR (the scaling caramel faucet complementing Increment 0's manual boil floor). Building one spends
// every input into a LOCAL paid (NEVER a partial spend — spendResource returns null rather than
// overdrafting) then ++the count; a no-op returns the SAME reference when the stage-1 gate is shut or an
// input is short. The count only ever rises, so this is NOT a farm — pure spend-and-set, like the
// condensers. Soft-lock-free: candies + rock candy are abundant by Act 3, and the caramel faucet is itself
// the anti-soft-lock for the escalating struts + the bathysphere caramel costs.
//
// The gate is the dysonStage1Done flag literal, re-declared here in lock-step with content/flags'
// DYSON_STAGE_DONE_FLAGS[0] (the moonStrata idiom — the engine never imports a content FLAG value, ADR §3).
// The engine MAY import content CONFIG (the keys, costs, rates), exactly as buildCondenser imports the
// condenser config. The producers (content/producers/solarCollector + caramel) read solarCandyRate /
// solarCaramelRate over the same counts.

/**
 * Kept in lock-step with content/flags.DYSON_STAGE_DONE_FLAGS[0] (content owns the named array; the engine
 * re-declares the literal rather than importing the content value — ADR §3, the moonStrata idiom).
 */
const DYSON_STAGE1_DONE_FLAG = 'dysonStage1Done'

/** Whether the first dyson strut has been raised — the solar works are open for business. */
export function solarWorksOpen(state: GameState): boolean {
  return state.flags[DYSON_STAGE1_DONE_FLAG] === true
}

// --- solar candy collectors ---------------------------------------------------------------------------

/** How many solar candy collectors you have hung on the scaffold (clamped to a non-negative integer). */
export function collectorCount(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[SOLAR_COLLECTOR_KEY] ?? 0))
}

/** Candy the collectors pour per second (the producer reads the same product). 0 until stage 1, since the
 * count can only rise once the works are open — but guarded here too so the rate is honest pre-gate. */
export function solarCandyRate(state: GameState): number {
  return solarWorksOpen(state) ? collectorCount(state) * SOLAR_CANDY_PER_COLLECTOR_PER_SEC : 0
}

/** Whether a solar candy collector can be built now (stage 1 raised and both inputs affordable). */
export function canBuildCollector(state: GameState): boolean {
  return (
    solarWorksOpen(state) &&
    state.candies.current >= SOLAR_COLLECTOR_CANDY_COST &&
    state.rockCandy.current >= SOLAR_COLLECTOR_ROCK_CANDY_COST
  )
}

export interface BuildResult {
  readonly ok: boolean
  readonly state: GameState
  readonly reason?: 'locked' | 'unaffordable'
}

/**
 * Hang one solar candy collector: spend candies + a rock-candy strut, increment the count. Fails (SAME
 * reference) until stage 1 is raised, or when either input is short (spendResource returns null rather than
 * overdrafting, so nothing is touched — NEVER a partial spend). Immutable.
 */
export function buildCollector(state: GameState): BuildResult {
  if (!solarWorksOpen(state)) return { ok: false, state, reason: 'locked' }

  const candies = spendResource(state.candies, SOLAR_COLLECTOR_CANDY_COST)
  if (!candies) return { ok: false, state, reason: 'unaffordable' }
  const rockCandy = spendResource(state.rockCandy, SOLAR_COLLECTOR_ROCK_CANDY_COST)
  if (!rockCandy) return { ok: false, state, reason: 'unaffordable' }

  const paid: GameState = { ...state, candies, rockCandy }
  return { ok: true, state: setNumber(paid, SOLAR_COLLECTOR_KEY, collectorCount(state) + 1) }
}

// --- the solar-caramel collector ----------------------------------------------------------------------

/** How many solar-caramel collectors you have hung on the scaffold (clamped to a non-negative integer). */
export function caramelCollectorCount(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[CARAMEL_COLLECTOR_KEY] ?? 0))
}

/** Caramel the caramel-collectors render per second (the producer reads the same product). 0 until stage 1. */
export function solarCaramelRate(state: GameState): number {
  return solarWorksOpen(state) ? caramelCollectorCount(state) * CARAMEL_PER_COLLECTOR_PER_SEC : 0
}

/** Whether a solar-caramel collector can be built now (stage 1 raised and the candy cost affordable). */
export function canBuildCaramelCollector(state: GameState): boolean {
  return solarWorksOpen(state) && state.candies.current >= CARAMEL_COLLECTOR_CANDY_COST
}

/**
 * Hang one solar-caramel collector: spend candies (caramel is never gated on caramel), increment the count.
 * Fails (SAME reference) until stage 1 is raised, or when candies are short (spendResource returns null
 * rather than overdrafting). Immutable.
 */
export function buildCaramelCollector(state: GameState): BuildResult {
  if (!solarWorksOpen(state)) return { ok: false, state, reason: 'locked' }

  const candies = spendResource(state.candies, CARAMEL_COLLECTOR_CANDY_COST)
  if (!candies) return { ok: false, state, reason: 'unaffordable' }

  const paid: GameState = { ...state, candies }
  return { ok: true, state: setNumber(paid, CARAMEL_COLLECTOR_KEY, caramelCollectorCount(state) + 1) }
}

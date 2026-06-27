import type { GameState } from '@/engine/types/GameState'
import { spendResource } from '@/engine/types/Resource'
import { setNumber } from '@/engine/state/reducers'
import {
  STAR_TRAWLER_KEY,
  STAR_TRAWLER_CANDY_COST,
  STAR_TRAWLER_CARAMEL_COST,
  STARDUST_PER_TRAWLER_PER_SEC,
} from '@/content/sun/starSea'

// The star sea (Act 3 — Increment 4, the stage-3 reward, DESIGN §3/§188). Pure & immutable, mirroring
// solarWorks.buildCollector / mintPlanet.buildCondenser exactly: a buildable, count-scaled passive producer
// gated on a flag. STAR-TRAWLERS sweep the comet's wake for STARDUST — stardust's FIRST passive source
// (every grain came from a single transient comet catch until now, Act 2 Inc 21). Launching one spends candies
// + a caramel ballast into a LOCAL paid (NEVER a partial spend — spendResource returns null rather than
// overdrafting) then ++the count; a no-op returns the SAME reference when the stage-3 gate is shut or an input
// is short. The count only ever rises, so this is NOT a farm — pure spend-and-set, like the collectors.
// Soft-lock-free: candies are abundant by Act 3 and caramel has live faucets (Inc-0 boil + Inc-2 collector);
// stardust ALSO still flows from the comet, so the bathysphere never depends solely on this.
//
// DECISION: the trawler is a passive ProducerDef (small + farm-proof + offline-safe — the condenser idiom),
// NOT a re-skin of the transient driftReef sim. The drift re-skin is signposted-DEFERRED to keep the slice
// tight and farm-proof (a transient sim yielding a persistent resource must commit-on-completion only or it
// is an infinite farm; a count-scaled producer has no such hazard).
//
// The gate is the dysonStage3Done flag literal, re-declared here in lock-step with content/flags'
// DYSON_STAGE_DONE_FLAGS[2] (the moonStrata idiom — the engine never imports a content FLAG value, ADR §3).
// The engine MAY import content CONFIG (the count key, costs, rate), exactly as buildCollector imports the
// collector config. The producer (content/producers/stardust) reads stardustRate over the same count.

/**
 * Kept in lock-step with content/flags.DYSON_STAGE_DONE_FLAGS[2] (content owns the named array; the engine
 * re-declares the literal rather than importing the content value — ADR §3, the moonStrata idiom).
 */
const DYSON_STAGE3_DONE_FLAG = 'dysonStage3Done'

/** Whether the star sea is open — gated on the third dyson strut (the outer bracing) being raised. */
export function starSeaOpen(state: GameState): boolean {
  return state.flags[DYSON_STAGE3_DONE_FLAG] === true
}

/** How many star-trawlers you have launched into the sea (clamped to a non-negative integer). */
export function trawlerCount(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[STAR_TRAWLER_KEY] ?? 0))
}

/** Stardust the trawlers sweep per second (the producer reads the same product). 0 until stage 3, since the
 * count can only rise once the sea is open — but guarded here too so the rate is honest pre-gate. */
export function stardustRate(state: GameState): number {
  return starSeaOpen(state) ? trawlerCount(state) * STARDUST_PER_TRAWLER_PER_SEC : 0
}

/** Whether a star-trawler can be launched now (stage 3 raised and both inputs affordable). */
export function canBuildTrawler(state: GameState): boolean {
  return (
    starSeaOpen(state) &&
    state.candies.current >= STAR_TRAWLER_CANDY_COST &&
    state.caramel.current >= STAR_TRAWLER_CARAMEL_COST
  )
}

export interface BuildTrawlerResult {
  readonly ok: boolean
  readonly state: GameState
  readonly reason?: 'locked' | 'unaffordable'
}

/**
 * Launch one star-trawler: spend candies + a caramel ballast, increment the count. Fails (SAME reference)
 * until stage 3 is raised, or when either input is short (spendResource returns null rather than
 * overdrafting, so nothing is touched — NEVER a partial spend). Immutable. The bumped count only ever rises,
 * so this cannot be farmed.
 */
export function buildTrawler(state: GameState): BuildTrawlerResult {
  if (!starSeaOpen(state)) return { ok: false, state, reason: 'locked' }

  const candies = spendResource(state.candies, STAR_TRAWLER_CANDY_COST)
  if (!candies) return { ok: false, state, reason: 'unaffordable' }
  const caramel = spendResource(state.caramel, STAR_TRAWLER_CARAMEL_COST)
  if (!caramel) return { ok: false, state, reason: 'unaffordable' }

  const paid: GameState = { ...state, candies, caramel }
  return { ok: true, state: setNumber(paid, STAR_TRAWLER_KEY, trawlerCount(state) + 1) }
}

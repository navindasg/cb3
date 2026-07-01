import type { GameState } from '@/engine/types/GameState'
import { setNumber } from '@/engine/state/reducers'
import { grantItem } from '@/engine/shop/purchase'
import { meleeWeapon } from '@/content/items/playerLoadout'
// DELIBERATE, non-cargo-cult divergence from the kraken/boarding drop idiom (where the RENDER layer owns the
// item-def import + the commit-once grant): here the grant + the eclipse cast live in the engine ON PURPOSE so
// they stay pure-tested (voidWhaleScreens is coverage-excluded glue). ItemDefs are CONFIG data (ADR §3 permits
// the engine to read content config), not content FLAG VALUES — the flags are re-declared in lock-step below.
// This mirrors reflectionFight/hallucination's deliberate divergence (same testability reason).
import { VOID_PEARL } from '@/content/items/items'
import { castEclipse } from '@/engine/content/starCounter'
import { VOID_LEG_KEY, VOID_WAYPOINT_KEY } from '@/content/void/voidWhale'
import {
  WHALE_PLAYER_HP,
  TOOTH_HP,
  TOOTH_START_DIST,
  MIN_DIST,
  CRUSH_DMG_BY_DIST,
  BRACE_MULT,
  FAST_COOLDOWN_MS,
  MAX_TURNS,
} from '@/content/void/voidWhale'

// The void whale (Phase 5 — hidden boss 4, DESIGN §17). Pure & immutable. Three pieces, all soft-lock-free:
//
//  1) THE CROSSING to empty space — a plot-a-course beat mirroring engine/content/reefVoyage one-for-one (leg +
//     waypoint counters in numbers; a correct pick advances, a wrong pick loses the leg's run — never a soft-
//     lock; the final leg sets the reached flag). Gated at the screen on the acorn being owned (the squirrel's
//     coordinate); the engine only tracks the plot. Reaching the coordinate is where the whale swallows you.
//
//  2) THE OPTIONAL FIGHT — a telegraph-and-sever bout reading your EQUIPPED HAND WEAPON, mirroring
//     engine/content/krakenFight (the whale's teeth for the kraken's arms). NOT required to claim the shop or
//     the grimoire; leaving is always allowed. Transient (never persisted); only the cleared flag + the void-
//     pearl drop persist, committed once on the first win. Grid-searched (see the test) so bare hands lose, the
//     mace's naive all-strike loses (bracing required), and the bow safe-wins by interception on a tight clock.
//
//  3) THE REWARDS — the hermit's shop (gloves + grimoire) rides the generic purchase handler (the screen), and
//     the black grimoire's ECLIPSE world-spell is dispatched through castEclipse here (pure, tested) so the
//     star-counter pause is a tested transition, not screen logic. The void-pearl drop is commit-once.
//
// The hermit is fine. He has been here a while. He would, on the whole, rather you left — and you always can.

// --- the crossing to empty space (plot a course to the coordinate) --------------------------------------

/**
 * Kept in lock-step with content/flags.VOID_REACHED_FLAG (content owns the named constant — the reef-voyage
 * idiom). Set on the leg that completes the crossing so "reached" is pure-engine and testable; the engine
 * writes the literal here rather than importing the content value (ADR §3).
 */
const VOID_REACHED_FLAG = 'voidWhaleReached'

export function voidLeg(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[VOID_LEG_KEY] ?? 0))
}

export function voidWaypoint(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[VOID_WAYPOINT_KEY] ?? 0))
}

/** Whether the empty coordinate has been reached (the whale swallowed you) — reads the flag. */
export function voidReached(state: GameState): boolean {
  return state.flags[VOID_REACHED_FLAG] === true
}

/** The leg currently being plotted (an ordered run of bearing ids), or null once reached. */
export function currentVoidLeg(
  state: GameState,
  legs: readonly (readonly string[])[],
): readonly string[] | null {
  return legs[voidLeg(state)] ?? null
}

/** The next bearing the leg expects (the one your pick should match now), or null once reached. */
export function expectedVoidBearing(
  state: GameState,
  legs: readonly (readonly string[])[],
): string | null {
  if (voidReached(state)) return null
  const leg = currentVoidLeg(state, legs)
  return leg?.[voidWaypoint(state)] ?? null
}

export interface VoidPlotResult {
  readonly ok: boolean
  readonly state: GameState
  /** Was the picked bearing the leg's expected next. */
  readonly correct: boolean
  /** True on the pick that completed the current leg (the next leg opens). */
  readonly legComplete: boolean
  /** True on the pick that completed the final leg (the coordinate is reached; the whale takes you). */
  readonly reached: boolean
}

/**
 * Plot one bearing into the current leg. A correct pick advances; completing a leg's full run steps to the next
 * leg (or, on the final leg, reaches the coordinate and sets the flag). A wrong pick loses the leg's run (plot
 * back to 0), so the crossing can never soft-lock. No-op (SAME reference, ok:false) once already reached.
 * Immutable — mirrors engine/content/reefVoyage.plotWaypoint.
 */
export function plotVoidBearing(
  state: GameState,
  bearingId: string,
  legs: readonly (readonly string[])[],
): VoidPlotResult {
  if (voidReached(state)) {
    return { ok: false, state, correct: false, legComplete: false, reached: false }
  }

  const leg = currentVoidLeg(state, legs)
  if (!leg) {
    return { ok: false, state, correct: false, legComplete: false, reached: false }
  }

  if (bearingId !== leg[voidWaypoint(state)]) {
    // The bearing drifts wide — restart this leg's run (setNumber no-ops if already 0).
    const reset = setNumber(state, VOID_WAYPOINT_KEY, 0)
    return { ok: true, state: reset, correct: false, legComplete: false, reached: false }
  }

  const plotted = voidWaypoint(state) + 1
  if (plotted < leg.length) {
    return { ok: true, state: setNumber(state, VOID_WAYPOINT_KEY, plotted), correct: true, legComplete: false, reached: false }
  }

  const nextLeg = voidLeg(state) + 1
  const advanced = setNumber(setNumber(state, VOID_LEG_KEY, nextLeg), VOID_WAYPOINT_KEY, 0)
  if (nextLeg < legs.length) {
    return { ok: true, state: advanced, correct: true, legComplete: true, reached: false }
  }

  const reached: GameState = { ...advanced, flags: { ...advanced.flags, [VOID_REACHED_FLAG]: true } }
  return { ok: true, state: reached, correct: true, legComplete: true, reached: true }
}

// --- the optional whale fight (telegraph-and-sever, reads the equipped hand weapon) ---------------------

export type WhaleAction = 'strike' | 'brace'
export type WhaleOutcome = 'won' | 'lost' | null

/** Your fighting hand as the fight reads it off the equipped weapon. */
export interface WhaleWeapon {
  readonly damage: number
  /** Reach in range bands — a tooth at dist <= reach can be shattered. */
  readonly reach: number
  /** Swings per turn (a fast weapon strikes twice). */
  readonly strikes: number
}

/** One of the whale's teeth: its remaining hp and the range band it currently grinds at. */
export interface Tooth {
  readonly id: number
  readonly hp: number
  readonly dist: number
}

export interface WhaleState {
  readonly yourHp: number
  readonly yourMaxHp: number
  readonly teeth: readonly Tooth[]
  /** Turns resolved so far (the throat closes at MAX_TURNS). */
  readonly turn: number
  readonly weapon: WhaleWeapon
}

/**
 * Kept in lock-step with content/flags.VOID_WHALE_DEFEATED_FLAG (content owns the named constant — the
 * moonStrata idiom). The engine reads the literal here rather than importing the content value (ADR §3).
 */
const VOID_WHALE_DEFEATED_FLAG = 'voidWhaleDefeated'

/** Whether the whale has been beaten in the optional fight (the void pearl granted — commit-once). */
export function voidWhaleDefeated(state: GameState): boolean {
  return state.flags[VOID_WHALE_DEFEATED_FLAG] === true
}

/** Read your fighting hand off the equipped weapon (or bare hands). Pure. */
export function deriveWhaleWeapon(state: GameState): WhaleWeapon {
  const w = meleeWeapon(state)[0]!
  return {
    damage: w.damage,
    reach: w.range,
    strikes: w.cooldownMs < FAST_COOLDOWN_MS ? 2 : 1,
  }
}

/** A fresh fight: you at full HP, the whale's teeth spread across the throat at their opening bands. */
export function createWhaleFight(state: GameState): WhaleState {
  const teeth = TOOTH_START_DIST.map((dist, id) => ({ id, hp: TOOTH_HP, dist }))
  return {
    yourHp: WHALE_PLAYER_HP,
    yourMaxHp: WHALE_PLAYER_HP,
    teeth,
    turn: 0,
    weapon: deriveWhaleWeapon(state),
  }
}

/** The fight's result, or null while it is still on. The teeth-cleared check comes FIRST (the killing stroke
 * beats simultaneous death — in practice the last tooth is the telegraphed one you just intercepted). */
export function whaleOutcome(state: WhaleState): WhaleOutcome {
  if (state.teeth.length === 0) return 'won'
  if (state.yourHp <= 0) return 'lost'
  if (state.turn >= MAX_TURNS) return 'lost' // the throat closed
  return null
}

/** The tooth the whale telegraphs as its next crusher — its farthest-back (longest-reaching) tooth, winding
 * up. Tie broken by id. null only when no teeth remain. The player aims by this; the e2e reads the data attr. */
export function telegraphedTooth(state: WhaleState): Tooth | null {
  let best: Tooth | null = null
  for (const t of state.teeth) {
    if (!best || t.dist > best.dist || (t.dist === best.dist && t.id < best.id)) best = t
  }
  return best
}

/** The tooth a STRIKE would land on: the telegraphed one if it is in reach (so its blow is INTERCEPTED), else
 * the nearest in-reach tooth (tie by id), else null — nothing is close enough and the swing whiffs. */
export function strikeTarget(state: WhaleState): Tooth | null {
  const reach = state.weapon.reach
  const telegraphed = telegraphedTooth(state)
  if (telegraphed && telegraphed.dist <= reach) return telegraphed

  let best: Tooth | null = null
  for (const t of state.teeth) {
    if (t.dist > reach) continue
    if (!best || t.dist < best.dist || (t.dist === best.dist && t.id < best.id)) best = t
  }
  return best
}

/**
 * Resolve one turn. You act first (STRIKE the auto-target for damage x strikes, shattering it if its hp hits 0;
 * or BRACE, making no progress). Then the telegraphed tooth crushes — UNLESS you swung AT it this turn (you
 * intercepted it) — for its band's crush, halved if you braced. Finally every surviving tooth grinds one band
 * closer. Pure — returns a new state; a no-op (SAME reference) once the fight is over. Mirrors krakenFight.
 */
export function resolveWhaleTurn(state: WhaleState, action: WhaleAction): WhaleState {
  if (whaleOutcome(state) !== null) return state

  const telegraphed = telegraphedTooth(state)
  const target = action === 'strike' ? strikeTarget(state) : null

  // 1. your action
  let teeth = state.teeth
  if (target) {
    const dealt = state.weapon.damage * state.weapon.strikes
    teeth = teeth
      .map((t) => (t.id === target.id ? { ...t, hp: t.hp - dealt } : t))
      .filter((t) => t.hp > 0)
  }

  // 2. the telegraphed tooth crushes, unless you intercepted it (swung at it — reach is the defence)
  const intercepted = target !== null && telegraphed !== null && target.id === telegraphed.id
  let yourHp = state.yourHp
  if (telegraphed !== null && !intercepted) {
    const blow = CRUSH_DMG_BY_DIST[telegraphed.dist] ?? 0
    yourHp -= action === 'brace' ? blow * BRACE_MULT : blow
  }

  // 3. survivors grind one band closer
  const advanced = teeth.map((t) => ({ ...t, dist: Math.max(MIN_DIST, t.dist - 1) }))

  return { ...state, teeth: advanced, yourHp, turn: state.turn + 1 }
}

// --- the optional drop (commit-once) --------------------------------------------------------------------

/**
 * Grant the void pearl exactly once, on the first whale win. Sets the cleared flag + the pearl (its own saveFlag
 * + ownedItems, via grantItem — the pearl has no slot, so it just banks as a keepsake). A second call (already
 * cleared) returns the SAME reference — farm-proof, the kraken/boarding idiom. Pure & immutable. The fight is
 * optional; forgoing it (leaving) simply forgoes the pearl — the shop + grimoire were never gated on it.
 */
export function grantWhaleReward(state: GameState): GameState {
  if (voidWhaleDefeated(state)) return state
  const cleared: GameState = {
    ...state,
    flags: { ...state.flags, [VOID_WHALE_DEFEATED_FLAG]: true },
  }
  return grantItem(cleared, VOID_PEARL)
}

// --- the black grimoire's eclipse world-spell -----------------------------------------------------------

/**
 * content/flags.BLACK_LICORICE_GRIMOIRE_OWNED_FLAG (the grimoire's saveFlag — one truth). Read in lock-step
 * (ADR §3) — the engine never imports the content value.
 */
const BLACK_LICORICE_GRIMOIRE_OWNED_FLAG = 'blackLicoriceGrimoireOwned'

/** Whether the black licorice grimoire is owned (its spells — incl. eclipse — are available). */
export function blackGrimoireOwned(state: GameState): boolean {
  return state.flags[BLACK_LICORICE_GRIMOIRE_OWNED_FLAG] === true
}

export interface EclipseResult {
  readonly ok: boolean
  readonly state: GameState
  readonly reason?: 'noGrimoire'
}

/**
 * Cast eclipse from the black grimoire: pause the star counter for a window (delegates to
 * starCounter.castEclipse — the drift-free temporary pause). Fails (SAME reference) without the grimoire owned.
 * A no-op at the star-counter level if the sky is frozen (ending 2) or never revealed. Immutable — the world
 * spell dispatched as a tested transition, not screen logic. Ties to the typed 'eclipse' secret (which goes
 * inert once the grimoire is owned).
 */
export function castGrimoireEclipse(state: GameState): EclipseResult {
  if (!blackGrimoireOwned(state)) return { ok: false, state, reason: 'noGrimoire' }
  return { ok: true, state: castEclipse(state) }
}

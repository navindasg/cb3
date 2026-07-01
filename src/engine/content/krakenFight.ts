import type { GameState } from '@/engine/types/GameState'
import { meleeWeapon } from '@/content/items/playerLoadout'
import {
  KRAKEN_PLAYER_HP,
  TENTACLE_HP,
  TENTACLE_START_DIST,
  MIN_DIST,
  STRIKE_DMG_BY_DIST,
  BRACE_MULT,
  FAST_COOLDOWN_MS,
  MAX_TURNS,
} from '@/content/planet/krakenFight'

// The sour kraken's telegraph-and-sever fight (Act 2 — DESIGN §10/§181). A pure, immutable, TRANSIENT
// turn-based sim (like the reef drift / comet chase / Sourbeard duel it never touches GameState; an
// abandoned or lost fight is forfeit, and only the cleared flag + the crown drop are persisted, owned by
// the screen). Deterministic (no RNG, no rAF). It reads your EQUIPPED HAND WEAPON via the quest loadout —
// reach decides which arms you can sever, damage how hard, and a fast weapon strikes twice a turn.

export type KrakenAction = 'strike' | 'brace'
export type KrakenOutcome = 'won' | 'lost' | null

/** Your fighting hand as the fight reads it off the equipped weapon. */
export interface FightWeapon {
  readonly damage: number
  /** Reach in range bands — an arm at dist <= reach can be severed. */
  readonly reach: number
  /** Swings per turn (a fast weapon strikes twice). */
  readonly strikes: number
}

/** One of the kraken's arms: its remaining hp and the range band it currently winds at. */
export interface Tentacle {
  readonly id: number
  readonly hp: number
  readonly dist: number
}

export interface KrakenState {
  readonly yourHp: number
  readonly yourMaxHp: number
  readonly tentacles: readonly Tentacle[]
  /** Turns resolved so far (the gas etches through you at MAX_TURNS). */
  readonly turn: number
  readonly weapon: FightWeapon
}

/** Read your fighting hand off the equipped weapon (or bare hands). Pure. */
export function deriveWeapon(state: GameState): FightWeapon {
  const w = meleeWeapon(state)[0]!
  return {
    damage: w.damage,
    reach: w.range,
    strikes: w.cooldownMs < FAST_COOLDOWN_MS ? 2 : 1,
  }
}

/** A fresh fight: you at full HP, the kraken's arms spread across the gas at their opening bands. */
export function createFight(state: GameState): KrakenState {
  const tentacles = TENTACLE_START_DIST.map((dist, id) => ({ id, hp: TENTACLE_HP, dist }))
  return {
    yourHp: KRAKEN_PLAYER_HP,
    yourMaxHp: KRAKEN_PLAYER_HP,
    tentacles,
    turn: 0,
    weapon: deriveWeapon(state),
  }
}

/** The fight's result, or null while it is still on. Checked on the resolved state. The arms-cleared
 * check comes FIRST: severing the last arm wins even on a turn you also took a blow (a deliberate tiebreak
 * — the killing stroke beats simultaneous death). In practice that arm is the telegraphed one you just
 * intercepted, so no blow lands anyway; the ordering only matters as a guarantee. */
export function fightOutcome(state: KrakenState): KrakenOutcome {
  if (state.tentacles.length === 0) return 'won'
  if (state.yourHp <= 0) return 'lost'
  if (state.turn >= MAX_TURNS) return 'lost' // the gas etched through — forced off the platform
  return null
}

/** The arm the kraken telegraphs as its next striker — its longest (farthest) reaching arm, winding up.
 * Tie broken by id for determinism. null only when no arms remain. The player aims by this; the e2e reads
 * it off the data attribute. */
export function telegraphedArm(state: KrakenState): Tentacle | null {
  let best: Tentacle | null = null
  for (const t of state.tentacles) {
    if (!best || t.dist > best.dist || (t.dist === best.dist && t.id < best.id)) best = t
  }
  return best
}

/** The arm a STRIKE would land on: the telegraphed one if it is in reach (so its blow is INTERCEPTED),
 * else the nearest in-reach arm (tie by id), else null — nothing is close enough and the swing whiffs. */
export function strikeTarget(state: KrakenState): Tentacle | null {
  const reach = state.weapon.reach
  const telegraphed = telegraphedArm(state)
  if (telegraphed && telegraphed.dist <= reach) return telegraphed

  let best: Tentacle | null = null
  for (const t of state.tentacles) {
    if (t.dist > reach) continue
    if (!best || t.dist < best.dist || (t.dist === best.dist && t.id < best.id)) best = t
  }
  return best
}

/**
 * Resolve one turn. You act first (STRIKE the auto-target for damage x strikes, severing it if its hp hits
 * 0; or BRACE, making no progress). Then the telegraphed arm strikes — UNLESS you swung AT it this turn
 * (you intercepted/parried it, whether or not the blow killed it) — for its band's blow, halved if you
 * braced. Finally every surviving arm advances one band closer. Pure — returns a new state; a no-op (SAME
 * reference) once the fight is over.
 */
export function resolveTurn(state: KrakenState, action: KrakenAction): KrakenState {
  if (fightOutcome(state) !== null) return state

  const telegraphed = telegraphedArm(state)
  const target = action === 'strike' ? strikeTarget(state) : null

  // 1. your action
  let tentacles = state.tentacles
  if (target) {
    const dealt = state.weapon.damage * state.weapon.strikes
    tentacles = tentacles
      .map((t) => (t.id === target.id ? { ...t, hp: t.hp - dealt } : t))
      .filter((t) => t.hp > 0)
  }

  // 2. the telegraphed arm strikes, unless you intercepted it (swung at it — reach is the defence)
  const intercepted = target !== null && telegraphed !== null && target.id === telegraphed.id
  let yourHp = state.yourHp
  if (telegraphed !== null && !intercepted) {
    const blow = STRIKE_DMG_BY_DIST[telegraphed.dist] ?? 0
    yourHp -= action === 'brace' ? blow * BRACE_MULT : blow
  }

  // 3. survivors advance one band closer
  const advanced = tentacles.map((t) => ({ ...t, dist: Math.max(MIN_DIST, t.dist - 1) }))

  return { ...state, tentacles: advanced, yourHp, turn: state.turn + 1 }
}

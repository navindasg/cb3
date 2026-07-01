import type { GameState } from '@/engine/types/GameState'
import { meleeWeapon } from '@/content/items/playerLoadout'
import {
  WOLF_PLAYER_HP,
  WOLF_HP,
  COUNTER_FACTOR,
  STRIKE_FACTOR,
  FAST_COOLDOWN_MS,
  MAX_TURNS,
  WOLF_PATTERN,
  type WolfMove,
} from '@/content/sky/cloudWolf'

// The cloud wolf's "read the pounce" sim (Phase 5 — hidden boss 1, DESIGN §17). A pure, immutable, TRANSIENT
// turn-based clinch (like the boarding melee / kraken it never touches GameState; an abandoned or lost fight is
// forfeit, and only the cleared flag + the cloak drop are persisted, owned by the screen). Deterministic (no
// RNG, no rAF). Reads your EQUIPPED HAND WEAPON: damage scales both your counter and your strike, a fast weapon
// swings twice; reach is irrelevant in the clinch. The wolf moves along a fixed telegraphed pattern (with
// feints); you read its crouch. This mirrors engine/content/boardingDuel one-for-one (its proven spine), and is
// grid-searched in the test so bare hands lose, all-strike loses for the common blades, and a forged blade with
// clean reads wins.

export type WolfAction = 'counter-lunge' | 'counter-snap' | 'strike'
export type WolfOutcome = 'won' | 'lost' | null

/**
 * Kept in lock-step with content/flags.CLOUD_WOLF_DEFEATED_FLAG (content owns the named constant — the
 * moonStrata idiom). The engine reads the literal here rather than importing the content value (ADR §3).
 */
const CLOUD_WOLF_DEFEATED_FLAG = 'cloudWolfDefeated'

/** Whether the cloud wolf has been beaten (the one-off drop granted, the fight retired — commit-once). */
export function cloudWolfDefeated(state: GameState): boolean {
  return state.flags[CLOUD_WOLF_DEFEATED_FLAG] === true
}

/**
 * Kept in lock-step with content/flags.STORM_IMMUNE_FLAG (which itself IS the wolf-wool cloak's saveFlag — one
 * truth, no duplication). The engine reads the literal here rather than importing the content value (ADR §3).
 */
const STORM_IMMUNE_FLAG = 'wolfWoolCloakOwned'

/** Whether the wolf-wool cloak is worn — the storm's charge can no longer find you. The storm front reads
 * this to soften the climb (a LATE curiosity reward, never a gate; the storm was always beatable without it). */
export function stormImmune(state: GameState): boolean {
  return state.flags[STORM_IMMUNE_FLAG] === true
}

/** The player's effective max HP for the storm-front climb: the base derived HP, generously boosted while the
 * wolf-wool cloak is worn (the storm can't touch you). A pure helper the storm-front runner reads so the cloak
 * retroactively trivializes the climb. `STORM_IMMUNE_HP_FACTOR` is the multiplier (a wide, forgiving cushion —
 * the point is that the front simply cannot kill you in wolf-wool, not a fine-tuned buff). */
export const STORM_IMMUNE_HP_FACTOR = 4

export function stormFrontMaxHp(state: GameState, baseMaxHp: number): number {
  return stormImmune(state) ? Math.round(baseMaxHp * STORM_IMMUNE_HP_FACTOR) : baseMaxHp
}

/** Your fighting hand as the clinch reads it off the equipped weapon (reach is irrelevant here). */
export interface WolfWeapon {
  readonly damage: number
  /** Swings per exchange (a fast weapon counters/strikes twice). */
  readonly strikes: number
}

export interface WolfState {
  readonly yourHp: number
  readonly yourMaxHp: number
  readonly foeHp: number
  readonly foeMaxHp: number
  /** Exchanges resolved so far (the wolf wears you down at MAX_TURNS). */
  readonly turn: number
  readonly weapon: WolfWeapon
}

/** Read your fighting hand off the equipped weapon (or bare hands). Pure. */
export function deriveWolfWeapon(state: GameState): WolfWeapon {
  const w = meleeWeapon(state)[0]!
  return { damage: w.damage, strikes: w.cooldownMs < FAST_COOLDOWN_MS ? 2 : 1 }
}

/** A fresh clinch: you at full HP, the wolf at its HP, its pattern at the first beat. */
export function createWolfFight(state: GameState): WolfState {
  return {
    yourHp: WOLF_PLAYER_HP,
    yourMaxHp: WOLF_PLAYER_HP,
    foeHp: WOLF_HP,
    foeMaxHp: WOLF_HP,
    turn: 0,
    weapon: deriveWolfWeapon(state),
  }
}

/** The move the wolf makes this exchange (loops the pattern if the clinch runs long). */
export function moveFor(turn: number): (typeof WOLF_PATTERN)[number] {
  return WOLF_PATTERN[turn % WOLF_PATTERN.length]!
}

/** The clinch's result, or null while it is still on. Checked on the resolved state. The foe-down check comes
 * first: the killing bite beats a simultaneous one. */
export function wolfOutcome(state: WolfState): WolfOutcome {
  if (state.foeHp <= 0) return 'won'
  if (state.yourHp <= 0) return 'lost'
  if (state.turn >= MAX_TURNS) return 'lost' // it wore you down
  return null
}

/**
 * Resolve one exchange. COUNTER a move: if it matches the wolf's ACTUAL move you turn it (no damage) and cut
 * for COUNTER_FACTOR x damage x strikes; if you mis-read (or it feinted), the move lands for its bite and you
 * do not cut. STRIKE: deal STRIKE_FACTOR x damage x strikes, but you are committed — its move always lands.
 * Pure — returns a new state; a no-op (SAME reference) once the clinch is over.
 */
export function resolveWolfExchange(state: WolfState, action: WolfAction): WolfState {
  if (wolfOutcome(state) !== null) return state

  const beat = moveFor(state.turn)
  const counter = COUNTER_FACTOR * state.weapon.damage * state.weapon.strikes
  const strike = STRIKE_FACTOR * state.weapon.damage * state.weapon.strikes

  let foeHp = state.foeHp
  let yourHp = state.yourHp

  if (action === 'strike') {
    foeHp -= strike
    yourHp -= beat.bite // committed: the move always lands
  } else {
    const guess: WolfMove = action === 'counter-lunge' ? 'lunge' : 'snap'
    if (guess === beat.move) {
      foeHp -= counter // read it right: turn it + cut
    } else {
      yourHp -= beat.bite // mis-read (or feinted): the move lands, no cut
    }
  }

  return { ...state, foeHp, yourHp, turn: state.turn + 1 }
}

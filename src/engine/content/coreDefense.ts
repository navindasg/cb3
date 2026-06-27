import type { GameState } from '@/engine/types/GameState'
import { playerQuestWeapons } from '@/content/items/playerLoadout'
import {
  EGG_HP,
  CORE_PLAYER_HP,
  CORE_EATER_HP,
  CORE_FAST_COOLDOWN_MS,
  GUARD_RIPOSTE_FACTOR,
  STRIKE_FACTOR,
  CLAW_EGG_DAMAGE,
  CLAW_PLAYER_DAMAGE,
  CLAW_PATTERN,
  CORE_MAX_TURNS,
  type Claw,
  type ClawLine,
} from '@/content/sun/starEater'

// The core-defense sim (Act 4 — quest 13's phase 3, DESIGN §198). A pure, immutable, TRANSIENT turn-based
// sim — like the kraken telegraph-and-sever / the boarding melee it never touches GameState; an abandoned or
// lost defense is forfeit, and only the star-eater-defeated flag persists (set by the orchestrator on the
// phase-3 clear). Deterministic (no RNG, no rAF). It reads your EQUIPPED HAND WEAPON via the quest loadout,
// the same as the kraken/boarding fights — damage scales your riposte + strike, a fast weapon swings twice.
//
// DELIBERATE MODEL CHOICE: a telegraph-and-BLOCK variant of the kraken fight, with the EGG as the thing
// defended (a new stat axis: you are not protecting your own HP so much as the egg behind you). Each turn the
// eater telegraphs a high/low claw (mostly honest, with feints). You GUARD the line it will ACTUALLY take —
// blocking the egg AND biting the eater back — or STRIKE for more damage but let the claw rake the egg (and
// you). Naive all-strike never guards, so the egg dies (grid-searched: all-strike LOSES); a forged blade
// with clean reads drives the eater off inside the clock. Win by dropping the eater's HP to 0; lose if the
// egg's HP or yours hits 0, or the clock (CORE_MAX_TURNS) runs out (the eater overwhelms the egg).

export type CoreAction = 'guard-high' | 'guard-low' | 'strike'
export type CoreOutcome = 'won' | 'lost' | null

/** Your fighting hand as the defense reads it off the equipped weapon (reach is irrelevant here). */
export interface CoreWeapon {
  readonly damage: number
  /** Swings per turn (a fast weapon ripostes/strikes twice). */
  readonly strikes: number
}

export interface CoreDefenseState {
  readonly yourHp: number
  readonly yourMaxHp: number
  /** The egg's hp — what you are defending. The phase is lost if it reaches 0. */
  readonly eggHp: number
  readonly eggMaxHp: number
  readonly eaterHp: number
  readonly eaterMaxHp: number
  /** Turns resolved so far (the eater overwhelms the egg at CORE_MAX_TURNS). */
  readonly turn: number
  readonly weapon: CoreWeapon
}

/** Read your fighting hand off the equipped weapon (or bare hands). Pure. */
export function deriveCoreWeapon(state: GameState): CoreWeapon {
  const w = playerQuestWeapons(state)[0]!
  return { damage: w.damage, strikes: w.cooldownMs < CORE_FAST_COOLDOWN_MS ? 2 : 1 }
}

/** A fresh core defense: you and the egg at full HP, the eater at its core-phase HP, the claws at the first. */
export function createCoreDefense(state: GameState): CoreDefenseState {
  return {
    yourHp: CORE_PLAYER_HP,
    yourMaxHp: CORE_PLAYER_HP,
    eggHp: EGG_HP,
    eggMaxHp: EGG_HP,
    eaterHp: CORE_EATER_HP,
    eaterMaxHp: CORE_EATER_HP,
    turn: 0,
    weapon: deriveCoreWeapon(state),
  }
}

/** The claw the eater is making this turn (loops the pattern if the phase runs long). */
export function clawFor(turn: number): Claw {
  return CLAW_PATTERN[turn % CLAW_PATTERN.length]!
}

/**
 * The phase's result, or null while it is still on. Checked on the resolved state. The eater-down check comes
 * FIRST: driving it off on the same turn a claw also lands still WINS (the killing blow beats simultaneity —
 * the kraken/boarding tiebreak). Then the egg gone, you gone, or the clock run out is a loss.
 */
export function coreOutcome(state: CoreDefenseState): CoreOutcome {
  if (state.eaterHp <= 0) return 'won'
  if (state.eggHp <= 0) return 'lost' // the egg was overwhelmed
  if (state.yourHp <= 0) return 'lost' // you were torn off it
  if (state.turn >= CORE_MAX_TURNS) return 'lost' // the eater got past you
  return null
}

/**
 * Resolve one turn. GUARD a line: if it matches the claw's ACTUAL line you turn it (the egg is unharmed) and
 * riposte for GUARD_RIPOSTE_FACTOR x damage x strikes; if you mis-read (or it feinted) the claw rakes the egg
 * (CLAW_EGG_DAMAGE) and you (CLAW_PLAYER_DAMAGE), no riposte. STRIKE: deal STRIKE_FACTOR x damage x strikes,
 * but you are not guarding — the claw always lands on the egg and you. Pure — returns a new state; a no-op
 * (SAME reference) once the phase is over.
 */
export function resolveCoreTurn(state: CoreDefenseState, action: CoreAction): CoreDefenseState {
  if (coreOutcome(state) !== null) return state

  const claw = clawFor(state.turn)
  const riposte = GUARD_RIPOSTE_FACTOR * state.weapon.damage * state.weapon.strikes
  const strike = STRIKE_FACTOR * state.weapon.damage * state.weapon.strikes

  let eaterHp = state.eaterHp
  let eggHp = state.eggHp
  let yourHp = state.yourHp

  if (action === 'strike') {
    eaterHp -= strike
    eggHp -= CLAW_EGG_DAMAGE // not guarding: the claw rakes the egg
    yourHp -= CLAW_PLAYER_DAMAGE
  } else {
    const guardLine: ClawLine = action === 'guard-high' ? 'high' : 'low'
    if (guardLine === claw.line) {
      eaterHp -= riposte // read it right: turn the claw + bite back, the egg is safe
    } else {
      eggHp -= CLAW_EGG_DAMAGE // mis-read (or feinted): the claw gets past, no riposte
      yourHp -= CLAW_PLAYER_DAMAGE
    }
  }

  return { ...state, eaterHp, eggHp, yourHp, turn: state.turn + 1 }
}

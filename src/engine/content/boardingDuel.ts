import type { GameState } from '@/engine/types/GameState'
import { playerQuestWeapons } from '@/content/items/playerLoadout'
import { sourbeardRetired } from '@/engine/content/shipDuel'
import {
  BOARDING_PLAYER_HP,
  SOURBEARD_MELEE_HP,
  RIPOSTE_FACTOR,
  LUNGE_FACTOR,
  FAST_COOLDOWN_MS,
  MAX_TURNS,
  CUT_PATTERN,
  type Cut,
  type CutLine,
} from '@/content/ship/boardingDuel'

// The boarding melee's guard/lunge fencing sim (Act 2 — DESIGN §127/§179). A pure, immutable, TRANSIENT
// turn-based duel (like the broadside / drift / kraken it never touches GameState; an abandoned or lost
// boarding is forfeit, and only the retirement flag + the drops are persisted, owned by the screen).
// Deterministic (no RNG, no rAF). Reads your EQUIPPED HAND WEAPON: damage scales riposte + lunge, a fast
// weapon strikes twice. Sourbeard cuts along a fixed telegraphed pattern (with feints); you read it.

export type BoardingAction = 'guard-high' | 'guard-low' | 'lunge'
export type BoardingOutcome = 'won' | 'lost' | null

/**
 * Kept in lock-step with content/flags.SOURBEARD_BOARDED_FLAG (content owns the named constant — the
 * moonStrata idiom). The engine reads the literal here rather than importing the content value (ADR §3).
 */
const SOURBEARD_BOARDED_FLAG = 'sourbeardBoarded'

/** Whether Sourbeard has been bested in the on-foot melee (the rival fully retired — the §17 end). */
export function sourbeardBoarded(state: GameState): boolean {
  return state.flags[SOURBEARD_BOARDED_FLAG] === true
}

/** Whether the boarding melee is available now: the broadside arc is won (3 defeats) but you have not yet
 * faced him on the deck. The third broadside doesn't end it — he boards you. */
export function boardingAvailable(state: GameState): boolean {
  return sourbeardRetired(state) && !sourbeardBoarded(state)
}

/** Your fighting hand as the bout reads it off the equipped weapon (reach is irrelevant on foot). */
export interface MeleeWeapon {
  readonly damage: number
  /** Swings per exchange (a fast weapon ripostes/lunges twice). */
  readonly strikes: number
}

export interface BoardingState {
  readonly yourHp: number
  readonly yourMaxHp: number
  readonly foeHp: number
  readonly foeMaxHp: number
  /** Exchanges resolved so far (his crew swarms you at MAX_TURNS). */
  readonly turn: number
  readonly weapon: MeleeWeapon
}

/** Read your fighting hand off the equipped weapon (or bare hands). Pure. */
export function deriveMeleeWeapon(state: GameState): MeleeWeapon {
  const w = playerQuestWeapons(state)[0]!
  return { damage: w.damage, strikes: w.cooldownMs < FAST_COOLDOWN_MS ? 2 : 1 }
}

/** A fresh boarding: you at full HP, Sourbeard at his melee HP, his bout at the first cut. */
export function createBoarding(state: GameState): BoardingState {
  return {
    yourHp: BOARDING_PLAYER_HP,
    yourMaxHp: BOARDING_PLAYER_HP,
    foeHp: SOURBEARD_MELEE_HP,
    foeMaxHp: SOURBEARD_MELEE_HP,
    turn: 0,
    weapon: deriveMeleeWeapon(state),
  }
}

/** The cut Sourbeard is making this exchange (loops the pattern if the bout runs long). */
export function cutFor(turn: number): Cut {
  return CUT_PATTERN[turn % CUT_PATTERN.length]!
}

/** The bout's result, or null while it is still on. Checked on the resolved state. The foe-down check
 * comes first: the killing thrust beats a simultaneous cut. `maxTurns` defaults to Sourbeard's MAX_TURNS;
 * the star-eater finale reuses this sim on its OWN (longer) clock by passing EATER_ONFOOT_MAX_TURNS (the live
 * Sourbeard fight always uses the default, so its tuning is untouched). */
export function boardingOutcome(state: BoardingState, maxTurns: number = MAX_TURNS): BoardingOutcome {
  if (state.foeHp <= 0) return 'won'
  if (state.yourHp <= 0) return 'lost'
  if (state.turn >= maxTurns) return 'lost' // his crew overran you
  return null
}

/**
 * Resolve one exchange. GUARD a line: if it matches his ACTUAL cut you block it (no damage) and riposte for
 * RIPOSTE_FACTOR x damage x strikes; if you mis-read (or he feinted), the cut lands for its dmg and you do
 * not riposte. LUNGE: deal LUNGE_FACTOR x damage x strikes, but you are committed — the cut always lands.
 * Pure — returns a new state; a no-op (SAME reference) once the bout is over. `maxTurns` defaults to
 * Sourbeard's MAX_TURNS; the finale passes its own longer clock so the bout does not freeze at turn 16.
 */
export function resolveExchange(
  state: BoardingState,
  action: BoardingAction,
  maxTurns: number = MAX_TURNS,
): BoardingState {
  if (boardingOutcome(state, maxTurns) !== null) return state

  const cut = cutFor(state.turn)
  const riposte = RIPOSTE_FACTOR * state.weapon.damage * state.weapon.strikes
  const lunge = LUNGE_FACTOR * state.weapon.damage * state.weapon.strikes

  let foeHp = state.foeHp
  let yourHp = state.yourHp

  if (action === 'lunge') {
    foeHp -= lunge
    yourHp -= cut.dmg // committed: the cut always lands
  } else {
    const guardLine: CutLine = action === 'guard-high' ? 'high' : 'low'
    if (guardLine === cut.line) {
      foeHp -= riposte // read it right: block + riposte
    } else {
      yourHp -= cut.dmg // mis-read (or feinted): the cut lands, no riposte
    }
  }

  return { ...state, foeHp, yourHp, turn: state.turn + 1 }
}

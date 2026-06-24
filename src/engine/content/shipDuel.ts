import type { GameState } from '@/engine/types/GameState'
import { trackTier } from '@/engine/content/galleonUpgrade'
import {
  GALLEON_HULL_KEY,
  GALLEON_SAILS_KEY,
  GALLEON_CANNON_KEY,
} from '@/content/ship/galleonUpgrade'
import {
  HULL_HP,
  CANNON_DAMAGE,
  SAIL_EVASION,
  SAIL_FULL_SLIP_TIER,
  YOUR_RANGE_MULT,
  FOE_RANGE_MULT,
  FOE_BASE_HP,
  FOE_HP_PER_DEFEAT,
  FOE_BASE_SHOT,
  FOE_SHOT_PER_DEFEAT,
  START_RANGE,
  RANGE_CLOSE,
  RANGE_LONG,
  FOE_CLOSE_EVERY,
  MAX_ROUNDS,
  MAX_DEFEATS,
  SOURBEARD_DEFEATS_KEY,
} from '@/content/ship/shipDuel'

// Captain Sourbeard's broadside duel (Act 2 — DESIGN §127/§179). A pure, immutable, TRANSIENT turn-based
// 2-ship sim — like the reef drift / comet chase it never touches GameState; an abandoned duel is forfeit,
// and only the defeat counter + loot are persisted (owned by the screen). Deterministic (no RNG, no rAF):
// each round one maneuver resolves synchronously. EVERY maneuver fires your broadside; they differ only in
// the range they leave you at (and a veer slips the foe's reply). The foe drifts closer over time and
// boards you (a loss) if not sunk within MAX_ROUNDS. Reads the shipwright's-yard tiers via galleonUpgrade.

export type Maneuver = 'press' | 'hold' | 'veer'
export type DuelOutcome = 'won' | 'lost' | null

/** Your ship as the duel reads it from the yard tiers (hull -> HP, cannon -> damage, sails -> evasion). */
export interface ShipStats {
  readonly maxHp: number
  readonly damage: number
  /** Incoming-damage multiplier (lower is better). */
  readonly evasion: number
  /** Whether a veer fully slips the foe's shot (else it only halves it). */
  readonly fullSlip: boolean
}

export interface DuelState {
  readonly yourHp: number
  readonly yourMaxHp: number
  readonly foeHp: number
  readonly foeMaxHp: number
  /** The Black Lollipop's broadside this encounter (escalates per prior defeat — fixed for the duel). */
  readonly foeShot: number
  /** Range band: 0 = long .. 2 = point-blank. */
  readonly range: number
  /** Rounds resolved so far (the crew boards at MAX_ROUNDS). */
  readonly round: number
  readonly stats: ShipStats
}

/** Read your fighting stats off the shipwright's-yard tiers. Pure. */
export function deriveStats(state: GameState): ShipStats {
  const hull = trackTier(state, GALLEON_HULL_KEY)
  const cannon = trackTier(state, GALLEON_CANNON_KEY)
  const sail = trackTier(state, GALLEON_SAILS_KEY)
  return {
    maxHp: HULL_HP[hull] ?? HULL_HP[1]!,
    damage: CANNON_DAMAGE[cannon] ?? CANNON_DAMAGE[1]!,
    evasion: SAIL_EVASION[sail] ?? SAIL_EVASION[1]!,
    fullSlip: sail >= SAIL_FULL_SLIP_TIER,
  }
}

/** How many times Sourbeard has been beaten (clamped to [0, MAX_DEFEATS]). */
export function sourbeardDefeats(state: GameState): number {
  return Math.min(MAX_DEFEATS, Math.max(0, Math.floor(state.numbers[SOURBEARD_DEFEATS_KEY] ?? 0)))
}

/** Whether the rival is retired for this slice (beaten the full arc). */
export function sourbeardRetired(state: GameState): boolean {
  return sourbeardDefeats(state) >= MAX_DEFEATS
}

/** The Black Lollipop's HP for the coming encounter — escalates with each prior defeat. */
export function foeHpFor(defeats: number): number {
  return FOE_BASE_HP + defeats * FOE_HP_PER_DEFEAT
}

/** The Black Lollipop's broadside for the coming encounter — escalates with each prior defeat. */
export function foeShotFor(defeats: number): number {
  return FOE_BASE_SHOT + defeats * FOE_SHOT_PER_DEFEAT
}

/** A fresh duel: your ship at full hull, the Black Lollipop scaled to the next encounter, at long range. */
export function createDuel(state: GameState): DuelState {
  const stats = deriveStats(state)
  const defeats = sourbeardDefeats(state)
  const foeMaxHp = foeHpFor(defeats)
  return {
    yourHp: stats.maxHp,
    yourMaxHp: stats.maxHp,
    foeHp: foeMaxHp,
    foeMaxHp,
    foeShot: foeShotFor(defeats),
    range: START_RANGE,
    round: 0,
    stats,
  }
}

/** The duel's result, or null while it is still being fought. Checked on the resolved state. */
export function duelOutcome(state: DuelState): DuelOutcome {
  if (state.foeHp <= 0) return 'won'
  if (state.yourHp <= 0) return 'lost'
  if (state.round >= MAX_ROUNDS) return 'lost' // boarded — you dithered
  return null
}

/**
 * Resolve one maneuver. The range moves first (press closes, veer opens, hold holds), then YOU fire your
 * broadside at the resulting range; if that sinks the Black Lollipop the duel is won and she makes no
 * reply. Otherwise she fires back (a veer slips/halves her shot by your sails), then drifts one band
 * closer on the cadence. Pure — returns a new state; a no-op (SAME reference) once the duel is over.
 */
export function resolveManeuver(state: DuelState, maneuver: Maneuver): DuelState {
  if (duelOutcome(state) !== null) return state

  const range =
    maneuver === 'press'
      ? Math.min(RANGE_CLOSE, state.range + 1)
      : maneuver === 'veer'
        ? Math.max(RANGE_LONG, state.range - 1)
        : state.range

  const foeHp = state.foeHp - state.stats.damage * (YOUR_RANGE_MULT[range] ?? 1)
  if (foeHp <= 0) {
    return { ...state, range, foeHp, round: state.round + 1 }
  }

  const slip = maneuver === 'veer' ? (state.stats.fullSlip ? 0 : 0.5) : 1
  const incoming = state.foeShot * (FOE_RANGE_MULT[range] ?? 1) * state.stats.evasion * slip
  const yourHp = state.yourHp - incoming

  const round = state.round + 1
  const drifted = round % FOE_CLOSE_EVERY === 0 ? Math.min(RANGE_CLOSE, range + 1) : range
  return { ...state, range: drifted, foeHp, yourHp, round }
}

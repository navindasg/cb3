import type { GameState } from '@/engine/types/GameState'
import { setFlag } from '@/engine/state/reducers'
import { deriveStats, type DuelState } from '@/engine/content/shipDuel'
import {
  deriveMeleeWeapon,
  boardingOutcome,
  resolveExchange,
  type BoardingState,
  type BoardingAction,
  type BoardingOutcome,
} from '@/engine/content/boardingDuel'
import { createCoreDefense, type CoreDefenseState } from '@/engine/content/coreDefense'
import { START_RANGE } from '@/content/ship/shipDuel'
import {
  EATER_SHIP_HP,
  EATER_SHIP_SHOT,
  EATER_ONFOOT_PLAYER_HP,
  EATER_ONFOOT_HP,
  EATER_ONFOOT_MAX_TURNS,
} from '@/content/sun/starEater'

// The star-eater orchestrator (Act 4 — quest 13, the finale, DESIGN §198/§286). Pure & immutable. It
// SEQUENCES the three-phase finale by REUSING the existing fight engines rather than re-implementing them:
//  - phase 1 (broadside): builds a DuelState off the galleon's MAXED tiers (shipDuel.deriveStats) vs a fresh
//    escalated eater foe (EATER_SHIP_HP/SHOT — NOT Sourbeard's foeHpFor), driven by shipDuel.resolveManeuver
//    / duelOutcome (which read only the DuelState — they never re-read GameState, so the fresh foe is honest).
//  - phase 2 (on foot): builds a BoardingState off the equipped weapon (boardingDuel.deriveMeleeWeapon) at a
//    HIGHER eater HP (EATER_ONFOOT_HP) so it reads as the climax, driven by boardingDuel.resolveExchange /
//    boardingOutcome (the cut cadence is the generic high/low feint pattern — the freshness is the HP wall).
//  - phase 3 (the core): the new coreDefense sim (createCoreDefense / resolveCoreTurn / coreOutcome).
//
// The phase cursor is a transient {phase,won,lost} record the SCREEN holds for a single visit — like every
// Act-2/3 fight it is NEVER persisted; an abandoned or lost fight is forfeit and the whole thing restarts
// (the shipDuel/boardingDuel idiom). The ONLY persistent change is winStarEater, set commit-once in ONE
// dispatch on the phase-3 clear (the witnessStarDie idiom — SAME reference forever after). The mid-fight
// reveal (§3/§286) is surfaced exactly once at the phase-2 -> phase-3 boundary, latched by a one-shot
// presentation flag (not a gate). The engine reads no content FLAG value: it re-declares the two flags as
// string literals in lock-step with content/flags' STAR_EATER_DEFEATED_FLAG / EATER_COUNTER_SHOWN_FLAG (the
// moonStrata idiom, ADR §3). It MAY reuse sibling engine derivations + import content CONFIG data (allowed).

/**
 * Kept in lock-step with content/flags.STAR_EATER_DEFEATED_FLAG (content owns the named constant — the
 * moonStrata idiom; the engine re-declares the literal rather than importing the content value, ADR §3). Set
 * commit-once on the phase-3 clear.
 */
const STAR_EATER_DEFEATED_FLAG = 'starEaterDefeated'

/**
 * Kept in lock-step with content/flags.EATER_COUNTER_SHOWN_FLAG (the moonStrata idiom). The one-shot
 * presentation latch for the §286 reveal — set the first time the counter is surfaced, never a gate.
 */
const EATER_COUNTER_SHOWN_FLAG = 'eaterCounterShown'

/** The three phases of the finale, in order, plus the terminal results. The cursor is transient. */
export type StarEaterPhase = 'broadside' | 'onFoot' | 'core'

/** The transient phase cursor the screen carries for one visit (never persisted — the shipDuel idiom). */
export interface StarEaterProgress {
  readonly phase: StarEaterPhase
  /** The whole fight is won (phase 3 cleared) — the screen commits winStarEater and routes to the choice. */
  readonly won: boolean
  /** A phase was lost — the whole fight forfeits (transient); the screen offers a fresh start. */
  readonly lost: boolean
}

/** A fresh fight: at the broadside, neither won nor lost. */
export function createStarEater(): StarEaterProgress {
  return { phase: 'broadside', won: false, lost: false }
}

/** Whether the star-eater has been driven off (the finale won) — reads the flag. Strict === true. */
export function starEaterDefeated(state: GameState): boolean {
  return state.flags[STAR_EATER_DEFEATED_FLAG] === true
}

/** Whether the mid-fight candy-counter reveal has already been shown (the one-shot latch is set). Strict ===. */
export function eaterCounterShown(state: GameState): boolean {
  return state.flags[EATER_COUNTER_SHOWN_FLAG] === true
}

/**
 * Reach: the finale is available once the solar dragon has been met (Quest 12's commit-once flag) and the
 * eater has not already been driven off. A pure derivation the screen reads. The solar-dragon flag is read
 * as a literal in lock-step with content/flags.SOLAR_DRAGON_MET_FLAG (the moonStrata idiom, ADR §3).
 */
export function starEaterAvailable(state: GameState): boolean {
  return state.flags['solarDragonMet'] === true && !starEaterDefeated(state)
}

// --- phase 1: the broadside (reuses the shipDuel sim against a fresh eater foe) ------------------------

/**
 * A fresh broadside phase: your galleon at its derived stats (shipDuel.deriveStats reads the MAXED hull/
 * cannon/sail tiers), the star-eater scaled to its escalated finale HP/shot (NOT Sourbeard's numbers). The
 * returned DuelState is then driven by shipDuel.resolveManeuver / duelOutcome, which read only the DuelState.
 */
export function createBroadside(state: GameState): DuelState {
  const stats = deriveStats(state)
  return {
    yourHp: stats.maxHp,
    yourMaxHp: stats.maxHp,
    foeHp: EATER_SHIP_HP,
    foeMaxHp: EATER_SHIP_HP,
    foeShot: EATER_SHIP_SHOT,
    range: START_RANGE,
    round: 0,
    stats,
  }
}

// --- phase 2: on foot, on the creature (reuses the boarding melee against a higher eater HP) -----------

/**
 * A fresh on-foot phase: you at the eater on-foot HP pool, the star-eater at its higher melee HP (so this
 * reads as the climax, not a Sourbeard rerun), your fighting hand read off the equipped weapon
 * (boardingDuel.deriveMeleeWeapon). The returned BoardingState is driven by boardingDuel.resolveExchange /
 * boardingOutcome — reusing Sourbeard's cut cadence (the generic high/low feint pattern).
 */
export function createOnFoot(state: GameState): BoardingState {
  return {
    yourHp: EATER_ONFOOT_PLAYER_HP,
    yourMaxHp: EATER_ONFOOT_PLAYER_HP,
    foeHp: EATER_ONFOOT_HP,
    foeMaxHp: EATER_ONFOOT_HP,
    turn: 0,
    weapon: deriveMeleeWeapon(state),
  }
}

/**
 * The on-foot phase's outcome on the FINALE clock (EATER_ONFOOT_MAX_TURNS — longer than Sourbeard's, so the
 * higher eater HP is clearable by a slow blade with clean reads while all-lunge still dies to the dangerous
 * feint). A thin wrapper over boardingDuel.boardingOutcome with the finale's clock baked in — the screen and
 * the balance test read THIS so phase 2 never freezes at Sourbeard's turn 16.
 */
export function onFootOutcome(state: BoardingState): BoardingOutcome {
  return boardingOutcome(state, EATER_ONFOOT_MAX_TURNS)
}

/**
 * Resolve one on-foot exchange on the FINALE clock — a thin wrapper over boardingDuel.resolveExchange with
 * EATER_ONFOOT_MAX_TURNS, so the bout runs to the finale's longer timer rather than Sourbeard's. Pure &
 * immutable (a no-op SAME reference once the phase is over), exactly as the underlying sim.
 */
export function resolveOnFoot(state: BoardingState, action: BoardingAction): BoardingState {
  return resolveExchange(state, action, EATER_ONFOOT_MAX_TURNS)
}

// --- phase 3: the core defense (the new coreDefense sim) -----------------------------------------------

/** A fresh core-defense phase — re-exported from coreDefense for the orchestrator's surface. */
export function createCore(state: GameState): CoreDefenseState {
  return createCoreDefense(state)
}

// --- the phase cursor + the mid-fight reveal -----------------------------------------------------------

/**
 * Advance the phase cursor on a phase WIN. Broadside -> onFoot -> core -> won. A no-op (SAME reference) once
 * the fight is already won or lost. Pure & immutable. The screen calls this when a phase's outcome is 'won'.
 */
export function advancePhase(progress: StarEaterProgress): StarEaterProgress {
  if (progress.won || progress.lost) return progress
  if (progress.phase === 'broadside') return { ...progress, phase: 'onFoot' }
  if (progress.phase === 'onFoot') return { ...progress, phase: 'core' }
  return { ...progress, won: true } // the core cleared — the whole fight is won
}

/**
 * Forfeit the fight on a phase LOSS (transient — the whole thing restarts; nothing persists). A no-op (SAME
 * reference) once already terminal. Pure & immutable.
 */
export function forfeit(progress: StarEaterProgress): StarEaterProgress {
  if (progress.won || progress.lost) return progress
  return { ...progress, lost: true }
}

/**
 * Whether the §286 candy-counter reveal should fire RIGHT NOW: the cursor is at the core phase (the phase-2
 * -> phase-3 boundary has just been crossed) AND the one-shot latch is unset. A pure predicate the screen
 * reads to surface the eater's counter exactly once. Made true only at the boundary; false forever after the
 * latch is set.
 */
export function shouldShowEaterCounter(progress: StarEaterProgress, state: GameState): boolean {
  return progress.phase === 'core' && !progress.won && !progress.lost && !eaterCounterShown(state)
}

/**
 * Set the one-shot reveal latch (the counter has been shown). A no-op returning the SAME reference once set
 * (setFlag is SAME-ref when unchanged). The screen dispatches this in the same path it surfaces the string,
 * so shouldShowEaterCounter goes false and stays false — the comparison is made EXACTLY once (§3/§286).
 */
export function markEaterCounterShown(state: GameState): GameState {
  if (eaterCounterShown(state)) return state
  return setFlag(state, EATER_COUNTER_SHOWN_FLAG)
}

/**
 * Commit the finale: set the star-eater-defeated flag. A no-op returning the SAME reference once already set
 * (setFlag is SAME-ref when unchanged). The screen dispatches this once the phase-3 defense is won; the flag
 * persists (the fight itself never does), is farm-proof (a re-entry shows the aftermath / the choice, never a
 * re-fightable loot source — there is no loot), and is the hook the choice screen opens on. Immutable.
 */
export function winStarEater(state: GameState): GameState {
  if (starEaterDefeated(state)) return state
  return setFlag(state, STAR_EATER_DEFEATED_FLAG)
}

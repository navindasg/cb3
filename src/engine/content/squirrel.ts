import type { GameState } from '@/engine/types/GameState'
import { setNumber } from '@/engine/state/reducers'
import type { Riddle } from '@/content/reef/squirrel'
import { SQUIRREL_RIDDLE_KEY } from '@/content/reef/squirrel'

// The space squirrel's riddles (Act 2 — the rock candy reef, DESIGN §178/§339). Pure & immutable,
// mirroring engine/content/lighthouse + reefVoyage: compute from state, return the next state, a no-op
// returns the SAME reference. You answer riddles in order; a correct answer advances, a wrong one is a
// no-op (slow blink, retry — never a soft-lock). Progress lives in a numbers counter; the chocolate
// rewards and the final acorn-of-knowledge grant are the screen's job (this only tracks the riddle
// march and reports which riddle was just solved + whether the last one is done).

export function squirrelRiddleIndex(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[SQUIRREL_RIDDLE_KEY] ?? 0))
}

/** The riddle currently posed, or null once every riddle is answered. */
export function currentRiddle(state: GameState, riddles: readonly Riddle[]): Riddle | null {
  return riddles[squirrelRiddleIndex(state)] ?? null
}

/** Whether every riddle has been answered (the squirrel is done with you). */
export function allRiddlesSolved(state: GameState, riddles: readonly Riddle[]): boolean {
  return squirrelRiddleIndex(state) >= riddles.length
}

export interface AnswerResult {
  readonly ok: boolean
  readonly state: GameState
  /** Whether the chosen option was the riddle's answer. */
  readonly correct: boolean
  /** The riddle just solved (for its chocolate reward), present only on a correct answer. */
  readonly solved?: Riddle
  /** True on the answer that finished the final riddle (grant the acorn of knowledge). */
  readonly allSolved: boolean
}

/**
 * Answer the current riddle with `choiceId`. A correct answer advances to the next riddle and reports
 * the solved riddle (+ allSolved on the last). A wrong answer is a no-op (SAME reference) — retry, no
 * penalty. Also a no-op once every riddle is solved. Immutable.
 */
export function answerRiddle(
  state: GameState,
  choiceId: string,
  riddles: readonly Riddle[],
): AnswerResult {
  const riddle = currentRiddle(state, riddles)
  if (!riddle) return { ok: false, state, correct: false, allSolved: true }

  if (choiceId !== riddle.answerId) {
    return { ok: true, state, correct: false, allSolved: false }
  }

  const advanced = setNumber(state, SQUIRREL_RIDDLE_KEY, squirrelRiddleIndex(state) + 1)
  return {
    ok: true,
    state: advanced,
    correct: true,
    solved: riddle,
    allSolved: allRiddlesSolved(advanced, riddles),
  }
}

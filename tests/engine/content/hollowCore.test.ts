import { createDefaultSave } from '@/engine/state/defaultSave'
import {
  echoCall,
  hollowRound,
  hollowInput,
  hollowCoreReached,
  hollowCoreAccessible,
  currentRoundLength,
  roundSequence,
  expectedCall,
} from '@/engine/content/hollowCore'
import {
  ECHO_SEQUENCE,
  BASE_LENGTH,
  TARGET_ROUNDS,
  HOLLOW_ROUND_KEY,
  HOLLOW_INPUT_KEY,
} from '@/content/moon/hollowCore'
import { MOON_STRATA, MOON_STRATUM_KEY } from '@/content/moon/strata'
import { HOLLOW_CORE_REACHED_FLAG } from '@/content/flags'
import type { EchoCall } from '@/engine/types/defs'
import type { GameState } from '@/engine/types/GameState'

const withCore = (over: Partial<Record<string, number>> = {}): GameState => ({
  ...createDefaultSave(),
  // Mined clean: the stratum index is past the last stratum, so no current stratum remains.
  numbers: { [MOON_STRATUM_KEY]: MOON_STRATA.length, ...over },
})

/** The wrong call for a given expected one (any call that differs). */
const wrong = (expected: EchoCall): EchoCall => (expected === 'up' ? 'down' : 'up')

/** Play the exact correct echo for the current round; returns the final result + state. */
const echoRound = (start: GameState) => {
  let s = start
  const len = currentRoundLength(s) // fixed for this round (the final call advances the round)
  let last
  for (let i = 0; i < len; i++) {
    last = echoCall(s, ECHO_SEQUENCE[i]!)
    s = last.state
  }
  return last!
}

describe('the hollow core — accessibility', () => {
  it('is shut until the moon is mined clean, then open', () => {
    expect(hollowCoreAccessible(createDefaultSave(), MOON_STRATA)).toBe(false) // stratum 0, still mining
    expect(hollowCoreAccessible(withCore(), MOON_STRATA)).toBe(true) // every stratum cleared
    expect(hollowCoreAccessible(withCore({ [MOON_STRATUM_KEY]: 1 }), MOON_STRATA)).toBe(false)
  })
})

describe('the hollow core — the echo puzzle', () => {
  it('starts on round 0 with no echo entered and the base sequence length', () => {
    const s = withCore()
    expect(hollowRound(s)).toBe(0)
    expect(hollowInput(s)).toBe(0)
    expect(currentRoundLength(s)).toBe(BASE_LENGTH)
    expect(roundSequence(s)).toEqual(ECHO_SEQUENCE.slice(0, BASE_LENGTH))
    expect(expectedCall(s)).toBe(ECHO_SEQUENCE[0])
  })

  it('a correct call advances the echo without completing the round', () => {
    const before = withCore()
    const result = echoCall(before, ECHO_SEQUENCE[0]!)
    expect(result.ok).toBe(true)
    expect(result.correct).toBe(true)
    expect(result.roundComplete).toBe(false)
    expect(result.solved).toBe(false)
    expect(hollowInput(result.state)).toBe(1)
    expect(expectedCall(result.state)).toBe(ECHO_SEQUENCE[1])
  })

  it('a wrong call scatters the echo — the round restarts (input back to 0)', () => {
    // Enter one correct call, then a wrong one.
    const stepped = echoCall(withCore(), ECHO_SEQUENCE[0]!).state
    expect(hollowInput(stepped)).toBe(1)
    const scattered = echoCall(stepped, wrong(ECHO_SEQUENCE[1]!))
    expect(scattered.ok).toBe(true)
    expect(scattered.correct).toBe(false)
    expect(hollowInput(scattered.state)).toBe(0)
    expect(hollowRound(scattered.state)).toBe(0) // the round itself is not lost
  })

  it('completing a round answers it and lengthens the next', () => {
    const result = echoRound(withCore())
    expect(result.correct).toBe(true)
    expect(result.roundComplete).toBe(true)
    expect(result.solved).toBe(false)
    expect(hollowRound(result.state)).toBe(1)
    expect(hollowInput(result.state)).toBe(0)
    expect(currentRoundLength(result.state)).toBe(BASE_LENGTH + 1)
  })

  it('clearing every round solves the puzzle and sets the reached flag', () => {
    let s = withCore()
    let last
    for (let r = 0; r < TARGET_ROUNDS; r++) {
      last = echoRound(s)
      s = last.state
    }
    expect(last!.solved).toBe(true)
    expect(hollowRound(s)).toBe(TARGET_ROUNDS)
    expect(hollowCoreReached(s)).toBe(true)
    expect(s.flags[HOLLOW_CORE_REACHED_FLAG]).toBe(true)
  })

  it('once reached, further calls are a no-op (same reference)', () => {
    const solved: GameState = {
      ...withCore(),
      flags: { [HOLLOW_CORE_REACHED_FLAG]: true },
    }
    const result = echoCall(solved, ECHO_SEQUENCE[0]!)
    expect(result.ok).toBe(false)
    expect(result.solved).toBe(false)
    expect(result.state).toBe(solved)
    expect(expectedCall(solved)).toBeNull()
  })

  it('does not mutate the input state', () => {
    const before = withCore({ [HOLLOW_INPUT_KEY]: 0, [HOLLOW_ROUND_KEY]: 0 })
    echoCall(before, ECHO_SEQUENCE[0]!)
    echoCall(before, wrong(ECHO_SEQUENCE[0]!))
    expect(hollowInput(before)).toBe(0)
    expect(hollowRound(before)).toBe(0)
  })

  it('the fixed sequence is long enough for the final round', () => {
    expect(ECHO_SEQUENCE.length).toBeGreaterThanOrEqual(BASE_LENGTH + TARGET_ROUNDS - 1)
  })
})

// The hollow core (Quest 5, DESIGN §8 Act 1 / lore §15.2) — the echo puzzle at the moon's exact
// centre, reached once every stratum is mined clean. Pure data the engine (engine/content/hollowCore)
// reads. The chamber answers your call with a fixed, growing sequence; you echo it back. Deterministic
// by design: a reload mid-puzzle is safe and the sequence is testable, and it reads in-fiction as the
// chamber's echo being *consistent* — you are learning the shape of the hollow, not gambling.

import type { EchoCall } from '@/engine/types/defs'

/** numbers-namespace keys for the echo puzzle's progress. */
export const HOLLOW_ROUND_KEY = 'hollowRound' // rounds the chamber has answered (0..TARGET_ROUNDS)
export const HOLLOW_INPUT_KEY = 'hollowInput' // calls correctly echoed in the current round so far

/**
 * The chamber's fixed echo. Each round asks you to repeat a growing PREFIX of this sequence (Simon-
 * style): round r wants the first BASE_LENGTH + r calls. Must be at least BASE_LENGTH + TARGET_ROUNDS
 * - 1 long (the final round's length); a few spare entries are harmless. Pure-ASCII directional calls.
 */
export const ECHO_SEQUENCE: readonly EchoCall[] = [
  'up',
  'right',
  'right',
  'down',
  'left',
  'up',
  'down',
  'left',
]

/** The first round's echo length (round 0 asks for this many calls). */
export const BASE_LENGTH = 2

/** Rounds to clear (lengths 2,3,4,5) before the way to the dead centre opens. */
export const TARGET_ROUNDS = 4

import type { GameState } from '@/engine/types/GameState'
import { spendResource } from '@/engine/types/Resource'

// G2 — the BEANSTALK GARDEN, the genre reveal (DESIGN §22). Plant the seed → a garden zone;
// feed it candies; once 1,000 candies have been fed it reaches the clouds and THE MAP EXTENDS
// UPWARD (the renderer appends the cloud/sky strata gated behind 'beanstalkReachedClouds' and
// smoothly pans up — resolved decision 3, DOM translateY). The fed-candy running total lives
// in numbers.beanstalkCandiesFed; the reveal is GATED by the flag so appending the sky stratum
// is idempotent. The single-lollipop secret (giant leaf + hammock rest buff) is matched
// separately by engine/content/secrets against the existing SINGLE_LOLLIPOP_LEAF def.
//
// Pure & immutable: spending more candy than you hold is a no-op (SAME reference); feeding the
// candy that crosses the threshold sets the reveal flag in the same immutable pass.

/** Candies that must be fed to the beanstalk before it reaches the clouds. */
export const BEANSTALK_CLOUD_THRESHOLD = 1000

/**
 * Candies fed before the beanstalk THICKENS — past the clouds it grows woody and starts shedding
 * licorice cuttings (DESIGN §8 Act 1: "further feeding thickens it: licorice cuttings harvestable").
 * The cuttings producer (content/producers/licorice) gates its trickle on this; it's the first
 * licorice source, and the candy you feed past the clouds is its (large, ongoing) sink.
 */
export const BEANSTALK_THICKEN_THRESHOLD = 10000

/** Running total of candies fed to the beanstalk, stored in numbers. */
export const CANDIES_FED_KEY = 'beanstalkCandiesFed'

/** Flag set once the seed has been planted (the garden zone exists). */
export const SEED_PLANTED_FLAG = 'beanstalkPlanted'

/** Flag set the instant the beanstalk reaches the clouds; gates the sky strata reveal. */
export const REACHED_CLOUDS_FLAG = 'beanstalkReachedClouds'

/** Flag set once the beanstalk thickens (fed past BEANSTALK_THICKEN_THRESHOLD); gates the licorice
 * cuttings. Kept in lock-step with content/flags.BEANSTALK_THICKENED_FLAG (content owns the named
 * constant the producer reads; this engine writer compares the same literal — the flags.ts idiom). */
export const THICKENED_FLAG = 'beanstalkThickened'

/** Candies fed to the beanstalk so far. */
export function candiesFed(state: GameState): number {
  return state.numbers[CANDIES_FED_KEY] ?? 0
}

/** Whether the beanstalk has reached the clouds (the upward map extension is live). */
export function reachedClouds(state: GameState): boolean {
  return state.flags[REACHED_CLOUDS_FLAG] === true
}

/**
 * Plant the seed: consume the seed from the crater and mark the garden planted. A no-op
 * (SAME reference) if there is no seed present or it is already planted. Immutable.
 */
export function plantSeed(state: GameState): GameState {
  if (state.flags['seedPresent'] !== true) return state
  if (state.flags[SEED_PLANTED_FLAG] === true) return state
  return {
    ...state,
    flags: { ...state.flags, seedPresent: false, [SEED_PLANTED_FLAG]: true },
  }
}

export interface FeedResult {
  /** True when at least one candy was actually fed. */
  readonly fed: boolean
  /** True only on the single pass that crosses the cloud threshold (the reveal). */
  readonly reachedClouds: boolean
  /** True only on the single pass that crosses the thicken threshold (licorice cuttings begin). */
  readonly thickened: boolean
  /** The state after feeding (candies spent, total advanced, reveal/thicken flags set on crossing). */
  readonly state: GameState
}

/**
 * Feed `count` candies to the beanstalk. Deducts the candies (capped at what is affordable),
 * advances the fed running total and, the instant the total crosses BEANSTALK_CLOUD_THRESHOLD,
 * sets REACHED_CLOUDS_FLAG (so the renderer appends the sky strata — idempotently, because the
 * flag is only ever turned on). Feeding while already at the clouds still consumes candy but
 * never re-fires the reveal. Immutable; SAME reference when nothing can be fed.
 */
export function feedBeanstalk(state: GameState, count: number): FeedResult {
  if (count <= 0) return { fed: false, reachedClouds: false, thickened: false, state }
  const amount = Math.min(count, state.candies.current)
  if (amount <= 0) return { fed: false, reachedClouds: false, thickened: false, state }

  const candies = spendResource(state.candies, amount)
  if (!candies) return { fed: false, reachedClouds: false, thickened: false, state }

  const total = candiesFed(state) + amount
  const crossing = !reachedClouds(state) && total >= BEANSTALK_CLOUD_THRESHOLD
  // Thicken the FIRST time the fed total reaches the threshold (and the flag is not yet set — so a
  // save that somehow passed the mark unflagged still thickens on the next feed). Sets the flag the
  // licorice-cuttings producer gates on.
  const thickening = state.flags[THICKENED_FLAG] !== true && total >= BEANSTALK_THICKEN_THRESHOLD

  const flagsChanged = crossing || thickening
  const next: GameState = {
    ...state,
    candies,
    numbers: { ...state.numbers, [CANDIES_FED_KEY]: total },
    ...(flagsChanged
      ? {
          flags: {
            ...state.flags,
            ...(crossing ? { [REACHED_CLOUDS_FLAG]: true } : {}),
            ...(thickening ? { [THICKENED_FLAG]: true } : {}),
          },
        }
      : {}),
  }
  return { fed: true, reachedClouds: crossing, thickened: thickening, state: next }
}

import type { GameState } from '@/engine/types/GameState'
import type { UnlockFeature } from '@/engine/types/defs'
import { spendResource } from '@/engine/types/Resource'

// CB2's "request a feature" GUI accrete (CandyBox.update + requestStatusBarUnlocked*). A single
// rotating button walks an ordered feature list, charging candies to permanently unlock the
// next piece of chrome. Two load-bearing rules from CB2, kept exactly:
//   1. VISIBILITY ratchets on candies.historicalMax (CB2 getMax()), never the current balance —
//      so once you have ever held enough, the button (and any already-unlocked chrome) stays put
//      even after you spend back down to zero.
//   2. The narration shown beside the button describes the PREVIOUS unlock (CB2's charming
//      off-by-one): while you are being offered feature[i], the comment recaps feature[i-1].
// Pure & immutable: purchaseFeature returns the SAME reference on a no-op (already owned / can't
// afford), so signal effects skip via Object.is.

/** Whether `feature`'s flag is set. */
export function isFeatureUnlocked(state: GameState, feature: UnlockFeature): boolean {
  return state.flags[feature.flag] === true
}

/** The first not-yet-unlocked feature in order, or null when every feature is unlocked. */
export function nextFeature<T extends UnlockFeature>(
  features: readonly T[],
  state: GameState,
): T | null {
  return features.find((f) => state.flags[f.flag] !== true) ?? null
}

/** What the rotating request button + comment should show right now. */
export interface RequestView<T extends UnlockFeature> {
  /** The feature currently offered (null when all are unlocked). */
  readonly next: T | null
  /** The feature just unlocked, whose narration accompanies the next offer (null at the start). */
  readonly justUnlocked: T | null
}

/**
 * Resolve the rotating-request view: the next feature to offer and the previously-unlocked one
 * whose comment is shown beside it (CB2's off-by-one narration). `next` is null once the list
 * is exhausted (the whole request block then hides).
 */
export function requestView<T extends UnlockFeature>(
  features: readonly T[],
  state: GameState,
): RequestView<T> {
  const index = features.findIndex((f) => state.flags[f.flag] !== true)
  if (index === -1) return { next: null, justUnlocked: null }
  return {
    next: features[index] ?? null,
    justUnlocked: index > 0 ? (features[index - 1] ?? null) : null,
  }
}

/**
 * Whether the "request a feature" button should be shown: the candy high-water mark has reached
 * the FIRST feature's price (CB2's getMax() >= 30 gate) and at least one feature is still locked.
 */
export function requestVisible(features: readonly UnlockFeature[], state: GameState): boolean {
  const first = features[0]
  if (!first) return false
  if (nextFeature(features, state) === null) return false
  return state.candies.historicalMax >= first.price
}

/**
 * Unlock `feature`: if it is not already owned and its price is currently affordable, spend the
 * candies and set its flag. Immutable; returns the SAME reference when it cannot proceed.
 */
export function purchaseFeature(state: GameState, feature: UnlockFeature): GameState {
  if (state.flags[feature.flag] === true) return state
  const candies = spendResource(state.candies, feature.price)
  if (!candies) return state
  return { ...state, candies, flags: { ...state.flags, [feature.flag]: true } }
}

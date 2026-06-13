import type { GameState } from '@/engine/types/GameState'
import type { DialogueDef, DialogueVariant } from '@/engine/types/defs'

// Dialogue selection: walk a speaker's variants in order and return the FIRST whose flag
// conditions hold for the current state. Variants gate on requiresFlag (must be set) and
// hiddenWhenFlag (must be unset) — so a once-only intro can hide itself after it has played
// by setting a flag the next visit reads. Pure; the engine returns which variant shows and
// (separately) the flag mutation to apply when it is shown.

/** Whether a variant is eligible to show given the current flags. */
export function variantEligible(variant: DialogueVariant, state: GameState): boolean {
  if (variant.requiresFlag !== undefined && state.flags[variant.requiresFlag] !== true) return false
  if (variant.hiddenWhenFlag !== undefined && state.flags[variant.hiddenWhenFlag] === true) {
    return false
  }
  return true
}

/** The variant a speaker shows now (first eligible in order), or null when none apply. */
export function selectVariant(def: DialogueDef, state: GameState): DialogueVariant | null {
  return def.variants.find((v) => variantEligible(v, state)) ?? null
}

/**
 * Apply the side effect of showing `variant`: set its `setsFlag` if any (marks an intro as
 * seen, grants a one-off, …). Immutable; SAME reference when there is nothing to set.
 */
export function markVariantShown(state: GameState, variant: DialogueVariant): GameState {
  if (variant.setsFlag === undefined || state.flags[variant.setsFlag] === true) return state
  return { ...state, flags: { ...state.flags, [variant.setsFlag]: true } }
}

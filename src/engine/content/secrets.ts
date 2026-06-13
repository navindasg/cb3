import type { GameState } from '@/engine/types/GameState'
import type { ResourceKey } from '@/engine/types/GameState'
import type { SecretDef } from '@/engine/types/defs'
import { addResource } from '@/engine/types/Resource'

// The secret runner (ADR §10 SecretDef). Secrets are the CB-series' hidden interactions —
// the fossil that twitches when you feed it EXACTLY one candy, the well that pays interest
// on thrown candies, the single-lollipop leaf. Each is a typed trigger; this engine matches
// an interaction against a trigger and, on a hit, sets the flag and grants any reward. Pure
// & immutable: on a miss it returns the SAME state reference so callers skip via Object.is.

/** The interaction a player performs, matched against a SecretDef.trigger. */
export type SecretInteraction =
  /** Feeding `count` of `resource` to a target (fossil, leaf). */
  | { readonly kind: 'feed'; readonly resource: ResourceKey; readonly count: number }
  /** Throwing candies at `target` (well). */
  | { readonly kind: 'throw'; readonly target: string; readonly count: number }
  /** Holding exactly the current balance while interacting (single-lollipop). */
  | { readonly kind: 'hold'; readonly resource: ResourceKey }

/** Whether `interaction` fires `secret`'s trigger. */
export function triggerFires(secret: SecretDef, interaction: SecretInteraction, state: GameState): boolean {
  const t = secret.trigger
  switch (t.kind) {
    case 'feedExactly':
      return (
        interaction.kind === 'feed' &&
        interaction.resource === t.resource &&
        interaction.count === t.count
      )
    case 'throwAt':
      return interaction.kind === 'throw' && interaction.target === t.target
    case 'holdExactly':
      return (
        interaction.kind === 'hold' &&
        interaction.resource === t.resource &&
        state[t.resource].current === t.count
      )
  }
}

export interface SecretResult {
  /** True when the interaction fired the secret. */
  readonly fired: boolean
  /** The state after firing (flag set + reward granted); same reference on a miss. */
  readonly state: GameState
  /** i18n key of the deadpan reveal line; present only when fired. */
  readonly revealKey?: string
}

/**
 * Evaluate `interaction` against `secret`. On a hit, set the secret's flag and add any reward
 * resource. A secret can only fire once: if its flag is already set, it is inert (no double
 * reward). Immutable; SAME state on a miss or an already-fired secret.
 */
export function fireSecret(
  state: GameState,
  secret: SecretDef,
  interaction: SecretInteraction,
): SecretResult {
  if (state.flags[secret.setsFlag] === true) return { fired: false, state }
  if (!triggerFires(secret, interaction, state)) return { fired: false, state }

  let next: GameState = { ...state, flags: { ...state.flags, [secret.setsFlag]: true } }
  if (secret.reward) {
    next = { ...next, [secret.reward.resource]: addResource(next[secret.reward.resource], secret.reward.amount) }
  }
  return { fired: true, state: next, revealKey: secret.revealKey }
}

/** Try every secret against an interaction; return the first that fires (or a no-op miss). */
export function fireAny(
  state: GameState,
  secrets: readonly SecretDef[],
  interaction: SecretInteraction,
): SecretResult {
  for (const secret of secrets) {
    const result = fireSecret(state, secret, interaction)
    if (result.fired) return result
  }
  return { fired: false, state }
}

import type { GameState } from '@/engine/types/GameState'
import type { ResourceKey } from '@/engine/types/GameState'
import type { ItemDef, SecretDef } from '@/engine/types/defs'
import { addResource } from '@/engine/types/Resource'
import { grantItem } from '@/engine/shop/purchase'

// The secret runner (ADR §10 SecretDef). Secrets are the CB-series' hidden interactions —
// the fossil that twitches when you feed it EXACTLY one candy, the well that pays interest
// on thrown candies, the single-lollipop leaf, and the CB2 hidden-text-box's typed words.
// Each is a typed trigger; this engine matches an interaction against a trigger and, on a
// hit, sets the flag, grants any reward or item, or (for a cosmetic secret) just returns a
// reveal. Pure & immutable: on a miss it returns the SAME state reference so callers skip
// via Object.is. ONE runner for every secret kind — typed words flow through it too.

/** The interaction a player performs, matched against a SecretDef.trigger. */
export type SecretInteraction =
  /** Feeding `count` of `resource` to a target (fossil, leaf). */
  | { readonly kind: 'feed'; readonly resource: ResourceKey; readonly count: number }
  /** Throwing candies at `target` (well). */
  | { readonly kind: 'throw'; readonly target: string; readonly count: number }
  /** Holding exactly the current balance while interacting (single-lollipop). */
  | { readonly kind: 'hold'; readonly resource: ResourceKey }
  /** Typing a matched `word` (the hidden-text-box; the matcher normalizes keystrokes first). */
  | { readonly kind: 'type'; readonly word: string }
  /**
   * A running tally reached a threshold (the sun-poke gag). The render layer bumps a numbers counter
   * (numbers[counterKey]) on each interaction and passes the fresh total; the trigger fires when the
   * total is at least the required count (and, via the once-flag latch in fireSecret, exactly once).
   */
  | { readonly kind: 'count'; readonly counterKey: string; readonly count: number }
  /**
   * A named string equals a target value, case/space-normalized (the galleon-name figurehead). The
   * value is READ FROM STATE (state.strings[stringKey]); the interaction only names WHICH string to
   * check, so the secret cannot be spoofed by passing a value the player never actually set.
   */
  | { readonly kind: 'name'; readonly stringKey: string }

/**
 * Case/space-normalize a name for the nameEquals trigger: lowercased, whitespace runs collapsed to a
 * single space, edges trimmed. So 'Candy  Box', ' candy box ', and 'CANDY BOX' all match 'candy box'.
 */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Whether `interaction` fires `secret`'s trigger. */
export function triggerFires(secret: SecretDef, interaction: SecretInteraction, state: GameState): boolean {
  const t = secret.trigger
  switch (t.kind) {
    case 'feedExactly':
      return (
        interaction.kind === 'feed' &&
        interaction.resource === t.resource &&
        interaction.count === t.count &&
        // The player must actually hold what they feed (mirrors holdExactly): you cannot feed
        // candy you do not have. >= here, not ===, since feeding 1 is valid while holding more.
        state[t.resource].current >= t.count
      )
    case 'throwAt':
      return interaction.kind === 'throw' && interaction.target === t.target
    case 'holdExactly':
      return (
        interaction.kind === 'hold' &&
        interaction.resource === t.resource &&
        state[t.resource].current === t.count
      )
    case 'type':
      return interaction.kind === 'type' && interaction.word === t.word
    case 'countAtLeast':
      return (
        interaction.kind === 'count' &&
        interaction.counterKey === t.counterKey &&
        interaction.count >= t.count
      )
    case 'nameEquals':
      return (
        interaction.kind === 'name' &&
        interaction.stringKey === t.stringKey &&
        normalizeName(state.strings[t.stringKey] ?? '') === normalizeName(t.value)
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
 * Evaluate `interaction` against `secret`. On a hit, set the secret's flag and grant any reward /
 * item; a COSMETIC secret ('candy box') skips the flag entirely and fires every time (its reveal is
 * a harmless toast). A secret with `inertWhenFlag` set is silent once that flag is owned (eclipse
 * after the grimoire). A secret can otherwise only fire once: if its setsFlag is already set, it is
 * inert (no double reward). An `items` map is needed only for grantsItemId secrets. Immutable; SAME
 * state on a miss, a spent secret, or an inert one.
 */
export function fireSecret(
  state: GameState,
  secret: SecretDef,
  interaction: SecretInteraction,
  items?: ReadonlyMap<string, ItemDef>,
): SecretResult {
  if (secret.inertWhenFlag && state.flags[secret.inertWhenFlag] === true) return { fired: false, state }
  if (!triggerFires(secret, interaction, state)) return { fired: false, state }

  // Cosmetic secrets ('candy box') never touch state: no flag, no grant — just the reveal, every time.
  if (secret.cosmetic) return { fired: true, state, revealKey: secret.revealKey }

  if (state.flags[secret.setsFlag] === true) return { fired: false, state }

  let next: GameState = { ...state, flags: { ...state.flags, [secret.setsFlag]: true } }
  if (secret.reward) {
    next = { ...next, [secret.reward.resource]: addResource(next[secret.reward.resource], secret.reward.amount) }
  }
  if (secret.grantsItemId) {
    const item = items?.get(secret.grantsItemId)
    if (item) next = grantItem(next, item)
  }
  return { fired: true, state: next, revealKey: secret.revealKey }
}

/** Try every secret against an interaction; return the first that fires (or a no-op miss). */
export function fireAny(
  state: GameState,
  secrets: readonly SecretDef[],
  interaction: SecretInteraction,
  items?: ReadonlyMap<string, ItemDef>,
): SecretResult {
  for (const secret of secrets) {
    const result = fireSecret(state, secret, interaction, items)
    if (result.fired) return result
  }
  return { fired: false, state }
}

import type { GameState } from '@/engine/types/GameState'
import type { ItemDef, ShopEntry } from '@/engine/types/defs'
import { canAfford, spendResource } from '@/engine/types/Resource'

// ONE generic purchase handler, reused verbatim by the shop, the forge and the
// observatory (ADR §6, Phase 1 plan E1). The flow is always the same:
//   gate (unlock) -> afford-check (every price line) -> deduct -> set saveFlag ->
//   grant the item (ownedItems + equip if it has a slot) -> return speech + new state.
// Pure and immutable: the input state is never mutated; a new state is returned only on
// success. Failures return the SAME state reference so signal effects can skip via Object.is.

/** Why a purchase did not go through (when `ok` is false). */
export type PurchaseFailure = 'locked' | 'unaffordable' | 'unknownItem'

export interface PurchaseResult {
  /** Whether the purchase succeeded. */
  readonly ok: boolean
  /** The state after the purchase (a new object on success, the same reference otherwise). */
  readonly state: GameState
  /** i18n key for the merchant's success line; present only when `ok`. */
  readonly speechKey?: string
  /** Why it failed; present only when not `ok`. */
  readonly reason?: PurchaseFailure
}

/** True when every price line of `entry` is currently affordable from `state`. */
export function canPurchase(state: GameState, entry: ShopEntry): boolean {
  if (entry.unlock && !entry.unlock(state)) return false
  return entry.price.every((line) => canAfford(state[line.resource], line.amount))
}

/**
 * Attempt to buy `entry` (granting the item from `items`). Returns a PurchaseResult; the
 * state is advanced immutably only when the purchase succeeds. The item is marked owned
 * via its saveFlag and `ownedItems`, and auto-equipped when its def declares a slot.
 */
export function purchase(
  state: GameState,
  entry: ShopEntry,
  items: ReadonlyMap<string, ItemDef>,
): PurchaseResult {
  const item = items.get(entry.itemId)
  if (!item) return { ok: false, state, reason: 'unknownItem' }

  if (entry.unlock && !entry.unlock(state)) {
    return { ok: false, state, reason: 'locked' }
  }

  // Deduct every price line on a fresh working state; bail (no mutation of `state`) if
  // any line is unaffordable — spendResource returns null rather than overdrafting.
  let next: GameState = state
  for (const line of entry.price) {
    const spent = spendResource(next[line.resource], line.amount)
    if (!spent) return { ok: false, state, reason: 'unaffordable' }
    next = { ...next, [line.resource]: spent }
  }

  next = grantItem(next, item)
  return { ok: true, state: next, speechKey: entry.speechKey }
}

/** Mark `item` owned (saveFlag + ownedItems) and equip it if it occupies a slot. Immutable. */
export function grantItem(state: GameState, item: ItemDef): GameState {
  const next: GameState = {
    ...state,
    flags: { ...state.flags, [item.saveFlag]: true },
    ownedItems: { ...state.ownedItems, [item.id]: true },
  }
  if (!item.slot) return next
  return { ...next, equipped: { ...next.equipped, [item.slot]: item.id } }
}

import type { GameState } from '@/engine/types/GameState'
import type { ItemDef, ShopEntry } from '@/engine/types/defs'
import { canAfford } from '@/engine/types/Resource'

// A pure projection of a shop/forge/observatory registry for its screen (the render layer turns
// these rows into DOM). It mirrors the gates the generic purchase handler enforces (engine/shop/
// purchase) so the UI can SHOW what the handler would DO: hide rows whose `unlock` is unmet,
// grey out rows you cannot yet afford, and mark what you already own. No DOM, no i18n — the
// render layer resolves names/prices through a locale. Pure: never mutates `state`.

/** One shop row, with the gate/affordability/ownership state the screen needs to render it. */
export interface ShopRow {
  readonly entry: ShopEntry
  readonly item: ItemDef
  /** Already owned (purchase would be a no-op) — show as owned, not buyable. */
  readonly owned: boolean
  /** The entry's `unlock` gate is not yet met — hide the row until it opens up. */
  readonly locked: boolean
  /** Every price line is currently affordable — enable the buy button. */
  readonly affordable: boolean
}

/** Project `entries` against `state`, dropping any entry whose item is missing from `items`. */
export function shopRows(
  state: GameState,
  entries: readonly ShopEntry[],
  items: ReadonlyMap<string, ItemDef>,
): readonly ShopRow[] {
  return entries
    .map((entry): ShopRow | null => {
      const item = items.get(entry.itemId)
      if (!item) return null
      return {
        entry,
        item,
        owned: state.ownedItems[entry.itemId] === true,
        locked: entry.unlock ? !entry.unlock(state) : false,
        affordable: entry.price.every((line) => canAfford(state[line.resource], line.amount)),
      }
    })
    .filter((row): row is ShopRow => row !== null)
}

/** The rows a player should SEE: owned rows, plus unlocked rows (locked-and-unowned stay hidden). */
export function visibleShopRows(
  state: GameState,
  entries: readonly ShopEntry[],
  items: ReadonlyMap<string, ItemDef>,
): readonly ShopRow[] {
  return shopRows(state, entries, items).filter((row) => row.owned || !row.locked)
}

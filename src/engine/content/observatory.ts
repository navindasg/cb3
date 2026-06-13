import type { GameState } from '@/engine/types/GameState'
import type { ItemDef, ShopEntry } from '@/engine/types/defs'
import { purchase, type PurchaseResult } from '@/engine/shop/purchase'

// Thin observatory wiring (engine layer — allowed to import engine logic; parameterized by
// the content's ShopEntry + ItemDef map). Buying the telescope must, beyond the generic
// purchase, stamp the accumulated-game-time at which it was bought so the star counter's
// descent (engine/content/starCounter) is anchored to that moment. Pure & immutable.

const TELESCOPE_FLAG = 'telescopeOwned'
const BOUGHT_AT_KEY = 'telescopeBoughtAtMs'

/**
 * Purchase `entry` (the telescope). On success, also stamp numbers.telescopeBoughtAtMs to the
 * current accumulatedGameTimeMs so the star counter begins ticking from purchase. Idempotent
 * stamp: a re-stamp never happens because the telescope can only be bought once.
 */
export function buyTelescope(
  state: GameState,
  entry: ShopEntry,
  items: ReadonlyMap<string, ItemDef>,
): PurchaseResult {
  const result = purchase(state, entry, items)
  if (!result.ok) return result
  if (result.state.flags[TELESCOPE_FLAG] !== true) return result
  const stamped: GameState = {
    ...result.state,
    numbers: { ...result.state.numbers, [BOUGHT_AT_KEY]: result.state.accumulatedGameTimeMs },
  }
  return { ...result, state: stamped }
}

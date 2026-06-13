import type { GameState } from '@/engine/types/GameState'
import type { QuestDef } from '@/engine/types/defs'
import { addResource } from '@/engine/types/Resource'

// On a quest victory the host applies the quest's declared rewards to the persisted state:
// the flags it unlocks (next zone, a new resource type) and the resource drops it awards
// (the sugar mines award rock candy). Pure & immutable; the SAME reference when a quest has
// no declared rewards. Combat itself stays in the Scene; this only commits the spoils.

/** Apply `def`'s onWin flags + drops to `state`. Returns a new state (or the same when none). */
export function applyQuestWin(state: GameState, def: QuestDef): GameState {
  const hasFlags = (def.onWinFlags?.length ?? 0) > 0
  const hasDrops = (def.onWinDrops?.length ?? 0) > 0
  if (!hasFlags && !hasDrops) return state

  let next: GameState = state
  if (def.onWinFlags) {
    const flags = { ...next.flags }
    for (const flag of def.onWinFlags) flags[flag] = true
    next = { ...next, flags }
  }
  if (def.onWinDrops) {
    for (const drop of def.onWinDrops) {
      next = { ...next, [drop.resource]: addResource(next[drop.resource], drop.amount) }
    }
  }
  return next
}

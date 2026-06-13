import type { GameState, ResourceKey } from '@/engine/types/GameState'

// Typed content-definition records. The engine consumes registries of these;
// adding content means appending a data object, never editing engine code.
// More def types (ItemDef, ShopEntry, RecipeDef, ZoneDef, QuestDef, …) are added
// as their owning blocks land. ProducerDef is all Block A needs.

export interface ProducerDef {
  readonly id: string
  readonly resource: ResourceKey
  /** Production rate in units per second, derived from current state. */
  readonly getRate: (state: GameState) => number
}

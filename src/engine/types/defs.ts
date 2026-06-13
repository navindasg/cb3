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

// --- Map / world (Block D) -------------------------------------------------
// The world is a bottom-to-top registry of strata; zones declare their position by a
// NAMED symbolic anchor (resolved decision 2) rather than absolute rows, so art height
// can change without re-numbering every zone. Anchors are resolved to concrete rows once
// at registry build (see render/mapModel.ts). Content imports only these types.

/** A symbolic vertical position on the map (resolved to a row at registry build). */
export type StratumAnchor =
  | 'groundLevel'
  | 'undergroundLevel'
  | 'villageLevel'
  | 'cloudLevel'
  | 'skyLevel'
  | 'spaceLevel'

/** One clickable location within a stratum. */
export interface ZoneDef {
  readonly id: string
  /** i18n key for the zone's display name. */
  readonly displayKey: string
  /** ASCII glyph/label drawn on the map for this zone. */
  readonly label: string
  /** Column at which the zone sits within its stratum. */
  readonly x: number
  /** Row offset below the stratum's anchor row (0 = on the anchor). */
  readonly rowOffset: number
  /** The data-action dispatched when the zone is clicked (navigate). */
  readonly action: string
  /** State flag that must be true for the zone to appear; absent ⇒ always visible. */
  readonly unlockFlag?: string
}

/** One horizontal band of the world, stacked bottom-to-top by anchor. */
export interface StratumDef {
  readonly id: string
  /** Symbolic vertical anchor; lower anchors render lower on the (taller-upward) page. */
  readonly anchor: StratumAnchor
  /** Height of the stratum in rows. */
  readonly heightRows: number
  /** ASCII backdrop, one string per row (clipped/padded to the stratum's width). */
  readonly ascii: readonly string[]
  /** State flag gating the whole stratum's reveal; absent ⇒ always present. */
  readonly unlockFlag?: string
  readonly zones: readonly ZoneDef[]
}

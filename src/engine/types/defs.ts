import type { GameState, ResourceKey, EquipmentSlot } from '@/engine/types/GameState'

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

// --- Shop / purchasing (Block E) -------------------------------------------
// One generic purchase handler (engine/shop/purchase.ts) consumes ShopEntry records
// and is reused verbatim by the shop, the forge and the observatory: each is just a
// different ShopEntry[] registry. Adding a buyable thing is appending a data object.

/** A buyable, owned thing — a weapon, a hat, a telescope, a grimoire. */
export interface ItemDef {
  readonly id: string
  /** i18n key for the item's display name. */
  readonly displayKey: string
  /** i18n key for the item's description. */
  readonly descKey: string
  /** ASCII glyph drawn for the item in inventory/shop rows. */
  readonly ascii: string
  /** The state flag set when the item is acquired (e.g. 'telescopeOwned'). */
  readonly saveFlag: string
  /** Equipment slot the item occupies when equipped; absent ⇒ not equippable. */
  readonly slot?: EquipmentSlot
}

/** A single resource cost line; a price is one or more of these (all must be paid). */
export interface PriceLine {
  readonly resource: ResourceKey
  readonly amount: number
}

/** One purchasable row in a shop/forge/observatory registry. */
export interface ShopEntry {
  /** The ItemDef.id granted on purchase. */
  readonly itemId: string
  /** Every cost line that must be paid (e.g. [{candies, 30}]). */
  readonly price: readonly PriceLine[]
  /** Gate predicate: the entry is only buyable when this returns true (absent ⇒ always). */
  readonly unlock?: (state: GameState) => boolean
  /** i18n key for the merchant's line spoken on a successful purchase. */
  readonly speechKey: string
}

// --- Quests (Block E) ------------------------------------------------------
// A QuestDef is pure data; one generic Scene runtime (engine/quest/Scene.ts) executes
// any of them, switching only the PhysicsDriver + scroll axis + win condition. No
// per-quest subclass (ADR §6). WaveDef/DeathMessage are the quest's spawn and flavor data.

/** The scroll/physics mode that picks the PhysicsDriver and scroll axis. */
export type QuestMode = 'horizontal' | 'vertical' | 'zeroG' | 'ship'

/** A wave trigger: what causes its spawn orders to fire. Fires at most once. */
export type WaveTrigger =
  | { readonly kind: 'distance'; readonly atScroll: number }
  | { readonly kind: 'timer'; readonly atMs: number }
  | { readonly kind: 'event'; readonly event: string }

/** A spawn order: an entity template id and where to place it (scene-local cells). */
export interface SpawnOrder {
  readonly entityId: string
  readonly x: number
  readonly y: number
}

/** One wave in a quest: a trigger plus the spawns it emits when the trigger fires. */
export interface WaveDef {
  readonly id: string
  readonly trigger: WaveTrigger
  readonly spawns: readonly SpawnOrder[]
}

/** A flavor line shown on death, selected by the damage source (or the generic fallback). */
export interface DeathMessage {
  /** The damage source this message is for, or 'generic' for the fallback. */
  readonly source: string
  /** i18n key (or literal flavor) of the message shown when this source kills the player. */
  readonly message: string
}

/** A win condition: what ends the scene with victory. */
export type WinCondition =
  | { readonly kind: 'reachScroll'; readonly atScroll: number }
  | { readonly kind: 'clearWaves' }
  | { readonly kind: 'event'; readonly event: string }

/** A rectangular safe zone (scene-local cells); standing inside it banks a respawn point. */
export interface SafeZoneDef {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** The data describing one quest; the Scene runtime executes it unchanged. */
export interface QuestDef {
  readonly id: string
  readonly mode: QuestMode
  /** Scene size in cells. */
  readonly width: number
  readonly height: number
  /** Player spawn (scene-local cells). */
  readonly playerStart: { readonly x: number; readonly y: number }
  readonly playerMaxHp: number
  /** Entities present before any wave fires (scenery/static foes), as spawn orders. */
  readonly staticSpawns: readonly SpawnOrder[]
  readonly waves: readonly WaveDef[]
  readonly winCondition: WinCondition
  readonly safeZones: readonly SafeZoneDef[]
  /** Death-flavor lines keyed by damage source; must include a 'generic' fallback. */
  readonly deathMessages: readonly DeathMessage[]
}

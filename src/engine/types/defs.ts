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

// --- Cloud sheep paddock (Act 1, §6) ---------------------------------------
// The cumulus commons' passive cotton-candy income. Sheep are bought with candies (the price
// climbs per head, the incremental idiom) and each grazes a steady trickle of cotton candy. The
// rule (price, purchase, rate) lives in tested engine modules; this is the pure config they read.

/** The cloud-sheep paddock's tuning: where the head-count lives, what a sheep costs and yields. */
export interface PaddockConfig {
  /** numbers-namespace key holding the owned sheep count. */
  readonly countKey: string
  /** Candy cost of the FIRST sheep. */
  readonly basePrice: number
  /** Per-head price multiplier (price of the nth sheep = basePrice * growth^n). */
  readonly priceGrowth: number
  /** Cotton candy each sheep yields per second (passive). */
  readonly cottonPerSheepPerSec: number
}

// --- Map / world ----------------------------------------------------------
// The realized map is a 2D flag-revealed landscape (OverworldDef, see engine/types/overworld.ts):
// regions placed at world-cell (x,y), each revealed by a flag, panned in 2D — the ground spreads
// left→right while the world still extends UPWARD via the beanstalk (garden → climb → sky → space),
// preserving the genre-reveal. The earlier bottom-to-top Stratum registry (StratumDef/ZoneDef) was
// retired in favour of OverworldDef; see ADR-001 D10 (superseded) and DESIGN §3.

// --- Shop / purchasing (Block E) -------------------------------------------
// One generic purchase handler (engine/shop/purchase.ts) consumes ShopEntry records
// and is reused verbatim by the shop, the forge and the observatory: each is just a
// different ShopEntry[] registry. Adding a buyable thing is appending a data object.

/** Combat stats an item carries when equipped as a weapon (read into the quest player). */
export interface WeaponStats {
  /** Flat damage per hit. */
  readonly damage: number
  /** Reach in cells (centre-to-centre). */
  readonly range: number
  /** Minimum ms between attacks (lower = faster). */
  readonly cooldownMs: number
}

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
  /** Combat stats when this item is the equipped weapon; absent ⇒ deals no quest damage. */
  readonly weapon?: WeaponStats
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
  /** Flags set on victory (e.g. unlocking the next zone / a new resource). */
  readonly onWinFlags?: readonly string[]
  /** Resource drops awarded on victory (rock candy, etc.). */
  readonly onWinDrops?: readonly PriceLine[]
}

// --- Cauldron / recipes (Block F) ------------------------------------------
// The cauldron matches a raw action log against recipes (resolved decision 1). Rather than
// each recipe carrying an opaque closure (which content cannot author without importing
// engine logic), a recipe's matcher is a DECLARATIVE spec — a small tree of combinators
// (inOrder / contains / exactlyOne / action) — interpreted by engine/cauldron/recipeMatcher.
// Content authors pure data; the engine evaluates it.

/** One entry in the cauldron's raw action log: a kind plus an optional payload id. */
export interface CauldronEntry {
  /** What the alchemist did, e.g. 'add' | 'stir' | 'heat'. */
  readonly action: string
  /** The thing acted on, e.g. an ingredient id; absent for actionless steps like 'stir'. */
  readonly subject?: string
}

/** A declarative matcher spec, interpreted by the recipe matcher engine. */
export type MatcherSpec =
  | { readonly kind: 'action'; readonly action: string; readonly subject?: string }
  /** Every child must match, anywhere, preserving relative order. */
  | { readonly kind: 'inOrder'; readonly steps: readonly MatcherSpec[] }
  /** Every child must match the WHOLE log (conjunction). */
  | { readonly kind: 'all'; readonly specs: readonly MatcherSpec[] }
  /** At least one log entry matches the child spec. */
  | { readonly kind: 'contains'; readonly step: MatcherSpec }
  /** Exactly one log entry matches the child (leaf) spec, over the whole log. */
  | { readonly kind: 'exactlyOne'; readonly step: MatcherSpec }

/** A cauldron recipe: a declarative matcher over the action log, plus what it brews. */
export interface RecipeDef {
  readonly id: string
  /** i18n key for the recipe/output display name. */
  readonly displayKey: string
  readonly matcher: MatcherSpec
  /** Resource produced (or null when the output is a flagged item). */
  readonly output: ResourceKey | null
  /** Quantity of `output` produced (default 1). */
  readonly quantity?: number
  /** Flag set when this recipe brews (e.g. a one-off item); absent ⇒ none. */
  readonly outputFlag?: string
}

// --- Dialogue (Block F) ----------------------------------------------------
// Dialogue is data: a speaker, an ordered set of lines, and an optional condition gating
// which line set shows. Selection (engine/content/dialogue) walks the variants in order and
// returns the first whose condition holds. Content imports only these types.

/** One conditional set of dialogue lines for a speaker. */
export interface DialogueVariant {
  readonly id: string
  /** i18n keys for the spoken lines, in order. */
  readonly lines: readonly string[]
  /** Flag that must be true for this variant to show; absent ⇒ always eligible. */
  readonly requiresFlag?: string
  /** Flag that must be FALSE for this variant to show (e.g. once-only intros). */
  readonly hiddenWhenFlag?: string
  /** Flag set when this variant is shown (e.g. marks an intro as seen). */
  readonly setsFlag?: string
}

/** A speaker and the variants that resolve, in order, to what they say now. */
export interface DialogueDef {
  readonly speaker: string
  /** i18n key for the speaker's display name. */
  readonly nameKey: string
  readonly variants: readonly DialogueVariant[]
}

// --- Spells (Block F) ------------------------------------------------------
// Grimoires register castable spells. A SpellDef is the data; the live cooldown lives on the
// Scene per-spell map (resolved decision 5 — not persisted). The grimoire's saveFlag gates
// the loadout: a spell is available only when its owning grimoire is owned.

/** A castable spell registered by a grimoire. */
export interface SpellDef {
  readonly id: string
  /** i18n key for the spell name. */
  readonly displayKey: string
  /** Cooldown in ms between casts (mirrored onto the Scene Ability). */
  readonly cooldownMs: number
  readonly damage: number
  /** Mana spent per cast. */
  readonly manaCost: number
  /** The grimoire saveFlag that must be owned for this spell to be in the loadout. */
  readonly grimoireFlag: string
}

// --- Secrets (Block F) -----------------------------------------------------
// Secrets are hidden interactions (CB-series tradition). Each is a typed trigger + the flag
// it sets and the optional reward it grants. The engine's secret runner (engine/content/
// secrets) evaluates a trigger against a small context and returns the resulting flag/reward.

/** A secret trigger: the precise, undocumented input that fires it. */
export type SecretTrigger =
  /** Feed EXACTLY `count` of `resource` in a single interaction (the fossil twitch). */
  | { readonly kind: 'feedExactly'; readonly resource: ResourceKey; readonly count: number }
  /** Throw candies at a target (the well-interest stub). */
  | { readonly kind: 'throwAt'; readonly target: string }
  /** Possess exactly `count` of `resource` while interacting (single-lollipop). */
  | { readonly kind: 'holdExactly'; readonly resource: ResourceKey; readonly count: number }

/** A hidden interaction: when its trigger fires, set a flag and optionally grant a reward. */
export interface SecretDef {
  readonly id: string
  readonly trigger: SecretTrigger
  /** Flag set when the secret fires (e.g. 'fossilTwitched'). */
  readonly setsFlag: string
  /** i18n key for the deadpan line shown when it fires. */
  readonly revealKey: string
  /** Optional resource reward granted on firing. */
  readonly reward?: PriceLine
}

// --- Progressive reveal (Block F) ------------------------------------------
// CB2's opener reveals actions one at a time as candy accumulates. A reveal threshold maps
// an action id to the candies.historicalMax at which it appears; the engine returns the set
// of currently-revealed actions for a state. Pure data; pure resolver.

/** One progressively-revealed action gated by a candy high-water mark. */
export interface RevealThreshold {
  /** The action id revealed (e.g. 'eat' | 'throw'). */
  readonly action: string
  /** The candies.historicalMax at or above which the action is revealed. */
  readonly atHistoricalMax: number
}

// --- Progressive GUI unlock ("request a feature") --------------------------
// CB2's CandyBox surfaces a single rotating "request a feature" button once your candy
// high-water mark is high enough; clicking it spends candies to permanently unlock the next
// piece of chrome (status bar, health bar, the map, …). The engine resolver (engine/content/
// progressiveUnlock) is generic over this minimal shape; the content list adds i18n keys.

/** One requestable GUI feature: the flag it sets when bought and its candy price. */
export interface UnlockFeature {
  /** The permanent save flag set when this feature is unlocked. */
  readonly flag: string
  /** Candy cost to unlock it. */
  readonly price: number
}

// --- Tavern rumors (Block F) -----------------------------------------------
// One free rumor per accumulated GAME hour (resolved decision 8 — never wall-clock). A rumor
// is a hint i18n key; the cadence engine reads accumulatedGameTimeMs against the last-told
// timestamp stored in numbers.

/** A tavern rumor — a single hint line. */
export interface RumorDef {
  readonly id: string
  /** i18n key for the rumor/hint text. */
  readonly textKey: string
}

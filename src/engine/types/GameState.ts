import type { ResourceState } from '@/engine/types/Resource'

// The canonical, fully-serializable game state — the single source of truth and
// the save schema. Signals are a *view* over this; this object is what gets
// JSON-stringified. No functions, no class instances, no signal wrappers here.

export const CURRENT_SCHEMA_VERSION = 1

export const RESOURCE_KEYS = ['candies', 'lollipops', 'chocolate', 'caramel', 'rockCandy'] as const
export type ResourceKey = (typeof RESOURCE_KEYS)[number]

export type EquipmentSlot = 'weapon' | 'hat' | 'armour' | 'gloves' | 'boots'

export interface GameState {
  // --- meta (drives scripted timers; never compared against the wall clock) ---
  accumulatedGameTimeMs: number
  totalPlaytimeSeconds: number
  nGPlusRun: number

  // --- resources (later phases add cotton/popRocks/licorice/… via migrations) ---
  candies: ResourceState
  lollipops: ResourceState
  chocolate: ResourceState
  caramel: ResourceState
  rockCandy: ResourceState

  // --- lifetime stats (never reset; survive NG+) ---
  lifetimeCandiesEaten: number // gates ending 3, scales "wrapper"
  lifetimeCandiesThrown: number
  starsRemaining: number // 8128 -> down

  // --- the Schrödinger box: the ×2 lives only in offline catch-up, never surfaced ---
  boxClosed: boolean

  // --- player (maxHp/maxMana are derived caches recomputed post-load, never stored) ---
  playerHpCurrent: number
  manaCurrent: number

  // --- equipment ---
  equipped: Record<EquipmentSlot, string | null>
  ownedItems: Record<string, boolean>

  // --- progression (flat namespaces; keys are typed unions in code, defaulted via migrations) ---
  flags: Record<string, boolean>
  numbers: Record<string, number>
  strings: Record<string, string>

  // --- NG+ carry-over (null except at the transition) ---
  ngPlusCarryover: {
    lifetimeCandiesEaten: number
    starsRemaining: number
    nGPlusRun: number
  } | null
}

export interface SaveEnvelope {
  v: number // schema version; import refuses v > CURRENT_SCHEMA_VERSION
  t: number // savedAt (ms)
  lastTick: number // wall-clock at last save; drives offline catch-up
  checksum?: string // non-cryptographic corruption check (not anti-cheat)
  state: GameState
}

import type { SaveEnvelope } from '@/engine/types/GameState'
import { encodeSave } from '@/engine/save/envelope'

// localStorage adapter. One key per slot (atomic write — no CB2-style partial
// corruption) plus a tiny sibling meta key so the slot-picker can render without
// decoding a whole save. Writes are wrapped so QuotaExceededError / private-mode
// failures degrade to a non-fatal "couldn't save" result instead of throwing.

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface SaveMeta {
  savedAt: number
  version: number
  lifetimeCandiesEaten: number
  actReached: number
  nGPlusRun: number
}

export type WriteResult = { ok: true } | { ok: false; error: string }

export interface SaveStoreOptions {
  storage?: StorageLike
  prefix?: string
  autosaveSlots?: number
}

export interface SaveStore {
  save(slot: string | number, envelope: SaveEnvelope): WriteResult
  autosave(envelope: SaveEnvelope): WriteResult
  loadRaw(slot: string | number): string | null
  readMeta(slot: string | number): SaveMeta | null
  clear(slot: string | number): void
}

function deriveMeta(envelope: SaveEnvelope): SaveMeta {
  return {
    savedAt: envelope.t,
    version: envelope.v,
    lifetimeCandiesEaten: envelope.state.lifetimeCandiesEaten,
    actReached: envelope.state.numbers['actReached'] ?? 0,
    nGPlusRun: envelope.state.nGPlusRun,
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createSaveStore(options: SaveStoreOptions = {}): SaveStore {
  const storage = options.storage ?? globalThis.localStorage
  const prefix = options.prefix ?? 'cb3'
  const autosaveSlots = Math.max(1, options.autosaveSlots ?? 3)

  const slotKey = (slot: string | number): string => `${prefix}.slot${slot}`
  const metaKey = (slot: string | number): string => `${prefix}.slot${slot}.meta`
  const ptrKey = `${prefix}.autosavePtr`

  function save(slot: string | number, envelope: SaveEnvelope): WriteResult {
    try {
      storage.setItem(slotKey(slot), encodeSave(envelope))
      storage.setItem(metaKey(slot), JSON.stringify(deriveMeta(envelope)))
      return { ok: true }
    } catch (error) {
      return { ok: false, error: messageOf(error) }
    }
  }

  function autosave(envelope: SaveEnvelope): WriteResult {
    const stored = Number(storage.getItem(ptrKey) ?? '0')
    const ptr = Number.isFinite(stored) ? ((stored % autosaveSlots) + autosaveSlots) % autosaveSlots : 0
    const result = save(`autosave${ptr + 1}`, envelope)
    if (result.ok) {
      try {
        storage.setItem(ptrKey, String((ptr + 1) % autosaveSlots))
      } catch {
        /* advancing the rotation pointer is best-effort */
      }
    }
    return result
  }

  function loadRaw(slot: string | number): string | null {
    return storage.getItem(slotKey(slot))
  }

  function readMeta(slot: string | number): SaveMeta | null {
    const raw = storage.getItem(metaKey(slot))
    if (raw === null) return null
    try {
      return JSON.parse(raw) as SaveMeta
    } catch {
      return null
    }
  }

  function clear(slot: string | number): void {
    storage.removeItem(slotKey(slot))
    storage.removeItem(metaKey(slot))
  }

  return { save, autosave, loadRaw, readMeta, clear }
}

/** Ask the browser to persist storage (Safari ITP wipes idle localStorage after ~7 days). */
export async function requestPersistence(): Promise<boolean> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  if (nav?.storage?.persist) {
    try {
      return await nav.storage.persist()
    } catch {
      return false
    }
  }
  return false
}

import LZString from 'lz-string'
import type { GameState, SaveEnvelope } from '@/engine/types/GameState'
import { CURRENT_SCHEMA_VERSION } from '@/engine/types/GameState'

// The save string format: LZ-string base64 of the JSON envelope. Compact enough
// to share, still editable (base64-decode -> edit JSON -> re-encode) — the series
// tradition of swappable saves. localStorage and the export box use the same bytes.

export class SaveDecodeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SaveDecodeError'
  }
}

export function makeEnvelope(state: GameState, now: number): SaveEnvelope {
  return { v: CURRENT_SCHEMA_VERSION, t: now, lastTick: now, state }
}

export function encodeSave(envelope: SaveEnvelope): string {
  return LZString.compressToBase64(JSON.stringify(envelope))
}

/** Decode to an untyped object. Throws SaveDecodeError on anything that isn't our format. */
export function decodeSave(encoded: string): unknown {
  const json = LZString.decompressFromBase64(encoded)
  if (json === null || json === '') {
    throw new SaveDecodeError('save string is not valid LZ-string base64')
  }
  try {
    return JSON.parse(json)
  } catch {
    throw new SaveDecodeError('save string did not contain valid JSON')
  }
}

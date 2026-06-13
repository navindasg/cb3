import type { Hotspot } from '@/render/CellBuffer'

// A sparse lookup from a cell coordinate to the hotspot action covering it. Built once
// per render and queried by the delegated click/move listeners (ADR §7.3) — this is what
// replaces CB2's per-render jQuery re-binding. Pure: no DOM. Later hotspots win on
// overlap (last-drawn-on-top, matching how drawArea appends).

/** The "col,row" key used to index a single cell. */
export function cellKey(col: number, row: number): string {
  return `${col},${row}`
}

export type HotspotMap = ReadonlyMap<string, string>

/** Expand each rectangular hotspot into its covered cells; later hotspots overwrite earlier. */
export function buildHotspotMap(hotspots: readonly Hotspot[]): HotspotMap {
  const map = new Map<string, string>()
  for (const h of hotspots) {
    if (h.width <= 0 || h.height <= 0) continue
    for (let dy = 0; dy < h.height; dy++) {
      for (let dx = 0; dx < h.width; dx++) {
        map.set(cellKey(h.x + dx, h.y + dy), h.action)
      }
    }
  }
  return map
}

/** The action at (col, row), or undefined if no hotspot covers that cell. */
export function actionAt(map: HotspotMap, col: number, row: number): string | undefined {
  return map.get(cellKey(col, row))
}

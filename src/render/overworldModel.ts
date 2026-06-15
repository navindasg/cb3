import type { OverworldDef, RegionDef } from '@/engine/types/overworld'
import type { GameState } from '@/engine/types/GameState'
import { regionRevealed } from '@/engine/types/overworld'
import { CellBuffer } from '@/render/CellBuffer'

// Pure model behind the 2D overworld (no DOM). It selects the revealed regions, computes the
// bounding box of their art (so the renderer can fit *just the discovered world* to the
// viewport), and composites them — with a click hotspot over each region's name — into one
// buffer cropped to that box. render/Overworld.ts is the thin DOM shell around this.

/** The widest line in a region's art (its cell width). */
function artWidth(art: readonly string[]): number {
  return art.reduce((w, row) => Math.max(w, row.length), 0)
}

/** Locate `label` within a region's art; null if it is not drawn there. */
function locateLabel(art: readonly string[], label: string): { x: number; y: number } | null {
  for (let y = 0; y < art.length; y++) {
    const idx = art[y]?.indexOf(label) ?? -1
    if (idx >= 0) return { x: idx, y }
  }
  return null
}

/** The regions currently visible for `state`. */
export function revealedRegions(def: OverworldDef, state: GameState): readonly RegionDef[] {
  return def.regions.filter((r) => regionRevealed(r, state))
}

export interface WorldBounds {
  readonly minX: number
  readonly minY: number
  readonly width: number
  readonly height: number
}

/** The bounding box (in world cells) of the revealed regions' art. Empty ⇒ zero box. */
export function revealedBounds(regions: readonly RegionDef[]): WorldBounds {
  if (regions.length === 0) return { minX: 0, minY: 0, width: 0, height: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const r of regions) {
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + artWidth(r.art))
    maxY = Math.max(maxY, r.y + r.art.length)
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY }
}

/** Build a CellBuffer for one region: its art + a styled, clickable hotspot over its label. */
function regionBuffer(region: RegionDef): CellBuffer {
  let buffer = CellBuffer.create(Math.max(1, artWidth(region.art)), Math.max(1, region.art.length))
  region.art.forEach((row, y) => {
    buffer = buffer.drawString(0, y, row)
  })
  const at = locateLabel(region.art, region.label)
  if (at) {
    buffer = buffer.withStyle({ x: at.x, y: at.y, length: region.label.length, className: 'map-zone' })
    buffer = buffer.withHotspot({
      x: at.x,
      y: at.y,
      width: region.label.length,
      height: 1,
      action: region.action,
    })
  }
  return buffer
}

export interface ComposedWorld {
  readonly buffer: CellBuffer
  readonly bounds: WorldBounds
}

/**
 * Composite the revealed regions into one buffer cropped to their bounding box (so world cell
 * (minX,minY) maps to buffer cell (0,0)). Spaces are transparent (drawArea), so region blocks
 * may carry shaping whitespace without clobbering neighbours. Pure.
 */
export function composeOverworld(def: OverworldDef, state: GameState): ComposedWorld {
  const regions = revealedRegions(def, state)
  const bounds = revealedBounds(regions)
  let buffer = CellBuffer.create(Math.max(1, bounds.width), Math.max(1, bounds.height))
  for (const region of regions) {
    buffer = buffer.drawArea(region.x - bounds.minX, region.y - bounds.minY, regionBuffer(region))
  }
  return { buffer, bounds }
}

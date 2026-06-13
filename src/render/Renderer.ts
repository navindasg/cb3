import type { CellBuffer, Hotspot, GlowSpec } from '@/render/CellBuffer'

// The one rendering contract shared by every surface (ADR §7.1). Phase 1 ships a single
// implementation, DomRenderer; Phase 3 adds CanvasArenaRenderer for per-frame-motion
// quests. Both consume the same immutable CellBuffer, so a surface can swap renderers
// without the game logic knowing. `prev` is supplied so an implementation can diff
// (the canvas renderer blits only changed cells); DomRenderer ignores it.

/** Fired when a hotspot cell is clicked: the hotspot's action id plus the hit cell. */
export interface HotspotClickEvent {
  readonly action: string
  readonly col: number
  readonly row: number
}

export interface Renderer {
  /** Attach to a host element. Installs delegated listeners exactly once. */
  mount(root: HTMLElement): void
  /**
   * Paint `next`. `prev` is the previously rendered buffer (or null on first paint) for
   * diffing. `hotspots`/`glows` override the buffer's own lists when provided, letting a
   * surface drive interactivity/glow without rebuilding the whole buffer.
   */
  render(
    prev: CellBuffer | null,
    next: CellBuffer,
    hotspots?: readonly Hotspot[],
    glows?: readonly GlowSpec[],
  ): void
  /** Detach: remove listeners and DOM so the surface leaves no leak. */
  unmount(): void
}

/** Pixel→cell hit-test: integer cell coords from a pointer position and the grid origin. */
export interface HitTestInput {
  /** Pointer position in viewport pixels (e.g. MouseEvent.clientX/clientY). */
  readonly clientX: number
  readonly clientY: number
  /** The grid's top-left in viewport pixels (e.g. getBoundingClientRect().left/top). */
  readonly left: number
  readonly top: number
  readonly cellW: number
  readonly cellH: number
}

export interface CellCoord {
  readonly col: number
  readonly row: number
}

/**
 * Convert a pixel position to integer cell coords (ADR §7.3): col = floor((x-left)/cellW),
 * row = floor((y-top)/cellH). Pure — no DOM — so it is unit-testable with plain numbers.
 * Returns null when the pointer is left/above the grid (negative cell), the caller treats
 * that as a miss. cellW/cellH must be positive.
 */
export function hitTest(input: HitTestInput): CellCoord | null {
  const { clientX, clientY, left, top, cellW, cellH } = input
  if (!(cellW > 0) || !(cellH > 0)) return null
  const col = Math.floor((clientX - left) / cellW)
  const row = Math.floor((clientY - top) / cellH)
  if (col < 0 || row < 0) return null
  return { col, row }
}

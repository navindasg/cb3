import type { GameState } from '@/engine/types/GameState'

// The 2D overworld (the Act 0 redesign). The original CB2 world map is ONE big hand-drawn ASCII
// scene with landmarks placed at (x,y) and revealed progressively; the player scrolls it. We
// follow that idiom but as a registry of placed REGION art blocks so each can be revealed
// independently and the renderer can fit the *revealed* bounding box to any viewport.
//
// A region is a block of ASCII art placed at a world cell (x,y). Its `label` is the exact text
// already drawn in that art (CB2 never stamps labels over the scene); the renderer finds it and
// overlays a transparent, styled click hotspot. A region appears only once its `revealFlag` is
// set (absent ⇒ always visible), so the visible world literally grows as you progress — which is
// both the progression and the de-clutter (you never see the whole map at once).

export interface RegionDef {
  readonly id: string
  /** Top-left column of this region's art in world cells. */
  readonly x: number
  /** Top-left row of this region's art in world cells (0 = top of the world). */
  readonly y: number
  /** The region's ASCII art block, one string per row. */
  readonly art: readonly string[]
  /** The exact text drawn in `art` that becomes the clickable hotspot (CB2-style). */
  readonly label: string
  /** The data-action dispatched when the label is clicked. */
  readonly action: string
  /** i18n key for the region's display name (hover/aria); absent ⇒ derive from label. */
  readonly displayKey?: string
  /** Flag gating the region's appearance; absent ⇒ always present. */
  readonly revealFlag?: string
}

export interface OverworldDef {
  /** The full world's cell dimensions (regions are placed within this). */
  readonly worldWidth: number
  readonly worldHeight: number
  readonly regions: readonly RegionDef[]
}

/** A region is revealed when it has no flag, or its flag is set. */
export function regionRevealed(region: RegionDef, state: GameState): boolean {
  return region.revealFlag === undefined || state.flags[region.revealFlag] === true
}

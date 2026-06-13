import type { StratumDef, StratumAnchor, ZoneDef } from '@/engine/types/defs'
import type { GameState } from '@/engine/types/GameState'
import { CellBuffer } from '@/render/CellBuffer'

// The pure model behind the vertical map (ADR §7.5). All logic here — anchor→row
// resolution, unlock gating, virtualization windowing, buffer composition — has NO DOM,
// so it is fully unit-testable; render/Map.ts is the thin DOM shell around it.
//
// The page grows UPWARD as acts unlock: lower anchors are at higher row numbers (nearer
// the bottom of the document), higher anchors at lower row numbers. We resolve named
// anchors to concrete rows ONCE at registry build (resolved decision 2) by stacking the
// unlocked strata bottom-to-top in anchor order.

/** Anchor stacking order, bottom (index 0) to top. Lower = larger resolved row. */
const ANCHOR_ORDER: readonly StratumAnchor[] = [
  'undergroundLevel',
  'groundLevel',
  'villageLevel',
  'cloudLevel',
  'skyLevel',
  'spaceLevel',
]

function anchorRank(anchor: StratumAnchor): number {
  const idx = ANCHOR_ORDER.indexOf(anchor)
  return idx < 0 ? ANCHOR_ORDER.length : idx
}

/** A stratum placed at a concrete top row, with its resolved height. */
export interface PlacedStratum {
  readonly def: StratumDef
  /** Top row of this stratum in the full map (0 = top of the document). */
  readonly topRow: number
}

/** A stratum (and its always-/conditionally-revealed flag) is present in the map. */
function stratumRevealed(def: StratumDef, state: GameState): boolean {
  return def.unlockFlag === undefined || state.flags[def.unlockFlag] === true
}

function zoneRevealed(zone: ZoneDef, state: GameState): boolean {
  return zone.unlockFlag === undefined || state.flags[zone.unlockFlag] === true
}

export interface ResolvedMap {
  readonly placed: readonly PlacedStratum[]
  /** Total rows of the revealed map (0 if nothing is unlocked). */
  readonly totalRows: number
  readonly width: number
}

/**
 * Resolve named anchors to concrete rows for the currently-revealed strata. Strata stack
 * highest-anchor-first from the top of the document (row 0), so unlocking a higher anchor
 * extends the page upward. Only strata whose unlock flag is set are placed.
 */
export function resolveMap(strata: readonly StratumDef[], state: GameState): ResolvedMap {
  const revealed = strata
    .filter((s) => stratumRevealed(s, state))
    .slice()
    .sort((a, b) => anchorRank(b.anchor) - anchorRank(a.anchor)) // highest anchor first (top)

  const width = strata.reduce(
    (max, s) => Math.max(max, s.ascii.reduce((w, row) => Math.max(w, row.length), 0)),
    0,
  )

  let topRow = 0
  const placed: PlacedStratum[] = []
  for (const def of revealed) {
    placed.push({ def, topRow })
    topRow += def.heightRows
  }
  return { placed, totalRows: topRow, width }
}

/** The inclusive row window [first, last] visible given a scroll offset and viewport height. */
export interface RowWindow {
  readonly first: number
  readonly last: number
}

/** Clamp scrollY to the scrollable range for a given content/viewport height. */
export function clampScrollY(scrollY: number, totalRows: number, viewportRows: number): number {
  const maxScroll = Math.max(0, totalRows - viewportRows)
  if (!Number.isFinite(scrollY) || scrollY < 0) return 0
  return Math.min(scrollY, maxScroll)
}

/**
 * The visible row window for a scroll position, with a one-viewport buffer above and
 * below (virtualization — offscreen strata cost nothing). Rows are clamped to the map.
 */
export function visibleWindow(
  scrollY: number,
  viewportRows: number,
  totalRows: number,
  bufferRows = viewportRows,
): RowWindow {
  const first = Math.max(0, Math.floor(scrollY) - bufferRows)
  const last = Math.min(Math.max(0, totalRows - 1), Math.floor(scrollY) + viewportRows + bufferRows)
  return { first, last }
}

/** True when a placed stratum overlaps the visible window (so it should be rendered). */
export function stratumInWindow(placed: PlacedStratum, window: RowWindow): boolean {
  const top = placed.topRow
  const bottom = placed.topRow + placed.def.heightRows - 1
  return bottom >= window.first && top <= window.last
}

/** The placed strata that should be rendered for a window (virtualization gate). */
export function strataToRender(
  resolved: ResolvedMap,
  window: RowWindow,
): readonly PlacedStratum[] {
  return resolved.placed.filter((p) => stratumInWindow(p, window))
}

/**
 * Composite one stratum (backdrop + its revealed zone labels + zone hotspots) into a
 * CellBuffer the height of the stratum. Zones whose unlock flag is unset are skipped.
 * Pure: returns a fresh buffer.
 */
export function buildStratumBuffer(
  def: StratumDef,
  state: GameState,
  width: number,
): CellBuffer {
  let buffer = CellBuffer.create(width, def.heightRows)
  def.ascii.forEach((row, y) => {
    buffer = buffer.drawString(0, y, row)
  })
  for (const zone of def.zones) {
    if (!zoneRevealed(zone, state)) continue
    buffer = buffer.drawString(zone.x, zone.rowOffset, zone.label)
    buffer = buffer.withHotspot({
      x: zone.x,
      y: zone.rowOffset,
      width: zone.label.length,
      height: 1,
      action: zone.action,
    })
  }
  return buffer
}

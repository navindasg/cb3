import type { OverworldDef } from '@/engine/types/overworld'
import type { GameState } from '@/engine/types/GameState'
import type { Hotspot } from '@/render/CellBuffer'
import { FONT_STACK, LINE_HEIGHT } from '@/render/font'
import { serialize } from '@/render/HtmlSerializer'
import { buildHotspotMap, actionAt } from '@/render/hotspotMap'
import { hitTest } from '@/render/Renderer'
import { markMeaningful } from '@/render/a11y'
import { composeOverworld } from '@/render/overworldModel'

// The 2D overworld DOM shell (the Act 0 redesign). It composites the revealed regions (pure
// model in overworldModel.ts), then DYNAMICALLY SIZES the monospace grid so the discovered world
// fits the available viewport — width AND height — clamped to a legible range, re-fitting on
// resize. When the world finally outgrows the screen (at the minimum font) the container scrolls.
// One delegated click listener hit-tests region hotspots. No engine logic lives here.

const MIN_FONT = 7
const MAX_FONT = 30
/** Reserve below the map for the page chrome (back button, footer) when sizing to height. */
const BOTTOM_RESERVE_PX = 96

export interface OverworldRendererOptions {
  readonly world: OverworldDef
  /** Dispatched when a revealed region is clicked. */
  readonly onRegion?: (action: string) => void
  /** Optional location describer for the map's aria-label. */
  readonly describeLocation?: (state: GameState) => string
}

export interface OverworldRenderer {
  render(state: GameState): void
  /** Re-fit the font to the current viewport without recomposing (cheap; used on resize). */
  refit(): void
  unmount(): void
}

export function createOverworldRenderer(
  root: HTMLElement,
  options: OverworldRendererOptions,
): OverworldRenderer {
  const doc = root.ownerDocument
  const view = doc.defaultView

  // Scroll/centre container; the grid lives inside as a single <pre>.
  const container = doc.createElement('div')
  container.className = 'overworld'
  const pre = doc.createElement('pre')
  pre.className = 'map-surface'
  pre.style.fontFamily = FONT_STACK
  pre.style.lineHeight = String(LINE_HEIGHT)
  pre.style.whiteSpace = 'pre'
  pre.style.margin = '0'
  container.appendChild(pre)
  root.appendChild(container)

  // Cell width / font ratio for monospace, measured once from the live font (≈0.6 for most).
  let charRatio = 0.6
  function measureCharRatio(): number {
    if (!view) return 0.6
    const probe = doc.createElement('pre')
    probe.className = 'map-surface'
    probe.style.position = 'absolute'
    probe.style.visibility = 'hidden'
    probe.style.left = '-9999px'
    probe.style.fontSize = '50px'
    probe.style.whiteSpace = 'pre'
    probe.textContent = 'X'.repeat(40)
    root.appendChild(probe)
    const rect = probe.getBoundingClientRect()
    probe.remove()
    return rect.width > 0 ? rect.width / 40 / 50 : 0.6
  }

  let gridW = 1
  let gridH = 1
  let fontPx = MAX_FONT
  let hotspotMap: ReadonlyMap<string, string> = new Map()

  /** The room available for the map, in CSS px. */
  function available(): { w: number; h: number } {
    const w = Math.max(40, container.clientWidth || root.clientWidth || 320)
    const top = container.getBoundingClientRect().top
    const winH = view?.innerHeight ?? 800
    const h = Math.max(80, winH - top - BOTTOM_RESERVE_PX)
    return { w, h }
  }

  /** Choose the font size so the gridW×gridH world fits both axes, clamped to a legible range. */
  function fit(): void {
    const { w, h } = available()
    const byWidth = w / (gridW * charRatio)
    const byHeight = h / (gridH * LINE_HEIGHT)
    fontPx = Math.max(MIN_FONT, Math.min(MAX_FONT, byWidth, byHeight))
    pre.style.fontSize = `${fontPx}px`
  }

  function paint(state: GameState): void {
    const { buffer } = composeOverworld(options.world, state)
    gridW = Math.max(1, buffer.width)
    gridH = Math.max(1, buffer.height)
    hotspotMap = buildHotspotMap(buffer.hotspots as readonly Hotspot[])
    pre.innerHTML = serialize(buffer)
    fit()
    if (options.describeLocation) markMeaningful(pre, options.describeLocation(state))
  }

  const clickHandler = (e: MouseEvent): void => {
    const rect = pre.getBoundingClientRect()
    const cellW = fontPx * charRatio
    const cellH = fontPx * LINE_HEIGHT
    const cell = hitTest({
      clientX: e.clientX,
      clientY: e.clientY,
      left: rect.left,
      top: rect.top,
      cellW,
      cellH,
    })
    if (!cell) return
    const action = actionAt(hotspotMap, cell.col, cell.row)
    if (action) options.onRegion?.(action)
  }
  pre.addEventListener('click', clickHandler)

  const onResize = (): void => fit()
  view?.addEventListener('resize', onResize)

  charRatio = measureCharRatio()

  return {
    render(state) {
      charRatio = measureCharRatio()
      paint(state)
    },
    refit: fit,
    unmount() {
      pre.removeEventListener('click', clickHandler)
      view?.removeEventListener('resize', onResize)
      container.remove()
      hotspotMap = new Map()
    },
  }
}

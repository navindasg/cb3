import type { StratumDef } from '@/engine/types/defs'
import type { GameState } from '@/engine/types/GameState'
import type { CellMetrics } from '@/render/font'
import type { Hotspot } from '@/render/CellBuffer'
import { CellBuffer } from '@/render/CellBuffer'
import { FONT_STACK, LINE_HEIGHT } from '@/render/font'
import { serialize } from '@/render/HtmlSerializer'
import { buildHotspotMap, actionAt } from '@/render/hotspotMap'
import { hitTest } from '@/render/Renderer'
import { markMeaningful } from '@/render/a11y'
import {
  resolveMap,
  visibleWindow,
  strataToRender,
  buildStratumBuffer,
  clampScrollY,
  type ResolvedMap,
} from '@/render/mapModel'

// The virtualized vertical-map DOM shell (ADR §7.5). It renders ONLY the strata in the
// scroll window (offscreen strata are never built), uses content-visibility:auto on each
// stratum block and transform:translateY for compositor-driven scrolling (never animated
// scrollTop), dispatches zone clicks through one delegated listener, and persists/restores
// scrollY via injected callbacks (so this file stays free of engine-logic — it asks the
// host to read/write state.numbers.scrollY). All map model logic is the pure mapModel.ts.

const SCROLL_KEY = 'scrollY'

export interface MapRendererOptions {
  readonly strata: readonly StratumDef[]
  readonly metrics: CellMetrics
  /** Visible viewport in rows; drives virtualization windowing. */
  readonly viewportRows: number
  /** Dispatched when a revealed zone is clicked. */
  readonly onZone?: (action: string) => void
  /** Persist scrollY (host writes state.numbers.scrollY). */
  readonly persistScrollY?: (scrollY: number) => void
  /** Read the player's location description for the map's aria-label. */
  readonly describeLocation?: (state: GameState) => string
}

export interface MapRenderer {
  /** Render the revealed map for `state`, restoring scrollY from state.numbers.scrollY. */
  render(state: GameState): void
  /** Scroll to a row (clamped), persisting and re-applying the transform. */
  scrollTo(rowY: number): void
  /** Current scroll offset in rows. */
  scrollY(): number
  unmount(): void
}

/** Read the restored scroll offset for a state (0 when unset). */
function restoredScrollY(state: GameState): number {
  return state.numbers[SCROLL_KEY] ?? 0
}

export function createMapRenderer(root: HTMLElement, options: MapRendererOptions): MapRenderer {
  const doc = root.ownerDocument
  const { viewportRows } = options
  // Metrics are re-measured from the live DOM on each paint so hit-testing matches the actual
  // (responsive) rendered cell size; options.metrics is the fallback for jsdom/tests (0 rects).
  let metrics: CellMetrics = options.metrics

  function measureMetrics(): CellMetrics {
    const view = doc.defaultView
    if (!view) return options.metrics
    const probe = doc.createElement('pre')
    probe.className = 'map-surface'
    probe.style.position = 'absolute'
    probe.style.visibility = 'hidden'
    probe.style.left = '-9999px'
    probe.style.whiteSpace = 'pre'
    probe.textContent = 'X'.repeat(40)
    root.appendChild(probe)
    const rect = probe.getBoundingClientRect()
    const fontSizePx = parseFloat(view.getComputedStyle(probe).fontSize || '0')
    probe.remove()
    if (rect.width > 0 && fontSizePx > 0) {
      return { cellW: rect.width / 40, cellH: fontSizePx * LINE_HEIGHT }
    }
    return options.metrics
  }

  const pre = doc.createElement('pre')
  pre.className = 'map-surface'
  pre.style.fontFamily = FONT_STACK
  pre.style.lineHeight = String(LINE_HEIGHT)
  pre.style.whiteSpace = 'pre'
  pre.style.margin = '0'
  pre.style.willChange = 'transform'
  root.appendChild(pre)

  let scroll = 0
  let resolved: ResolvedMap = { placed: [], totalRows: 0, width: 0 }
  let hotspotMap: ReadonlyMap<string, string> = new Map()

  // ONE delegated click listener; reads the latest hotspotMap each event (never re-bound).
  const clickHandler = (e: MouseEvent): void => {
    const rect = pre.getBoundingClientRect()
    // The grid is translated up by `scroll` rows, and that translate is reflected in
    // rect.top, so hitTest already yields the absolute map row — no `+ scroll` here.
    const cell = hitTest({
      clientX: e.clientX,
      clientY: e.clientY,
      left: rect.left,
      top: rect.top,
      cellW: metrics.cellW,
      cellH: metrics.cellH,
    })
    if (!cell) return
    const action = actionAt(hotspotMap, cell.col, cell.row)
    if (action) options.onZone?.(action)
  }
  pre.addEventListener('click', clickHandler)

  function applyTransform(): void {
    pre.style.transform = `translateY(${-scroll * metrics.cellH}px)`
  }

  function paint(state: GameState): void {
    metrics = measureMetrics()
    resolved = resolveMap(options.strata, state)
    const window = visibleWindow(scroll, viewportRows, resolved.totalRows)
    const visible = strataToRender(resolved, window)

    // Compose only the visible strata into one buffer the height of the full map, so
    // map-row coordinates (used by hotspots) stay absolute while we translateY the <pre>.
    let composed = CellBuffer.create(resolved.width, Math.max(resolved.totalRows, 0))
    const allHotspots: Hotspot[] = []

    for (const placed of visible) {
      const buffer = buildStratumBuffer(placed.def, state, resolved.width)
      composed = composed.drawArea(0, placed.topRow, buffer)
      for (const h of buffer.hotspots) {
        allHotspots.push({ ...h, y: h.y + placed.topRow })
      }
    }

    hotspotMap = buildHotspotMap(allHotspots)
    pre.innerHTML = serialize(composed)
    applyTransform()

    // content-visibility on the surface: offscreen rows cost nothing to lay out.
    pre.style.contentVisibility = 'auto'
    pre.style.containIntrinsicSize = `${resolved.totalRows * metrics.cellH}px`

    if (options.describeLocation) {
      markMeaningful(pre, options.describeLocation(state))
    }
  }

  function setScroll(rowY: number): void {
    scroll = clampScrollY(rowY, resolved.totalRows, viewportRows)
    applyTransform()
    options.persistScrollY?.(scroll)
  }

  return {
    render(state) {
      scroll = clampScrollY(restoredScrollY(state), Number.MAX_SAFE_INTEGER, viewportRows)
      paint(state)
      // Re-clamp now that totalRows is known, then re-window if scroll changed materially.
      const clamped = clampScrollY(restoredScrollY(state), resolved.totalRows, viewportRows)
      if (clamped !== scroll) {
        scroll = clamped
        paint(state)
      }
    },
    scrollTo(rowY) {
      setScroll(rowY)
    },
    scrollY: () => scroll,
    unmount() {
      pre.removeEventListener('click', clickHandler)
      pre.remove()
      hotspotMap = new Map()
    },
  }
}

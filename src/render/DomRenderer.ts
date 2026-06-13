import type { CellBuffer, Hotspot, GlowSpec } from '@/render/CellBuffer'
import type { Renderer, HotspotClickEvent } from '@/render/Renderer'
import { hitTest } from '@/render/Renderer'
import { serialize } from '@/render/HtmlSerializer'
import { buildHotspotMap, actionAt, cellKey } from '@/render/hotspotMap'
import { buildGlowMap, diffGlow } from '@/render/glowOverlay'
import { FONT_STACK, LINE_HEIGHT, type CellMetrics } from '@/render/font'

// The default surface renderer (ADR §7.1/§7.3). It owns ONE <pre> and paints via
// innerHTML, and installs EXACTLY ONE delegated 'click' + one 'mousemove' listener at
// mount — never per render — so listeners can't accumulate across frames (the bug
// CB2's per-render jQuery re-binding had). Pointer pixels are converted to integer cell
// coords (pure hitTest), then dispatched by the sparse hotspot map. A separate overlay
// div hosts the reconciled pulsing-glow spans.

export interface DomRendererOptions {
  /** Fixed cell metrics. If omitted, measured from the mounted <pre> via a 1ch probe. */
  readonly metrics?: CellMetrics
  /** Dispatched when a hotspot cell is clicked. */
  readonly onHotspot?: (event: HotspotClickEvent) => void
  /** Dispatched (deduped per cell) when the pointer moves over a hotspot, for hover UI. */
  readonly onHover?: (event: HotspotClickEvent | null) => void
}

export class DomRenderer implements Renderer {
  private readonly options: DomRendererOptions
  private root: HTMLElement | null = null
  private pre: HTMLPreElement | null = null
  private overlay: HTMLDivElement | null = null
  private metrics: CellMetrics | null = null

  // The live render state the delegated listeners read. Reassigned each render; the
  // listeners close over `this`, so they always see the latest map without re-binding.
  private hotspotMap: ReadonlyMap<string, string> = new Map()
  private glowMap: ReadonlyMap<string, GlowSpec> = new Map()
  private lastHoverKey: string | null = null

  private clickHandler: ((e: MouseEvent) => void) | null = null
  private moveHandler: ((e: MouseEvent) => void) | null = null

  constructor(options: DomRendererOptions = {}) {
    this.options = options
  }

  mount(root: HTMLElement): void {
    if (this.root) throw new Error('DomRenderer.mount: already mounted')
    this.root = root

    const pre = root.ownerDocument.createElement('pre')
    pre.style.fontFamily = FONT_STACK
    pre.style.lineHeight = String(LINE_HEIGHT)
    pre.style.whiteSpace = 'pre'
    pre.style.margin = '0'
    this.pre = pre

    const overlay = root.ownerDocument.createElement('div')
    overlay.className = 'glow-overlay'
    overlay.style.position = 'absolute'
    overlay.style.pointerEvents = 'none'
    overlay.style.contain = 'paint'
    this.overlay = overlay

    root.appendChild(pre)
    root.appendChild(overlay)

    // ONE delegated listener of each kind, installed once. They read this.hotspotMap,
    // which each render reassigns — so dispatch always matches the current frame.
    this.clickHandler = (e) => this.handlePointer(e, 'click')
    this.moveHandler = (e) => this.handlePointer(e, 'move')
    pre.addEventListener('click', this.clickHandler)
    pre.addEventListener('mousemove', this.moveHandler)
  }

  render(
    _prev: CellBuffer | null,
    next: CellBuffer,
    hotspots?: readonly Hotspot[],
    glows?: readonly GlowSpec[],
  ): void {
    const pre = this.pre
    const overlay = this.overlay
    if (!pre || !overlay) throw new Error('DomRenderer.render: not mounted')

    pre.innerHTML = serialize(next)

    // Rebuild the dispatch map from the override list when given, else the buffer's own.
    const effectiveHotspots = hotspots ?? next.hotspots
    this.hotspotMap = buildHotspotMap(effectiveHotspots)

    const effectiveGlows = glows ?? next.glows
    this.reconcileGlow(buildGlowMap(effectiveGlows))
  }

  /** Replace the glow overlay's spans by diffing against the previous glow set. */
  private reconcileGlow(nextGlow: ReadonlyMap<string, GlowSpec>): void {
    const overlay = this.overlay
    const metrics = this.resolveMetrics()
    if (!overlay) return

    const diff = diffGlow(this.glowMap, nextGlow)
    for (const key of diff.removed) {
      const el = overlay.querySelector<HTMLElement>(`[data-cell="${key}"]`)
      if (el) overlay.removeChild(el)
    }
    for (const spec of diff.added) {
      const key = cellKey(spec.x, spec.y)
      const existing = overlay.querySelector<HTMLElement>(`[data-cell="${key}"]`)
      if (existing) overlay.removeChild(existing)
      const span = overlay.ownerDocument.createElement('span')
      span.className = spec.className
      span.setAttribute('data-cell', key)
      span.style.position = 'absolute'
      if (metrics) {
        span.style.left = `${spec.x * metrics.cellW}px`
        span.style.top = `${spec.y * metrics.cellH}px`
      }
      overlay.appendChild(span)
    }
    this.glowMap = nextGlow
  }

  private resolveMetrics(): CellMetrics | null {
    if (this.options.metrics) return this.options.metrics
    if (this.metrics) return this.metrics
    // Best-effort DOM measurement; in jsdom rects are zero, so callers pass metrics.
    const pre = this.pre
    if (!pre) return null
    const rect = pre.getBoundingClientRect()
    const cols = (pre.textContent ?? '').split('\n')[0]?.length ?? 0
    if (rect.width > 0 && cols > 0) {
      this.metrics = { cellW: rect.width / cols, cellH: rect.height || rect.width / cols }
    }
    return this.metrics
  }

  private handlePointer(e: MouseEvent, kind: 'click' | 'move'): void {
    const pre = this.pre
    const metrics = this.resolveMetrics()
    if (!pre || !metrics) return
    const rect = pre.getBoundingClientRect()
    const cell = hitTest({
      clientX: e.clientX,
      clientY: e.clientY,
      left: rect.left,
      top: rect.top,
      cellW: metrics.cellW,
      cellH: metrics.cellH,
    })
    if (!cell) {
      if (kind === 'move' && this.lastHoverKey !== null) {
        this.lastHoverKey = null
        this.options.onHover?.(null)
      }
      return
    }
    const action = actionAt(this.hotspotMap, cell.col, cell.row)
    if (kind === 'click') {
      if (action) this.options.onHotspot?.({ action, col: cell.col, row: cell.row })
      return
    }
    // move: dedupe so onHover fires only when the hovered cell changes.
    const key = cellKey(cell.col, cell.row)
    if (key === this.lastHoverKey) return
    this.lastHoverKey = key
    this.options.onHover?.(action ? { action, col: cell.col, row: cell.row } : null)
  }

  unmount(): void {
    const pre = this.pre
    if (pre) {
      if (this.clickHandler) pre.removeEventListener('click', this.clickHandler)
      if (this.moveHandler) pre.removeEventListener('mousemove', this.moveHandler)
      pre.remove()
    }
    this.overlay?.remove()
    this.pre = null
    this.overlay = null
    this.root = null
    this.clickHandler = null
    this.moveHandler = null
    this.hotspotMap = new Map()
    this.glowMap = new Map()
    this.lastHoverKey = null
  }
}

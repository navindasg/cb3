import type { CellMetrics } from '@/render/font'
import type { Hotspot } from '@/render/CellBuffer'
import { CellBuffer } from '@/render/CellBuffer'
import { FONT_STACK, LINE_HEIGHT } from '@/render/font'
import { serialize } from '@/render/HtmlSerializer'
import { buildHotspotMap, actionAt } from '@/render/hotspotMap'
import { hitTest } from '@/render/Renderer'

// The DOM arena renderer (Phase 1 plan E4; ADR §7.1). It composites a quest's entities
// + their HP bars + an exit hotspot into ONE CellBuffer and paints it through a single
// <pre>, with one delegated click listener (the exit button). Phase 1 is DOM-only; the
// canvas+atlas arena renderer is deferred to Phase 3 behind the same shape. This file is
// pure rendering — it consumes a plain view model (no engine import), keeping the layering
// strict (render/ never reaches into engine logic).

/** A single entity to draw: its glyph, top-left cell, and HP for the bar above it. */
export interface ArenaEntityView {
  readonly glyph: string
  readonly x: number
  readonly y: number
  readonly hp: number
  readonly maxHp: number
  /** Optional inline colour for the glyph. */
  readonly color?: string
}

/** A rectangular exit affordance composited into the arena and wired to an action. */
export interface ArenaExit {
  readonly x: number
  readonly y: number
  readonly label: string
  readonly action: string
}

export interface ArenaModel {
  readonly width: number
  readonly height: number
  readonly entities: readonly ArenaEntityView[]
  readonly exit?: ArenaExit
}

export interface ArenaRendererOptions {
  readonly metrics: CellMetrics
  /** Dispatched when the exit hotspot is clicked. */
  readonly onExit?: (action: string) => void
  /** Number of HP-bar segments drawn above each damaged entity. Default 5. */
  readonly hpBarWidth?: number
}

const HP_FULL = '#'
const HP_EMPTY = '-'

export interface ArenaRenderer {
  render(model: ArenaModel): void
  /** The composited buffer of the last render (exposed for tests/inspection). */
  lastBuffer(): CellBuffer | null
  unmount(): void
}

/** Compose an arena view model into one CellBuffer: entities, HP bars, then the exit. Pure. */
export function composeArena(model: ArenaModel, hpBarWidth = 5): CellBuffer {
  let buffer = CellBuffer.create(Math.max(0, model.width), Math.max(0, model.height))

  for (const e of model.entities) {
    buffer = buffer.drawString(e.x, e.y, e.glyph)
    if (e.color) {
      buffer = buffer.withStyle({ x: e.x, y: e.y, length: e.glyph.length, color: e.color })
    }
    // HP bar drawn one row above the entity, only when it has taken damage.
    if (e.maxHp > 0 && e.hp < e.maxHp && e.y - 1 >= 0) {
      buffer = buffer.drawString(e.x, e.y - 1, hpBar(e.hp, e.maxHp, hpBarWidth))
    }
  }

  if (model.exit) {
    buffer = buffer.drawString(model.exit.x, model.exit.y, model.exit.label)
    buffer = buffer.withHotspot({
      x: model.exit.x,
      y: model.exit.y,
      width: model.exit.label.length,
      height: 1,
      action: model.exit.action,
    })
  }

  return buffer
}

/** A `width`-segment HP bar: filled segments proportional to hp/maxHp. */
export function hpBar(hp: number, maxHp: number, width: number): string {
  const clamped = Math.max(0, Math.min(maxHp, hp))
  const filled = maxHp > 0 ? Math.round((clamped / maxHp) * width) : 0
  return HP_FULL.repeat(filled) + HP_EMPTY.repeat(Math.max(0, width - filled))
}

export function createArenaRenderer(
  root: HTMLElement,
  options: ArenaRendererOptions,
): ArenaRenderer {
  const doc = root.ownerDocument
  const { metrics } = options
  const hpBarWidth = options.hpBarWidth ?? 5

  const pre = doc.createElement('pre')
  pre.className = 'arena-surface'
  pre.style.fontFamily = FONT_STACK
  pre.style.lineHeight = String(LINE_HEIGHT)
  pre.style.whiteSpace = 'pre'
  pre.style.margin = '0'
  root.appendChild(pre)

  let hotspotMap: ReadonlyMap<string, string> = new Map()
  let buffer: CellBuffer | null = null

  // ONE delegated click listener; reads the latest hotspotMap each event (never re-bound).
  const clickHandler = (e: MouseEvent): void => {
    const rect = pre.getBoundingClientRect()
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
    if (action) options.onExit?.(action)
  }
  pre.addEventListener('click', clickHandler)

  return {
    render(model) {
      buffer = composeArena(model, hpBarWidth)
      hotspotMap = buildHotspotMap(buffer.hotspots as readonly Hotspot[])
      pre.innerHTML = serialize(buffer)
    },
    lastBuffer: () => buffer,
    unmount() {
      pre.removeEventListener('click', clickHandler)
      pre.remove()
      hotspotMap = new Map()
      buffer = null
    },
  }
}

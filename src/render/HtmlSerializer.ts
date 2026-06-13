import type { CellBuffer, StyleRegion, Hotspot } from '@/render/CellBuffer'

// Pure CellBuffer -> HTML string. NO DOM access (no document, no innerHTML here) —
// the DomRenderer is the only place that touches the DOM. We build each row's markup
// by splicing the opening/closing <span> tags for style regions and hotspots into the
// raw row text. The splices are applied RIGHT-TO-LEFT (descending column) so an earlier
// (lower-column) insertion never shifts the offsets a later one was computed against —
// CB2's descending-x invariant (Brief 4).

interface Insertion {
  /** Column at which to insert (0..width). */
  readonly col: number
  /** 'open' tags sort after 'close' tags at the same column so adjacent ranges nest cleanly. */
  readonly kind: 'open' | 'close'
  readonly html: string
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
}

/** Escape the five text-context HTML metacharacters so ASCII art renders literally. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (ch) => HTML_ESCAPES[ch] ?? ch)
}

function styleOpenTag(region: StyleRegion): string {
  const attrs: string[] = []
  if (region.className) attrs.push(`class="${escapeHtml(region.className)}"`)
  if (region.color) attrs.push(`style="color:${escapeHtml(region.color)}"`)
  return `<span ${attrs.join(' ')}>`
}

function hotspotOpenTag(hotspot: Hotspot): string {
  return `<span data-action="${escapeHtml(hotspot.action)}">`
}

/** Clamp a column to [0, width] so out-of-range regions splice at the edges, never beyond. */
function clampCol(col: number, width: number): number {
  return Math.max(0, Math.min(width, col))
}

/**
 * Build the insertion list for one row from the style/hotspot ranges that intersect it.
 * A hotspot spanning multiple rows contributes an open/close pair on each covered row.
 */
function rowInsertions(
  y: number,
  width: number,
  styles: readonly StyleRegion[],
  hotspots: readonly Hotspot[],
): Insertion[] {
  const insertions: Insertion[] = []

  for (const region of styles) {
    if (region.y !== y || region.length <= 0) continue
    const open = clampCol(region.x, width)
    const close = clampCol(region.x + region.length, width)
    if (close <= open) continue
    insertions.push({ col: open, kind: 'open', html: styleOpenTag(region) })
    insertions.push({ col: close, kind: 'close', html: '</span>' })
  }

  for (const hotspot of hotspots) {
    if (y < hotspot.y || y >= hotspot.y + hotspot.height || hotspot.width <= 0) continue
    const open = clampCol(hotspot.x, width)
    const close = clampCol(hotspot.x + hotspot.width, width)
    if (close <= open) continue
    insertions.push({ col: open, kind: 'open', html: hotspotOpenTag(hotspot) })
    insertions.push({ col: close, kind: 'close', html: '</span>' })
  }

  return insertions
}

function serializeRow(
  rawRow: string,
  insertions: readonly Insertion[],
): string {
  if (insertions.length === 0) return escapeHtml(rawRow)

  // Sort descending by column so we splice right-to-left (each html chunk is PREPENDED,
  // so later-processed chunks land further left). At the same column we want the final
  // left-to-right order to be `</span><span>` — close before open — so the close tag must
  // be processed LAST (lands leftmost): order 'open' before 'close' in the array.
  const ordered = [...insertions].sort((a, b) => {
    if (a.col !== b.col) return b.col - a.col
    return a.kind === b.kind ? 0 : a.kind === 'open' ? -1 : 1
  })

  // Escape the raw text once; splice into the *unescaped-index* positions by escaping
  // each segment as we cut it. We walk segments between cut points to keep escaping correct.
  let result = ''
  let cursor = rawRow.length
  for (const ins of ordered) {
    const segment = rawRow.slice(ins.col, cursor)
    result = ins.html + escapeHtml(segment) + result
    cursor = ins.col
  }
  result = escapeHtml(rawRow.slice(0, cursor)) + result
  return result
}

/** Serialize a CellBuffer to an HTML string: one styled row per line, joined by '\n'. */
export function serialize(buffer: CellBuffer): string {
  const lines: string[] = []
  for (let y = 0; y < buffer.height; y++) {
    const rawRow = buffer.rowAt(y) ?? ''
    const insertions = rowInsertions(y, buffer.width, buffer.styles, buffer.hotspots)
    lines.push(serializeRow(rawRow, insertions))
  }
  return lines.join('\n')
}

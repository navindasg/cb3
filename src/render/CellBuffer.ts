// The shared, immutable glyph-grid model behind every renderer (DOM now, canvas in
// Phase 3). A fixed-width character grid plus three sidecar lists — style regions,
// hotspots, glow specs — that decorate ranges of cells without touching the chars.
// EVERY operation returns a NEW buffer; the receiver is never mutated. Pure: no DOM.
//
// Transparency uses a designated "alpha" char (default ' '): when one buffer is drawn
// over another, alpha cells are skipped so the lower layer shows through. This is the
// ASCII analogue of an alpha channel (Brief 4's alpha/meta-alpha convention).

/** A coloured / CSS-classed run of cells on one row, columns [startX, startX+length). */
export interface StyleRegion {
  readonly x: number
  readonly y: number
  readonly length: number
  /** Inline CSS colour, e.g. '#ffd27f'. Serialized as a <span style="color:…">. */
  readonly color?: string
  /** Static CSS class, e.g. 'glow-sun'. Serialized as a <span class="…">. */
  readonly className?: string
}

/** A clickable region dispatched by its `action` id via the delegated listener. */
export interface Hotspot {
  readonly x: number
  readonly y: number
  /** Width in cells (>=1). */
  readonly width: number
  /** Height in cells (>=1). */
  readonly height: number
  /** The data-action id dispatched on click. */
  readonly action: string
}

/** A glow overlay cell — an opacity-animated decoration reconciled separately from text. */
export interface GlowSpec {
  readonly x: number
  readonly y: number
  /** CSS class controlling the glow colour/shadow (e.g. 'glow-moonpop'). */
  readonly className: string
}

export interface CellBufferOptions {
  /** The char treated as transparent during drawArea compositing. Default ' '. */
  readonly transparentChar?: string
}

const DEFAULT_TRANSPARENT = ' '

export class CellBuffer {
  readonly width: number
  readonly height: number
  readonly transparentChar: string
  /** One string per row, each exactly `width` chars. */
  private readonly rows: readonly string[]
  readonly styles: readonly StyleRegion[]
  readonly hotspots: readonly Hotspot[]
  readonly glows: readonly GlowSpec[]

  private constructor(
    width: number,
    height: number,
    rows: readonly string[],
    transparentChar: string,
    styles: readonly StyleRegion[],
    hotspots: readonly Hotspot[],
    glows: readonly GlowSpec[],
  ) {
    this.width = width
    this.height = height
    this.rows = rows
    this.transparentChar = transparentChar
    this.styles = styles
    this.hotspots = hotspots
    this.glows = glows
  }

  /** A blank buffer of `width × height`, filled with the transparent char. */
  static create(width: number, height: number, options: CellBufferOptions = {}): CellBuffer {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 0 || height < 0) {
      throw new Error('CellBuffer.create: width/height must be non-negative integers')
    }
    const transparentChar = options.transparentChar ?? DEFAULT_TRANSPARENT
    if (transparentChar.length !== 1) {
      throw new Error('CellBuffer.create: transparentChar must be a single character')
    }
    const blankRow = transparentChar.repeat(width)
    const rows = Array.from({ length: height }, () => blankRow)
    return new CellBuffer(width, height, rows, transparentChar, [], [], [])
  }

  /** The exact `width`-char string for `y`, or undefined if out of range. */
  rowAt(y: number): string | undefined {
    return this.rows[y]
  }

  /** The char at (x, y), or the transparent char if out of bounds. */
  charAt(x: number, y: number): string {
    const row = this.rows[y]
    if (row === undefined || x < 0 || x >= this.width) return this.transparentChar
    return row[x] ?? this.transparentChar
  }

  private withRows(rows: readonly string[]): CellBuffer {
    return new CellBuffer(
      this.width,
      this.height,
      rows,
      this.transparentChar,
      this.styles,
      this.hotspots,
      this.glows,
    )
  }

  /**
   * Draw `text` starting at (x, y), clipped to the grid. Returns a new buffer.
   * Chars outside the grid are dropped; a negative `x` clips the left of the text.
   */
  drawString(x: number, y: number, text: string): CellBuffer {
    if (y < 0 || y >= this.height || text.length === 0) return this
    const row = this.rows[y]
    if (row === undefined) return this

    // Visible slice of the text, and where it lands on the row.
    const startCol = Math.max(0, x)
    const textStart = startCol - x // chars of `text` skipped on the left
    const endCol = Math.min(this.width, x + text.length)
    if (endCol <= startCol) return this

    const visible = text.slice(textStart, textStart + (endCol - startCol))
    const nextRow = row.slice(0, startCol) + visible + row.slice(endCol)
    const rows = this.rows.map((r, i) => (i === y ? nextRow : r))
    return this.withRows(rows)
  }

  /**
   * Composite `other` onto this buffer with its top-left at (x, y). Cells equal to
   * `other.transparentChar` are skipped so this buffer shows through (alpha). Style
   * regions, hotspots and glows from `other` are offset by (x, y) and merged in.
   * Returns a new buffer.
   */
  drawArea(x: number, y: number, other: CellBuffer): CellBuffer {
    let next: CellBuffer = this
    for (let oy = 0; oy < other.height; oy++) {
      const destY = y + oy
      if (destY < 0 || destY >= next.height) continue
      const sourceRow = other.rowAt(oy)
      if (sourceRow === undefined) continue
      // Draw one contiguous run at a time, breaking on transparent chars so the
      // lower layer shows through gaps. Cheaper than per-char drawString calls.
      next = drawRowWithAlpha(next, x, destY, sourceRow, other.transparentChar)
    }

    const offsetStyles = other.styles.map((s) => ({ ...s, x: s.x + x, y: s.y + y }))
    const offsetHotspots = other.hotspots.map((h) => ({ ...h, x: h.x + x, y: h.y + y }))
    const offsetGlows = other.glows.map((g) => ({ ...g, x: g.x + x, y: g.y + y }))

    return new CellBuffer(
      next.width,
      next.height,
      next.rows,
      next.transparentChar,
      [...next.styles, ...offsetStyles],
      [...next.hotspots, ...offsetHotspots],
      [...next.glows, ...offsetGlows],
    )
  }

  /** Append a style region. Returns a new buffer. */
  withStyle(region: StyleRegion): CellBuffer {
    return new CellBuffer(
      this.width,
      this.height,
      this.rows,
      this.transparentChar,
      [...this.styles, region],
      this.hotspots,
      this.glows,
    )
  }

  /** Append a clickable hotspot. Returns a new buffer. */
  withHotspot(hotspot: Hotspot): CellBuffer {
    return new CellBuffer(
      this.width,
      this.height,
      this.rows,
      this.transparentChar,
      this.styles,
      [...this.hotspots, hotspot],
      this.glows,
    )
  }

  /** Append a glow-overlay cell. Returns a new buffer. */
  withGlow(glow: GlowSpec): CellBuffer {
    return new CellBuffer(
      this.width,
      this.height,
      this.rows,
      this.transparentChar,
      this.styles,
      this.hotspots,
      [...this.glows, glow],
    )
  }

  /** The grid as plain text rows joined by newlines (no styling). */
  toText(): string {
    return this.rows.join('\n')
  }
}

/**
 * Overlay `sourceRow` onto row `destY` of `buffer` at column `x`, treating
 * `transparentChar` as a hole. Returns a new buffer. Pure helper for drawArea.
 */
function drawRowWithAlpha(
  buffer: CellBuffer,
  x: number,
  destY: number,
  sourceRow: string,
  transparentChar: string,
): CellBuffer {
  let next = buffer
  let runStart = -1
  for (let i = 0; i <= sourceRow.length; i++) {
    const ch = i < sourceRow.length ? sourceRow[i] : transparentChar
    const opaque = i < sourceRow.length && ch !== transparentChar
    if (opaque && runStart < 0) {
      runStart = i
    } else if (!opaque && runStart >= 0) {
      const run = sourceRow.slice(runStart, i)
      next = next.drawString(x + runStart, destY, run)
      runStart = -1
    }
  }
  return next
}

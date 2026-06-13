// Cell metrics + font loading for the ASCII grid. The grid only aligns if every cell
// is exactly cellW × cellH, which requires the monospace font to be loaded BEFORE the
// first render (else FOUT swaps the metrics out from under the layout — ADR §7.4).
//
// We self-host JetBrains Mono via @font-face in CSS, but ALWAYS ship a robust system
// monospace fallback stack so the grid renders even when the font binary is absent
// (it is, in this repo — see deviations). The measurement is split out as a pure
// function so the metric math is unit-testable without a real browser.

/** The font stack: JetBrains Mono first, then a hardened system-monospace fallback. */
export const FONT_STACK =
  "'JetBrains Mono', ui-monospace, 'SF Mono', 'Cascadia Mono', 'Segoe UI Mono', " +
  "'Roboto Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace"

/** The @font-face family name we register; consumers never hardcode the literal. */
export const FONT_FAMILY = 'JetBrains Mono'

/** Line-height multiple validated for box-drawing alignment (ADR §7.4: 120%). */
export const LINE_HEIGHT = 1.2

export interface CellMetrics {
  /** Width of one character cell in CSS pixels. */
  readonly cellW: number
  /** Height of one character cell (font size × line-height) in CSS pixels. */
  readonly cellH: number
}

/**
 * Derive cell metrics from a measured 1-char advance and the font size. Pure: the DOM
 * measurement (a 1ch-wide probe element) is done by the caller and the raw numbers are
 * passed in. cellH is fontSize × LINE_HEIGHT, matching the CSS line-height we set.
 */
export function deriveMetrics(oneChWidthPx: number, fontSizePx: number): CellMetrics {
  if (!(oneChWidthPx > 0) || !(fontSizePx > 0)) {
    throw new Error('deriveMetrics: oneChWidthPx and fontSizePx must be positive')
  }
  return { cellW: oneChWidthPx, cellH: fontSizePx * LINE_HEIGHT }
}

/** True when the runtime exposes the CSS Font Loading API (absent in jsdom/old engines). */
export function hasFontLoadingApi(doc: Document = document): boolean {
  return typeof (doc as Document & { fonts?: unknown }).fonts === 'object' && doc.fonts != null
}

export interface FontLoadResult {
  /** Whether the JetBrains Mono binary actually loaded (false ⇒ fallback stack in use). */
  readonly loaded: boolean
}

/**
 * Best-effort: wait for JetBrains Mono before the first render. Never rejects — if the
 * API is missing or the binary is absent, we resolve `{ loaded: false }` and the caller
 * proceeds on the fallback stack (the grid still aligns; only the glyph shapes differ).
 */
export async function loadFont(
  doc: Document = document,
  fontSizePx = 16,
): Promise<FontLoadResult> {
  if (!hasFontLoadingApi(doc)) return { loaded: false }
  try {
    await doc.fonts.load(`${fontSizePx}px ${FONT_FAMILY}`)
    return { loaded: doc.fonts.check(`${fontSizePx}px ${FONT_FAMILY}`) }
  } catch {
    // A missing/blocked binary must never break the boot — fall back silently.
    return { loaded: false }
  }
}

import type { GameState } from '@/engine/types/GameState'
import { setFlag } from '@/engine/state/reducers'
import { VIEWPORT_LINES } from '@/content/moon/contextWindow'

// The context window (§28) — the moon-hatch reveal + the terminal's pure scroll machine. Pure &
// immutable, mirroring engine/content/observationDeck (a reveal latch) + hollowCore (a state cursor):
// the hatch is a one-way reveal flag (open it once, it stays open — there is nothing to farm, the
// reward is the notes), and the scroll is a pure window over the fixed lines the content owns. The
// scroll position is EPHEMERAL (the screen holds the cursor in its closure and passes it back in), so
// it needs no GameState field and no schema bump — the machine here is a set of pure integer helpers.
//
// ADR §3: the engine re-declares the content flag literal in lock-step (the moonStrata idiom — it never
// imports a content FLAG value). It MAY import content CONFIG data (the viewport height — data, not logic).

/**
 * Kept in lock-step with content/moon/contextWindow.CONTEXT_HATCH_OPENED_FLAG (the moonStrata idiom —
 * the engine re-declares the literal rather than importing the content value, ADR §3). Set the first
 * time the hatch is prised open; read forever after to keep the terminal reachable.
 */
const CONTEXT_HATCH_OPENED_FLAG = 'contextHatchOpened'

/** Whether the maintenance hatch has been opened (the terminal is reachable) — reads the flag. Strict ===. */
export function hatchOpened(state: GameState): boolean {
  return state.flags[CONTEXT_HATCH_OPENED_FLAG] === true
}

/**
 * Open the hatch: set the reveal flag. Idempotent + commit-once — a second call (already open) returns
 * the SAME reference, so re-opening changes nothing and there is nothing to farm. Immutable. This is the
 * moon-section's reveal predicate: once true, the screen shows the terminal entry instead of the panel.
 */
export function openHatch(state: GameState): GameState {
  if (hatchOpened(state)) return state
  return setFlag(state, CONTEXT_HATCH_OPENED_FLAG, true)
}

// --- the terminal's pure scroll machine (ephemeral cursor; no GameState) --------------------------------

/**
 * The furthest the cursor can scroll for a note of `lineCount` lines shown `viewport` at a time: the top
 * index of the LAST full window, or 0 when the whole note already fits (never negative). Pure.
 */
export function maxScroll(lineCount: number, viewport: number = VIEWPORT_LINES): number {
  return Math.max(0, lineCount - viewport)
}

/**
 * Clamp a raw cursor into [0, maxScroll] and floor it — so a corrupt or over-large cursor can never index
 * past the last window nor go negative. Pure; the single guard every scroll helper funnels through.
 */
export function clampCursor(cursor: number, lineCount: number, viewport: number = VIEWPORT_LINES): number {
  const max = maxScroll(lineCount, viewport)
  const floored = Math.floor(cursor)
  if (floored < 0) return 0
  if (floored > max) return max
  return floored
}

/**
 * Advance the scroll cursor by `delta` lines (negative scrolls back up), clamped into range. Pure — takes
 * the current cursor and the note's shape, returns the next cursor. The screen keeps the cursor in its own
 * closure and passes it here on each scroll click; nothing persists.
 */
export function scrollBy(
  cursor: number,
  delta: number,
  lineCount: number,
  viewport: number = VIEWPORT_LINES,
): number {
  return clampCursor(cursor + delta, lineCount, viewport)
}

/** Whether the cursor sits at the very top (nothing above the window). Pure. */
export function atTop(cursor: number, lineCount: number, viewport: number = VIEWPORT_LINES): boolean {
  return clampCursor(cursor, lineCount, viewport) <= 0
}

/** Whether the cursor sits at the bottom (the last line is in view; cannot scroll further down). Pure. */
export function atBottom(cursor: number, lineCount: number, viewport: number = VIEWPORT_LINES): boolean {
  return clampCursor(cursor, lineCount, viewport) >= maxScroll(lineCount, viewport)
}

/**
 * The window of lines visible at `cursor`: `viewport` lines starting at the clamped cursor (fewer only if
 * the whole note is shorter than the viewport). Pure — returns a fresh slice of the caller's lines, never
 * mutating them. The single source of truth for what the terminal draws.
 */
export function visibleWindow(
  lines: readonly string[],
  cursor: number,
  viewport: number = VIEWPORT_LINES,
): readonly string[] {
  const start = clampCursor(cursor, lines.length, viewport)
  return lines.slice(start, start + viewport)
}

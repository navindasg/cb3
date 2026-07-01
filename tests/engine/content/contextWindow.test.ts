import {
  hatchOpened,
  openHatch,
  maxScroll,
  clampCursor,
  scrollBy,
  atTop,
  atBottom,
  visibleWindow,
} from '@/engine/content/contextWindow'
import { CONTEXT_HATCH_OPENED_FLAG } from '@/content/flags'
import {
  CONTEXT_WINDOW_LINES,
  SECOND_PANEL_STUB,
  VIEWPORT_LINES,
  HATCH_LABEL,
  HATCH_STENCIL,
  HATCH_HEADING,
  TERMINAL_HEADING,
} from '@/content/moon/contextWindow'
import { createDefaultSave } from '@/engine/state/defaultSave'
import type { GameState } from '@/engine/types/GameState'

const fresh = (): GameState => createDefaultSave()
const withHatchOpen = (): GameState => {
  const s = createDefaultSave()
  return { ...s, flags: { ...s.flags, [CONTEXT_HATCH_OPENED_FLAG]: true } }
}

describe('the context window — the hatch reveal flag (one-way, commit-once)', () => {
  it('is shut on a fresh save', () => {
    expect(hatchOpened(fresh())).toBe(false)
  })

  it('opens once the reveal flag is set', () => {
    expect(hatchOpened(withHatchOpen())).toBe(true)
  })

  it('gates on the EXACT content-owned flag literal (lock-step with content/flags)', () => {
    // If the engine's re-declared literal drifts from content/flags this fails — guarding the moonStrata idiom.
    const s = { ...fresh(), flags: { [CONTEXT_HATCH_OPENED_FLAG]: true } }
    expect(hatchOpened(s)).toBe(true)
  })

  it('openHatch sets the reveal flag from a fresh save', () => {
    const opened = openHatch(fresh())
    expect(hatchOpened(opened)).toBe(true)
    expect(opened.flags[CONTEXT_HATCH_OPENED_FLAG]).toBe(true)
  })

  it('openHatch is commit-once: a second call returns the SAME reference', () => {
    const opened = openHatch(fresh())
    const again = openHatch(opened)
    expect(again).toBe(opened) // SAME reference — nothing to farm, the reward is the notes
  })

  it('openHatch does not mutate the input state (immutability)', () => {
    const before = fresh()
    openHatch(before)
    expect(before.flags[CONTEXT_HATCH_OPENED_FLAG]).toBeUndefined()
  })

  it('openHatch disturbs nothing but the one flag (no resource, no counter, no NG+ scaffold)', () => {
    const before = fresh()
    const after = openHatch(before)
    expect(after.candies).toBe(before.candies)
    expect(after.numbers).toBe(before.numbers)
    expect(after.starsRemaining).toBe(before.starsRemaining)
    expect(after.ngPlusCarryover).toBe(before.ngPlusCarryover)
    expect(after.nGPlusRun).toBe(before.nGPlusRun)
  })
})

describe('the context window — the pure scroll machine (ephemeral cursor)', () => {
  const N = CONTEXT_WINDOW_LINES.length

  it('the notes are longer than one viewport (so there is something to scroll)', () => {
    expect(N).toBeGreaterThan(VIEWPORT_LINES)
  })

  it('maxScroll is the top index of the last full window (never negative)', () => {
    expect(maxScroll(N, VIEWPORT_LINES)).toBe(N - VIEWPORT_LINES)
    expect(maxScroll(N, VIEWPORT_LINES)).toBeGreaterThan(0)
  })

  it('maxScroll is 0 when the whole note already fits in the viewport', () => {
    expect(maxScroll(5, 14)).toBe(0)
    expect(maxScroll(14, 14)).toBe(0)
  })

  it('clampCursor floors and clamps into [0, maxScroll]', () => {
    const max = maxScroll(N, VIEWPORT_LINES)
    expect(clampCursor(-100, N, VIEWPORT_LINES)).toBe(0) // clamped low
    expect(clampCursor(2.9, N, VIEWPORT_LINES)).toBe(2) // floored
    expect(clampCursor(9999, N, VIEWPORT_LINES)).toBe(max) // clamped high
    expect(clampCursor(0, N, VIEWPORT_LINES)).toBe(0)
  })

  it('scrollBy advances the cursor by delta, clamped into range', () => {
    expect(scrollBy(0, 3, N, VIEWPORT_LINES)).toBe(3)
    expect(scrollBy(3, -2, N, VIEWPORT_LINES)).toBe(1)
    expect(scrollBy(0, -5, N, VIEWPORT_LINES)).toBe(0) // cannot go above the top
    expect(scrollBy(0, 99999, N, VIEWPORT_LINES)).toBe(maxScroll(N, VIEWPORT_LINES)) // cannot pass the bottom
  })

  it('scrollBy is pure — repeated calls on the same inputs give the same result', () => {
    expect(scrollBy(4, 5, N, VIEWPORT_LINES)).toBe(scrollBy(4, 5, N, VIEWPORT_LINES))
  })

  it('atTop is true only at the very top', () => {
    expect(atTop(0, N, VIEWPORT_LINES)).toBe(true)
    expect(atTop(-3, N, VIEWPORT_LINES)).toBe(true) // clamps up to 0
    expect(atTop(1, N, VIEWPORT_LINES)).toBe(false)
    expect(atTop(maxScroll(N, VIEWPORT_LINES), N, VIEWPORT_LINES)).toBe(false)
  })

  it('atBottom is true only once the last line is in view', () => {
    const max = maxScroll(N, VIEWPORT_LINES)
    expect(atBottom(max, N, VIEWPORT_LINES)).toBe(true)
    expect(atBottom(max + 50, N, VIEWPORT_LINES)).toBe(true) // clamps down to max
    expect(atBottom(max - 1, N, VIEWPORT_LINES)).toBe(false)
    expect(atBottom(0, N, VIEWPORT_LINES)).toBe(false)
  })

  it('a note that fits in the viewport is both atTop and atBottom (single-window)', () => {
    const shortLines = CONTEXT_WINDOW_LINES.slice(0, 5)
    expect(atTop(0, shortLines.length, 14)).toBe(true)
    expect(atBottom(0, shortLines.length, 14)).toBe(true)
  })

  it('visibleWindow returns exactly viewport lines from the clamped cursor', () => {
    const w = visibleWindow(CONTEXT_WINDOW_LINES, 0, VIEWPORT_LINES)
    expect(w).toEqual(CONTEXT_WINDOW_LINES.slice(0, VIEWPORT_LINES))
    expect(w.length).toBe(VIEWPORT_LINES)
  })

  it('visibleWindow at maxScroll shows the last lines (the note is fully readable end-to-end)', () => {
    const max = maxScroll(CONTEXT_WINDOW_LINES.length, VIEWPORT_LINES)
    const w = visibleWindow(CONTEXT_WINDOW_LINES, max, VIEWPORT_LINES)
    expect(w[w.length - 1]).toBe(CONTEXT_WINDOW_LINES[CONTEXT_WINDOW_LINES.length - 1])
  })

  it('visibleWindow does not mutate the source lines (returns a fresh slice)', () => {
    const before = [...CONTEXT_WINDOW_LINES]
    visibleWindow(CONTEXT_WINDOW_LINES, 3, VIEWPORT_LINES)
    expect([...CONTEXT_WINDOW_LINES]).toEqual(before)
  })

  it('scrolling top-to-bottom reveals every line at least once (no unreachable notes)', () => {
    // Step by (viewport - 2) — the screen's overlap-scroll — from top to bottom, collecting every line seen.
    const step = VIEWPORT_LINES - 2
    const seen = new Set<string>()
    let cursor = 0
    for (const line of visibleWindow(CONTEXT_WINDOW_LINES, cursor, VIEWPORT_LINES)) seen.add(line)
    let guard = 0
    while (!atBottom(cursor, CONTEXT_WINDOW_LINES.length, VIEWPORT_LINES)) {
      cursor = scrollBy(cursor, step, CONTEXT_WINDOW_LINES.length, VIEWPORT_LINES)
      for (const line of visibleWindow(CONTEXT_WINDOW_LINES, cursor, VIEWPORT_LINES)) seen.add(line)
      expect(++guard).toBeLessThan(1000) // guard against a runaway loop
    }
    for (const line of CONTEXT_WINDOW_LINES) expect(seen.has(line)).toBe(true)
  })
})

describe('the context window — content config integrity (stable ASCII data)', () => {
  it('the notes are non-empty and pure ASCII (the monospace-grid rule — no unicode/emoji)', () => {
    expect(CONTEXT_WINDOW_LINES.length).toBeGreaterThan(0)
    for (const line of CONTEXT_WINDOW_LINES) {
      expect(typeof line).toBe('string')
      expect(/[^\x00-\x7F]/.test(line), `line ascii: ${line}`).toBe(false)
    }
  })

  it('the HATCH_LABEL is strict ASCII (it lands in the <pre> stencil grid)', () => {
    // The label is drawn inside a monospace <pre> box on the moon screen, so it must be pure ASCII (unlike
    // the prose blurbs below, which flow in <p> and follow the codebase em-dash voice).
    expect(HATCH_LABEL).toBeTruthy()
    expect(/[^\x00-\x7F]/.test(HATCH_LABEL), `ascii: ${HATCH_LABEL}`).toBe(false)
  })

  it('the second-panel stub + headings are non-empty prose (flow in <p>/<h2>)', () => {
    for (const s of [SECOND_PANEL_STUB, HATCH_HEADING, TERMINAL_HEADING]) {
      expect(s).toBeTruthy()
    }
  })

  it('VIEWPORT_LINES is a sensible positive terminal height', () => {
    expect(Number.isInteger(VIEWPORT_LINES)).toBe(true)
    expect(VIEWPORT_LINES).toBeGreaterThan(0)
  })

  it('the hatch label carries the joke (it insists it is fine)', () => {
    expect(HATCH_LABEL.toUpperCase()).toContain('FINE')
  })

  it('the hatch stencil box is a self-consistent grid (all three lines equal width — the grid is sacred)', () => {
    // The box lands in a monospace <pre>; if the border and label rows differ the right edge juts out.
    // Derived from HATCH_LABEL.length in content, so this pins the alignment against future drift.
    expect(HATCH_STENCIL.length).toBe(3)
    const width = HATCH_STENCIL[0]!.length
    for (const line of HATCH_STENCIL) expect(line.length).toBe(width)
  })

  it('the hatch stencil is a closed box that frames the label (corners + label row), pure ASCII', () => {
    const [top, mid, bottom] = HATCH_STENCIL as [string, string, string]
    expect(top).toBe(bottom) // top and bottom borders match
    expect(top.startsWith('+') && top.endsWith('+')).toBe(true) // corner glyphs
    expect(top.slice(1, -1)).toBe('-'.repeat(top.length - 2)) // border is all dashes
    expect(mid.startsWith('|') && mid.endsWith('|')).toBe(true) // side walls
    expect(mid).toContain(HATCH_LABEL) // the label sits inside
    for (const line of HATCH_STENCIL) expect(/[^\x00-\x7F]/.test(line), `ascii: ${line}`).toBe(false)
  })

  it('the notes are stable data — a module const, so identity is constant across reads', () => {
    const again = CONTEXT_WINDOW_LINES
    expect(again).toBe(CONTEXT_WINDOW_LINES)
  })
})

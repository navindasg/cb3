import type { GameSession } from '@/engine/session/gameSession'
import {
  scrollBy,
  atTop,
  atBottom,
  visibleWindow,
} from '@/engine/content/contextWindow'
import {
  CONTEXT_WINDOW_LINES,
  SECOND_PANEL_STUB,
  TERMINAL_HEADING,
  VIEWPORT_LINES,
} from '@/content/moon/contextWindow'

// The context window terminal (Phase 5 — §28). A wiring sub-module of the DOM bootstrap, sibling to
// reflectionScreens/moonScreens: it owns NO game logic. The pure scroll machine (scrollBy / visibleWindow /
// atTop / atBottom) and the hatch-reveal flag live in the tested engine (engine/content/contextWindow) over
// content config (content/moon/contextWindow); this only draws the monospace terminal, routes the scroll
// clicks, and stubs the second panel (the hallucination's entry, wired in the next slice). Coverage-excluded,
// Playwright-verified. Routed back to the moon it hatches off of.
//
// The scroll cursor is EPHEMERAL — held in this closure and passed back through the pure engine helpers on
// each click; nothing persists (the hatch-opened flag is the only durable state, set on the moon screen).

export interface ContextWindowContext {
  readonly doc: Document
  readonly screen: HTMLElement
  readonly session: GameSession
  clearScreen(): void
  button(label: string, testid: string, onClick: () => void, accelIndex?: number): HTMLButtonElement
  notify(text: string): void
  /** Back to the moon (the hatch is on its far side). */
  showMoon(): void
}

export interface ContextWindowScreens {
  showContextWindow(): void
}

/** Wire the context-window terminal screen over a bootstrap host. */
export function createContextWindowScreens(ctx: ContextWindowContext): ContextWindowScreens {
  const { doc, screen } = ctx

  function heading(text: string, testid: string): void {
    const h = doc.createElement('h2')
    h.textContent = text
    h.setAttribute('data-testid', testid)
    screen.appendChild(h)
  }

  function paragraph(text: string, className: string, testid?: string): void {
    const p = doc.createElement('p')
    p.className = className
    if (testid) p.setAttribute('data-testid', testid)
    p.textContent = text
    screen.appendChild(p)
  }

  function showContextWindow(): void {
    // The scroll cursor is ephemeral to this visit: it starts at the top and the engine clamps every step.
    let cursor = 0

    function render(): void {
      ctx.clearScreen()
      heading(TERMINAL_HEADING, 'context-window-screen')

      // The terminal itself: a monospace grid of the current window over the notes. The engine owns the slice.
      const term = doc.createElement('pre')
      term.className = 'arena glow-terminal'
      term.setAttribute('data-testid', 'context-window-terminal')
      term.setAttribute('data-cursor', String(cursor))
      term.textContent = visibleWindow(CONTEXT_WINDOW_LINES, cursor, VIEWPORT_LINES).join('\n')
      screen.appendChild(term)

      // Scroll controls — disabled at the ends (the engine's atTop/atBottom predicates own the bounds).
      const up = ctx.button('scroll up', 'context-window-up', () => doScroll(-VIEWPORT_LINES + 2))
      if (atTop(cursor, CONTEXT_WINDOW_LINES.length, VIEWPORT_LINES)) {
        up.disabled = true
        up.classList.add('shop-unaffordable')
      }
      screen.appendChild(up)

      const down = ctx.button('scroll down', 'context-window-down', () => doScroll(VIEWPORT_LINES - 2))
      const bottom = atBottom(cursor, CONTEXT_WINDOW_LINES.length, VIEWPORT_LINES)
      if (bottom) {
        down.disabled = true
        down.classList.add('shop-unaffordable')
      }
      screen.appendChild(down)

      // The second panel (the hallucination's entry, §17) is signposted at the foot of the notes but sealed
      // for now — a curiosity that never blocks progress. The next slice opens it.
      if (bottom) {
        paragraph(SECOND_PANEL_STUB, 'blurb', 'context-window-second-panel')
      }

      screen.appendChild(ctx.button('close the panel', 'context-window-to-moon', () => ctx.showMoon(), 0))
    }

    function doScroll(delta: number): void {
      cursor = scrollBy(cursor, delta, CONTEXT_WINDOW_LINES.length, VIEWPORT_LINES)
      render()
    }

    render()
  }

  return { showContextWindow }
}

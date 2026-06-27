import type { GameSession } from '@/engine/session/gameSession'
import type { GameState } from '@/engine/types/GameState'
import {
  descentPortAvailable,
  shouldPlayDescentCue,
  markDescentCuePlayed,
} from '@/engine/content/photosphere'
import {
  DESCENT_PORT_BLURB,
  DESCENT_BUTTON_LABEL,
  DESCENT_NOT_READY_NOTE,
  DESCENT_PORT_SHUT_BLURB,
} from '@/content/sun/descentPort'
import type { DescentAudio } from '@/render/descentAudio'

// The finale screens (Act 4 — quest 11+, DESIGN §194/§196). A wiring sub-module of the DOM bootstrap,
// sibling to scaffoldScreens/skyPortScreens: it owns NO game logic. The reach gate (descentPortAvailable =
// the existing act3GateCleared), the cue decision (shouldPlayDescentCue), and the fire-once latch
// (markDescentCuePlayed) all live in the tested engine (engine/content/photosphere). This only draws the
// descent-port landing beat and routes the descent click. Coverage-excluded, Playwright-/ear-verified —
// the same thin-wiring contract as the scaffold.
//
// THIS SLICE is the skeleton: it stands up the descent-port screen + the one-cue PLUMBING (the audio glue
// is held and the click-path dispatches the start flag + performs the cue + marks it played, all in one
// path so the cue fires EXACTLY once). The descent SIM and the resource gate land in a later slice, so the
// descent button stays disabled-with-a-note here. The §194 cue is the single most important aesthetic beat
// after ~18 silent hours: sound itself becomes the event.

/** Everything the finale screens need from the bootstrap host (its DOM + session + the audio glue). */
export interface FinaleContext {
  readonly doc: Document
  readonly screen: HTMLElement
  readonly session: GameSession
  /** The descent-cue audio glue (test-safe; performs the game's only sound on the descent click). */
  readonly descentAudio: DescentAudio
  clearScreen(): void
  button(label: string, testid: string, onClick: () => void, accelIndex?: number): HTMLButtonElement
  notify(text: string): void
  logText(text: string): void
  /** Return to the overworld map. */
  showMap(): void
  /** Return to the dyson scaffold (the descent port is reached from the scaffold). */
  showScaffold(): void
}

export interface FinaleScreens {
  /** The photosphere descent port — the landing beat and (later) the descent itself. */
  showDescentPort(): void
  /**
   * The finale flow's entry. This slice routes it straight to the descent port; later slices add the
   * caramel-core reveal, the star-eater fight, and the choice screen behind it.
   */
  showFinale(): void
}

/** Wire the finale screens over a bootstrap host. */
export function createFinaleScreens(ctx: FinaleContext): FinaleScreens {
  const { doc, screen, session } = ctx

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

  /**
   * Begin the descent: the user-gesture click. The engine decides whether the cue should play
   * (shouldPlayDescentCue); if so we perform the sound (the render glue) AND dispatch markDescentCuePlayed
   * in the SAME path, so the cue fires EXACTLY once and can never re-fire. The descent SIM and the
   * resource spend (which sets photosphereDescentStarted) land in a later slice; this slice only plumbs the
   * cue so the mechanism is real and gate-green. (Until the start flag is set by 4.2, shouldPlayDescentCue
   * is false, so this performs nothing yet — by design, the button is disabled here.)
   */
  function beginDescent(): void {
    const s = session.getState()
    if (shouldPlayDescentCue(s)) {
      ctx.descentAudio.playDescentCue()
      session.dispatch((st) => markDescentCuePlayed(st))
    }
  }

  function showDescentPort(): void {
    function render(): void {
      ctx.clearScreen()
      const s = session.getState()

      heading('the descent port', 'descent-screen')

      // Defensive: a stray route here before the Act-3 gate answers in voice, not a blank screen.
      if (!descentPortAvailable(s)) {
        paragraph(DESCENT_PORT_SHUT_BLURB, 'blurb', 'descent-shut')
        screen.appendChild(ctx.button('back to the scaffold', 'descent-to-scaffold', () => ctx.showScaffold(), 0))
        return
      }

      paragraph(DESCENT_PORT_BLURB, 'blurb', 'descent-blurb')

      renderDescentButton(s)

      screen.appendChild(ctx.button('back to the scaffold', 'descent-to-scaffold', () => ctx.showScaffold(), 0))
      screen.appendChild(ctx.button('back to the map', 'descent-to-map', () => ctx.showMap()))
    }

    /**
     * The descent button — present but DISABLED in this slice (the descent sim + the resource gate land in
     * 4.2). The not-ready note keeps the dread without a dead click. The click path is plumbed (beginDescent
     * performs the cue once) so 4.2 only has to enable the button.
     */
    function renderDescentButton(_s: GameState): void {
      const descend = ctx.button(DESCENT_BUTTON_LABEL, 'descent-begin', () => beginDescent())
      // Disabled until 4.2 stands up the descent sim + the coolant/plating gate.
      descend.disabled = true
      descend.classList.add('shop-unaffordable')
      screen.appendChild(descend)
      paragraph(DESCENT_NOT_READY_NOTE, 'blurb', 'descent-not-ready')
    }

    render()
  }

  function showFinale(): void {
    showDescentPort()
  }

  return { showDescentPort, showFinale }
}

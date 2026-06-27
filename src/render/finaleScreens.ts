import type { GameSession } from '@/engine/session/gameSession'
import type { GameState } from '@/engine/types/GameState'
import {
  descentPortAvailable,
  shouldPlayDescentCue,
  markDescentCuePlayed,
  canDescend,
  startDescent,
  createDescent,
  resolveRung,
  rungHazard,
  descentOutcome,
  completePhotosphere,
  photosphereCleared,
  type PhotosphereState,
  type DescentAction,
} from '@/engine/content/photosphere'
import {
  DESCENT_PORT_BLURB,
  DESCENT_BUTTON_LABEL,
  DESCENT_NOT_READY_NOTE,
  DESCENT_PORT_SHUT_BLURB,
} from '@/content/sun/descentPort'
import {
  PHOTOSPHERE_BACKDROP,
  DESCENT_SIM_BLURB,
  DESCENT_CORE_REACHED_BLURB,
  DESCENT_COOLANT_OUT_BLURB,
  DESCENT_PLATING_OUT_BLURB,
  DESCENT_RETRY_LABEL,
  VENT_LABEL,
  BRACE_LABEL,
  MIN_COOLANT,
  MIN_PLATING,
  RUNG_COUNT,
} from '@/content/sun/photosphere'
import {
  coreOpen,
  coreStage,
  atDragon,
  approachCore,
} from '@/engine/content/caramelCore'
import {
  CORE_STAGES,
  CORE_ART,
  CORE_BLURB,
  DRAGON_WORDS,
  DRAGON_SPEAKER_KEY,
  CARAMEL_CORE_HEADING,
  APPROACH_LABEL,
  LEAVE_CORE_LABEL,
  type CoreStageId,
} from '@/content/sun/caramelCore'
import { t } from '@/content/i18n/en'
import type { DescentAudio } from '@/render/descentAudio'

// The finale screens (Act 4 — quest 11+, DESIGN §194/§196). A wiring sub-module of the DOM bootstrap,
// sibling to scaffoldScreens/skyPortScreens: it owns NO game logic. The reach gate (descentPortAvailable =
// act3GateCleared), the descent gate (canDescend), the atomic spend (startDescent), the telegraph-and-brace
// SIM (createDescent / resolveRung / rungHazard / descentOutcome), the cue decision (shouldPlayDescentCue),
// and the commit-once clear (completePhotosphere) all live in the tested engine (engine/content/photosphere).
// This only draws the descent-port landing + the rung-by-rung sim and routes the clicks. Coverage-excluded,
// Playwright-/ear-verified — the same thin-wiring contract as the scaffold.
//
// THE ONE CUE (§194): the descent SIM is the gauntlet, but the aesthetic beat is the SILENCE breaking. The
// 'descend' click is the user gesture: it dispatches startDescent (the atomic coolant+plating spend that
// sets photosphereDescentStarted), then — because shouldPlayDescentCue is now true — performs the sound AND
// dispatches markDescentCuePlayed in the SAME path, so the cue fires EXACTLY once after ~18 silent hours.
// The descent itself is TRANSIENT (an abandoned or lost fall is forfeit); only the cleared flag persists.

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
  /** The star-eater's arrival (the next slice, 4.4); the caramel-core reveal routes here off the dragon. */
  showStarEater(): void
}

export interface FinaleScreens {
  /** The photosphere descent port — the landing beat, the descent gate, and the rung-by-rung descent. */
  showDescentPort(): void
  /**
   * The caramel-core reveal (Quest 12) — the §15 lock: molten caramel -> the shell -> the egg -> the
   * half-hatched solar dragon. A non-combat scene; the dragon's small words do the work. Routes onward to
   * the star-eater's arrival.
   */
  showCaramelCore(): void
  /**
   * The finale flow's entry. This slice routes it straight to the descent port; later slices add the
   * star-eater fight and the choice screen behind it.
   */
  showFinale(): void
}

/** A pure-ASCII gauge bar, e.g. [#####-----] cur/max. */
function gauge(cur: number, max: number, width = 10): string {
  const filled = Math.max(0, Math.min(width, Math.round((cur / max) * width)))
  return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}]`
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

  function backdrop(): void {
    const pre = doc.createElement('pre')
    pre.className = 'arena glow-sun'
    pre.setAttribute('data-testid', 'photosphere-backdrop')
    pre.textContent = PHOTOSPHERE_BACKDROP
    screen.appendChild(pre)
  }

  function showDescentPort(): void {
    // The descent sim is transient to this visit; a win commits the cleared flag exactly once and routes on.
    let descent: PhotosphereState | null = null
    let committed = false

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

      // Already cleared, and not mid-descent: the calm landing (the hook into the caramel core).
      if (photosphereCleared(s) && !descent) {
        renderCleared()
        return
      }

      if (descent) renderDescent(descent)
      else renderPort(s)
    }

    function renderPort(s: GameState): void {
      backdrop()
      paragraph(DESCENT_PORT_BLURB, 'blurb', 'descent-blurb')

      const ready = canDescend(s)
      const descend = ctx.button(DESCENT_BUTTON_LABEL, 'descent-begin', () => beginDescent())
      if (!ready) {
        descend.disabled = true
        descend.classList.add('shop-unaffordable')
      }
      screen.appendChild(descend)

      // The coolant/plating readout — what the vessel wants, what you have (the soft-lock-free gate, shown).
      paragraph(
        `coolant ${s.mint.current.toLocaleString()} / ${MIN_COOLANT.toLocaleString()} mint    ` +
          `plating ${s.peppermint.current.toLocaleString()} / ${MIN_PLATING.toLocaleString()} peppermint`,
        'blurb',
        'descent-reserves',
      )
      if (!ready) paragraph(DESCENT_NOT_READY_NOTE, 'blurb', 'descent-not-ready')

      screen.appendChild(ctx.button('back to the scaffold', 'descent-to-scaffold', () => ctx.showScaffold(), 0))
      screen.appendChild(ctx.button('back to the map', 'descent-to-map', () => ctx.showMap()))
    }

    function renderCleared(): void {
      backdrop()
      paragraph(DESCENT_CORE_REACHED_BLURB, 'blurb', 'descent-cleared')
      screen.appendChild(ctx.button('go down to the core', 'descent-to-core', () => showCaramelCore()))
      screen.appendChild(ctx.button('back to the scaffold', 'descent-to-scaffold', () => ctx.showScaffold(), 0))
    }

    function renderDescent(d: PhotosphereState): void {
      const outcome = descentOutcome(d)

      if (outcome === 'reachedCore') {
        if (!committed) commitClear()
        backdrop()
        paragraph(DESCENT_CORE_REACHED_BLURB, 'blurb', 'descent-won')
        screen.appendChild(ctx.button('go down to the core', 'descent-to-core', () => showCaramelCore()))
        return
      }
      if (outcome === 'lost') {
        backdrop()
        paragraph(d.coolant <= 0 ? DESCENT_COOLANT_OUT_BLURB : DESCENT_PLATING_OUT_BLURB, 'blurb', 'descent-lost')
        screen.appendChild(ctx.button(DESCENT_RETRY_LABEL, 'descent-retry', () => doRetry()))
        screen.appendChild(ctx.button('back to the scaffold', 'descent-to-scaffold', () => ctx.showScaffold(), 0))
        return
      }

      // --- the descent in progress ---
      const hazard = rungHazard(d)
      backdrop()
      paragraph(DESCENT_SIM_BLURB, 'blurb', 'descent-sim-blurb')

      const pre = doc.createElement('pre')
      pre.className = 'arena'
      pre.setAttribute('data-testid', 'descent-gauges')
      // machine-readable hints for the e2e (the player reads the gauges + the telegraph by eye).
      pre.setAttribute('data-rung', String(d.rung))
      pre.setAttribute('data-hazard', hazard ?? '')
      pre.setAttribute('data-coolant', String(d.coolant))
      pre.setAttribute('data-plating', String(d.plating))
      pre.textContent = [
        `rung ${d.rung + 1} of ${RUNG_COUNT}`,
        `coolant ${gauge(d.coolant, MIN_COOLANT)} ${Math.max(0, d.coolant)}`,
        `plating ${gauge(d.plating, MIN_PLATING)} ${Math.max(0, d.plating)}`,
        '',
        hazard === 'flare'
          ? 'the haze ahead curdles amber -- a caramel FLARE is coming'
          : 'the haze ahead whitens to grit -- a sugar-glass STORM is coming',
      ].join('\n')
      screen.appendChild(pre)

      screen.appendChild(ctx.button(VENT_LABEL, 'descent-vent', () => doAction('vent')))
      screen.appendChild(ctx.button(BRACE_LABEL, 'descent-brace', () => doAction('brace')))
    }

    /**
     * Begin the descent: the user-gesture click. Dispatch startDescent (the atomic coolant+plating spend
     * that sets photosphereDescentStarted); if it took, seed the transient sim, then — because
     * shouldPlayDescentCue is now true — perform the sound AND dispatch markDescentCuePlayed in the SAME
     * path, so the cue fires EXACTLY once. If the spend did not take (shouldn't happen behind canDescend),
     * just re-render.
     */
    function beginDescent(): void {
      if (!canDescend(session.getState())) return
      // The atomic spend + the started flag, in one dispatch (NEVER a partial spend — SAME-ref if short).
      session.dispatch((s) => startDescent(s).state)
      // The cue: decided by the pure predicate, performed by the render glue, latched in the SAME path.
      const started = session.getState()
      if (shouldPlayDescentCue(started)) {
        ctx.descentAudio.playDescentCue()
        session.dispatch((st) => markDescentCuePlayed(st))
      }
      descent = createDescent()
      committed = false
      render()
    }

    function doAction(action: DescentAction): void {
      if (!descent) return
      descent = resolveRung(descent, action)
      render()
    }

    function commitClear(): void {
      committed = true
      session.dispatch((s) => completePhotosphere(s))
      ctx.logText('The bathysphere reaches the core. Below the photosphere, something old is held in the light.')
    }

    function doRetry(): void {
      // A forfeit: the coolant/plating already spent on start is gone (transient, not refunded). Back to the
      // port to refit — the gate (canDescend) will reflect whether you have another batch banked.
      descent = null
      committed = false
      render()
    }

    render()
  }

  /**
   * The caramel-core reveal (Quest 12, §15/§196/§285) — the §15 larval-star lock. A non-combat scene: the
   * stage march (molten -> shell -> egg -> dragon) is the tested engine (engine/content/caramelCore); this
   * only draws the per-stage ASCII (glowing via .glow-egg, never a glyph) + blurb and routes the 'go closer'
   * clicks. The truth is SHOWN — the egg, the child keeping the light on — and the dragon's small words
   * (§278) do the work; no lore dump. approachCore sets caramelCoreReached + solarDragonMet atomically on the
   * step that reaches the dragon; from there the words reveal one at a time, then it routes to the star-eater.
   */
  function showCaramelCore(): void {
    // How many of the dragon's small words are shown (transient to this visit; first shows on arrival).
    let wordsShown = 1

    function render(): void {
      ctx.clearScreen()
      const s = session.getState()

      heading(CARAMEL_CORE_HEADING, 'caramel-core-screen')

      // Defensive: a stray route here before the descent is cleared answers in voice, not a blank screen.
      if (!coreOpen(s)) {
        paragraph(
          'The bathysphere has not reached the core. There is nothing down here yet but light.',
          'blurb',
          'caramel-core-shut',
        )
        screen.appendChild(ctx.button('back to the descent port', 'core-to-port', () => showDescentPort(), 0))
        return
      }

      const stage = coreStage(s)
      // coreStage clamps into [0, DRAGON_STAGE], so the lookup is always defined; the 'molten' fallback
      // keeps the type honest under noUncheckedIndexedAccess (it is unreachable in practice).
      const stageId: CoreStageId = CORE_STAGES[stage] ?? 'molten'

      const art = doc.createElement('pre')
      art.className = 'arena glow-egg'
      art.setAttribute('data-testid', 'caramel-core-art')
      art.setAttribute('data-stage', String(stage))
      art.setAttribute('data-stage-id', stageId)
      art.textContent = CORE_ART[stageId]
      screen.appendChild(art)

      paragraph(CORE_BLURB[stageId], 'blurb', 'caramel-core-blurb')

      if (atDragon(s)) renderDragon()
      else screen.appendChild(ctx.button(APPROACH_LABEL, 'core-approach', () => stepCloser()))
    }

    function renderDragon(): void {
      // The dragon's few small words (§278), revealed one per click; the speaker is unnamed (§22 — "the dragon").
      const speaker = t(DRAGON_SPEAKER_KEY)
      const words = doc.createElement('pre')
      words.className = 'arena'
      words.setAttribute('data-testid', 'solar-dragon-words')
      words.setAttribute('data-words-shown', String(wordsShown))
      words.textContent = DRAGON_WORDS.slice(0, wordsShown)
        .map((key) => `${speaker}:  ${t(key)}`)
        .join('\n\n')
      screen.appendChild(words)

      if (wordsShown < DRAGON_WORDS.length) {
        // It has more to say. A small word at a time.
        screen.appendChild(ctx.button('wait', 'core-listen', () => listenMore()))
      } else {
        // It has said all it can. The sky has noticed you came down — onward to the star-eater (4.4).
        screen.appendChild(ctx.button(LEAVE_CORE_LABEL, 'core-to-star-eater', () => ctx.showStarEater()))
      }
    }

    function stepCloser(): void {
      // The pure transition: advance the cursor; the step that reaches the dragon sets both flags atomically.
      const before = atDragon(session.getState())
      session.dispatch((st) => approachCore(st))
      if (!before && atDragon(session.getState())) {
        ctx.logText('The core is an egg. Curled inside it, half out of the shell, the solar dragon keeps the light on.')
      }
      render()
    }

    function listenMore(): void {
      wordsShown = Math.min(DRAGON_WORDS.length, wordsShown + 1)
      render()
    }

    render()
  }

  function showFinale(): void {
    showDescentPort()
  }

  return { showDescentPort, showCaramelCore, showFinale }
}

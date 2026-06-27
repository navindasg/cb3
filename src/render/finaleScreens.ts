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
  starEaterAvailable,
  starEaterDefeated,
  createStarEater,
  createBroadside,
  createOnFoot,
  onFootOutcome,
  resolveOnFoot,
  createCore,
  advancePhase,
  forfeit,
  shouldShowEaterCounter,
  markEaterCounterShown,
  winStarEater,
  type StarEaterProgress,
} from '@/engine/content/starEater'
import {
  resolveManeuver,
  duelOutcome,
  type DuelState,
  type Maneuver,
} from '@/engine/content/shipDuel'
import { RANGE_NAMES } from '@/content/ship/shipDuel'
import {
  cutFor,
  type BoardingState,
  type BoardingAction,
} from '@/engine/content/boardingDuel'
import {
  resolveCoreTurn,
  coreOutcome,
  clawFor,
  type CoreDefenseState,
  type CoreAction,
} from '@/engine/content/coreDefense'
import {
  STAR_EATER_HEADING,
  STAR_EATER_INTRO_BLURB,
  PHASE_BROADSIDE_BLURB,
  PHASE_ONFOOT_BLURB,
  PHASE_CORE_BLURB,
  STAR_EATER_WON_BLURB,
  STAR_EATER_LOST_BLURB,
  STAR_EATER_RETRY_LABEL,
  STAR_EATER_TO_CHOICE_LABEL,
  STAR_EATER_ART,
  CORE_EGG_ART,
  EATER_COUNTER_KEY,
  EATER_ONFOOT_HP,
  CORE_EATER_HP,
  EGG_HP,
} from '@/content/sun/starEater'
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
import {
  canChoose,
  canEatIt,
  canEatSun,
  chosenEnding,
  endingChosen,
  chooseHatch,
  chooseFeed,
  chooseEat,
  type Ending,
} from '@/engine/content/endings'
import {
  CHOICE_HEADING,
  CHOICE_BLURB,
  CHOICE_ART,
  HATCH_LABEL,
  HATCH_DESC,
  HATCH_HEADING,
  HATCH_BLURB,
  HATCH_ART,
  FEED_LABEL,
  FEED_DESC,
  FEED_HEADING,
  FEED_BLURB,
  FEED_ART,
  EAT_LABEL,
  EAT_DESC,
  EAT_LOCKED_NOTE,
  EAT_CONFIRM_NOTE,
  EAT_CONFIRM_LABEL,
  EAT_CANCEL_LABEL,
  EAT_HEADING,
  EAT_BLURB,
  EAT_ART,
  DARK_BEGIN_LABEL,
  CHOICE_BACK_LABEL,
} from '@/content/sun/endings'
import { projectedStars } from '@/engine/content/starCounter'
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
  /**
   * Reboot the app from disk (ending 3 — EAT IT). After the NG+ dark save is dispatched + persisted, the page
   * reloads so the bootstrap re-loads the autosaved dark save and opens on the inverted §367 opener. The host
   * implements this as a real page reload (the dev-panel reset idiom); it is a no-op in jsdom/SSR.
   */
  reboot(): void
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
   * The star-eater finale (Quest 13) — the three-phase climax: the broadside (maxed galleon), on foot (the
   * equipped weapon), and the core defense (the egg). One screen phase-routes the three sub-fights on the
   * engine cursor (the sourbeardScreens idiom). The §286 candy-counter reveal flickers in exactly once at the
   * phase-2 -> phase-3 boundary. Reached from the caramel-core reveal off the dragon; routes onward to the
   * choice on a win.
   */
  showStarEater(): void
  /**
   * The choice screen (Quest 13's aftermath, §16/§200-204) — gated on starEaterDefeated. Shows all three
   * endings; ending 3 (EAT IT) is threshold-gated (canEatSun) and, on confirm, eats the sun, begins the NG+
   * dark save, persists it, and reboots into the inverted §367 opener. Choosing ending 1 or 2 commits the
   * terminal effect (counter UP / counter FROZEN) and routes to showEnding. Once an ending is chosen, re-entry
   * shows the chosen terminal scene (the choice is locked, commit-once).
   */
  showChoice(): void
  /**
   * The terminal ending presentation (§200/§201) — the chosen scene: the dragon ascending and the night sky
   * refilling (hatch), or the sealed egg and the watch and the frozen sky (feed). Read off the committed
   * endingChosen string; a re-entry shows the same scene (the star readout in the corner reflects up/frozen
   * automatically). The end of the game.
   */
  showEnding(): void
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
        // It has said all it can. The sky has noticed you came down — onward to the star-eater (Quest 13).
        screen.appendChild(ctx.button(LEAVE_CORE_LABEL, 'core-to-star-eater', () => showStarEater()))
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

  /**
   * The star-eater finale (Quest 13, §198/§286) — the three-phase climax. ONE screen phase-routes the three
   * sub-fights on the engine cursor (the sourbeardScreens idiom — no new screen per phase): phase 1 reuses
   * the broadside sim (maxed galleon tiers), phase 2 the boarding melee (the equipped weapon), phase 3 the
   * new core-defense sim (the egg). The pure orchestrator (engine/content/starEater) builds each phase's
   * fresh state, advances the cursor on a win, forfeits on a loss; the fight states themselves are TRANSIENT
   * to this visit. The §286 candy-counter reveal flickers in EXACTLY once at the phase-2 -> phase-3 boundary
   * (the eater speaks in UI). winStarEater commits the defeated flag once on the phase-3 clear; it routes on
   * to the choice. Coverage-excluded, Playwright-verified — the same thin-wiring contract as the descent.
   */
  function showStarEater(): void {
    // The phase cursor + the live sub-fight states are transient to this visit (the shipDuel/boardingDuel
    // idiom — an abandoned or lost fight is forfeit and the whole thing restarts). committed latches the
    // one-time win dispatch.
    let progress: StarEaterProgress = createStarEater()
    let duel: DuelState | null = null
    let boarding: BoardingState | null = null
    let core: CoreDefenseState | null = null
    let committed = false

    function reset(): void {
      progress = createStarEater()
      duel = null
      boarding = null
      core = null
      committed = false
    }

    function render(): void {
      ctx.clearScreen()
      const s = session.getState()

      heading(STAR_EATER_HEADING, 'star-eater-screen')

      // Already driven off: the calm aftermath (the hook into the choice).
      if (starEaterDefeated(s)) {
        renderAftermath()
        return
      }
      // Defensive: a stray route here before the dragon is met answers in voice, not a blank screen.
      if (!starEaterAvailable(s)) {
        paragraph(
          'There is nothing here yet. The sky is still bright. Whatever is coming has not arrived.',
          'blurb',
          'star-eater-shut',
        )
        screen.appendChild(ctx.button('back to the core', 'star-eater-to-core', () => showCaramelCore(), 0))
        return
      }

      if (progress.lost) {
        renderLost()
        return
      }
      if (progress.won) {
        renderWon()
        return
      }

      // Route to the live phase (lazily seeding its transient state on first entry).
      if (progress.phase === 'broadside') renderBroadside()
      else if (progress.phase === 'onFoot') renderOnFoot()
      else renderCore()
    }

    function silhouette(): void {
      const pre = doc.createElement('pre')
      pre.className = 'arena glow-sun'
      pre.setAttribute('data-testid', 'star-eater-art')
      pre.textContent = STAR_EATER_ART
      screen.appendChild(pre)
    }

    // --- phase 1: the broadside (the shipDuel sim, maxed galleon) ---
    function renderBroadside(): void {
      if (!duel) duel = createBroadside(session.getState())
      const d = duel
      const outcome = duelOutcome(d)
      if (outcome === 'won') {
        advance()
        return
      }
      if (outcome === 'lost') {
        progress = forfeit(progress)
        render()
        return
      }

      silhouette()
      paragraph(PHASE_BROADSIDE_BLURB, 'blurb', 'phase-broadside-blurb')

      const pre = doc.createElement('pre')
      pre.className = 'arena'
      pre.setAttribute('data-testid', 'broadside-gauges')
      pre.setAttribute('data-range', String(d.range))
      pre.setAttribute('data-your-hp', String(Math.max(0, Math.ceil(d.yourHp))))
      pre.setAttribute('data-foe-hp', String(Math.max(0, Math.ceil(d.foeHp))))
      pre.textContent = [
        `range: ${RANGE_NAMES[d.range] ?? 'mid'}`,
        `your hull  ${gauge(d.yourHp, d.yourMaxHp)} ${Math.max(0, Math.ceil(d.yourHp))}`,
        `the eater  ${gauge(d.foeHp, d.foeMaxHp)} ${Math.max(0, Math.ceil(d.foeHp))}`,
      ].join('\n')
      screen.appendChild(pre)

      screen.appendChild(ctx.button('press in (close the range)', 'broadside-press', () => maneuver('press')))
      screen.appendChild(ctx.button('hold range (trade)', 'broadside-hold', () => maneuver('hold')))
      screen.appendChild(ctx.button('veer off (slip the shot)', 'broadside-veer', () => maneuver('veer')))
    }

    function maneuver(m: Maneuver): void {
      if (!duel) return
      duel = resolveManeuver(duel, m)
      render()
    }

    // --- phase 2: on foot, on the creature (the boarding melee, the equipped weapon) ---
    function renderOnFoot(): void {
      if (!boarding) boarding = createOnFoot(session.getState())
      // The §286 reveal flickers in EXACTLY once at the phase-2 -> phase-3 boundary — surfaced when we
      // ENTER the core phase below. Here we are still on foot.
      const b = boarding
      const outcome = onFootOutcome(b)
      if (outcome === 'won') {
        advance()
        return
      }
      if (outcome === 'lost') {
        progress = forfeit(progress)
        render()
        return
      }

      silhouette()
      paragraph(PHASE_ONFOOT_BLURB, 'blurb', 'phase-onfoot-blurb')

      const cut = cutFor(b.turn)
      const pre = doc.createElement('pre')
      pre.className = 'arena'
      pre.setAttribute('data-testid', 'onfoot-gauges')
      pre.setAttribute('data-tell', cut.tell)
      pre.setAttribute('data-line', cut.line) // the true line — the e2e reads it; the player learns by dying
      pre.setAttribute('data-your-hp', String(Math.max(0, Math.ceil(b.yourHp))))
      pre.setAttribute('data-foe-hp', String(Math.max(0, Math.ceil(b.foeHp))))
      pre.textContent = [
        `you   ${gauge(b.yourHp, b.yourMaxHp)} ${Math.max(0, Math.ceil(b.yourHp))}`,
        `eater ${gauge(b.foeHp, EATER_ONFOOT_HP)} ${Math.max(0, Math.ceil(b.foeHp))}`,
        '',
        cut.tell === 'high'
          ? 'it rears HIGH -- a cut is coming from above (it may feint)'
          : 'it drops LOW -- a cut is coming from below (it may feint)',
      ].join('\n')
      screen.appendChild(pre)

      screen.appendChild(ctx.button('guard high', 'onfoot-guard-high', () => exchange('guard-high')))
      screen.appendChild(ctx.button('guard low', 'onfoot-guard-low', () => exchange('guard-low')))
      screen.appendChild(ctx.button('lunge', 'onfoot-lunge', () => exchange('lunge')))
    }

    function exchange(action: BoardingAction): void {
      if (!boarding) return
      boarding = resolveOnFoot(boarding, action)
      render()
    }

    // --- phase 3: the core defense (the new coreDefense sim, the egg) ---
    function renderCore(): void {
      if (!core) core = createCore(session.getState())
      const c = core
      const outcome = coreOutcome(c)
      if (outcome === 'won') {
        advance()
        return
      }
      if (outcome === 'lost') {
        progress = forfeit(progress)
        render()
        return
      }

      // The egg with its glow.
      const egg = doc.createElement('pre')
      egg.className = 'arena glow-egg'
      egg.setAttribute('data-testid', 'core-egg-art')
      egg.textContent = CORE_EGG_ART
      screen.appendChild(egg)
      paragraph(PHASE_CORE_BLURB, 'blurb', 'phase-core-blurb')

      const claw = clawFor(c.turn)
      const pre = doc.createElement('pre')
      pre.className = 'arena'
      pre.setAttribute('data-testid', 'core-gauges')
      pre.setAttribute('data-tell', claw.tell)
      pre.setAttribute('data-line', claw.line)
      pre.setAttribute('data-egg-hp', String(Math.max(0, Math.ceil(c.eggHp))))
      pre.setAttribute('data-your-hp', String(Math.max(0, Math.ceil(c.yourHp))))
      pre.setAttribute('data-foe-hp', String(Math.max(0, Math.ceil(c.eaterHp))))
      pre.textContent = [
        `the egg ${gauge(c.eggHp, EGG_HP)} ${Math.max(0, Math.ceil(c.eggHp))}`,
        `you     ${gauge(c.yourHp, c.yourMaxHp)} ${Math.max(0, Math.ceil(c.yourHp))}`,
        `eater   ${gauge(c.eaterHp, CORE_EATER_HP)} ${Math.max(0, Math.ceil(c.eaterHp))}`,
        '',
        claw.tell === 'high'
          ? 'it rakes HIGH at the shell over your shoulder (it may feint)'
          : 'it rakes LOW at the shell over your shoulder (it may feint)',
      ].join('\n')
      screen.appendChild(pre)

      screen.appendChild(ctx.button('guard high', 'core-guard-high', () => coreTurn('guard-high')))
      screen.appendChild(ctx.button('guard low', 'core-guard-low', () => coreTurn('guard-low')))
      screen.appendChild(ctx.button('strike (let the claw through)', 'core-strike', () => coreTurn('strike')))
    }

    function coreTurn(action: CoreAction): void {
      if (!core) return
      core = resolveCoreTurn(core, action)
      render()
    }

    // --- the cursor + the mid-fight reveal ---
    function advance(): void {
      const before = progress.phase
      progress = advancePhase(progress)
      // The §286 reveal: surfaced EXACTLY once at the phase-2 -> phase-3 boundary (we just entered core).
      if (before === 'onFoot' && shouldShowEaterCounter(progress, session.getState())) {
        renderCounterReveal()
        return
      }
      render()
    }

    /**
     * The mid-fight HUD flicker (§3/§286): the eater's candy counter, shown EXACTLY once. It eats stars the
     * way you eat candies. The figure is content data; the line is the one i18n string; the one-shot latch is
     * dispatched here so it never shows twice. A short interstitial, then onward into the core phase.
     */
    function renderCounterReveal(): void {
      session.dispatch((st) => markEaterCounterShown(st))
      ctx.clearScreen()
      heading(STAR_EATER_HEADING, 'star-eater-screen')
      silhouette()
      const hud = doc.createElement('pre')
      hud.className = 'arena glow-sun'
      hud.setAttribute('data-testid', 'eater-counter')
      // The eater's own UI, flickering into yours — its candy counter, exactly as the §286 beat reads it.
      hud.textContent = ['', `    ${t(EATER_COUNTER_KEY)}`, ''].join('\n')
      screen.appendChild(hud)
      paragraph(
        'For a moment its UI flickers into yours. It has a counter, the way you have a counter. It is not counting candies.',
        'blurb',
        'eater-counter-blurb',
      )
      ctx.logText('The star-eater has a candy counter. It says: ' + t(EATER_COUNTER_KEY))
      screen.appendChild(ctx.button('hold the egg', 'eater-counter-continue', () => render()))
    }

    function renderWon(): void {
      if (!committed) {
        committed = true
        session.dispatch((st) => winStarEater(st))
        ctx.logText('The star-eater pulls back off the egg, and goes still, and waits. The light holds.')
      }
      silhouette()
      paragraph(STAR_EATER_WON_BLURB, 'blurb', 'star-eater-won')
      screen.appendChild(ctx.button(STAR_EATER_TO_CHOICE_LABEL, 'star-eater-to-choice', () => showChoice()))
    }

    function renderAftermath(): void {
      // Re-entry after the win: the calm aftermath, the hook into the choice (farm-proof — no re-fight, no loot).
      silhouette()
      paragraph(STAR_EATER_WON_BLURB, 'blurb', 'star-eater-aftermath')
      screen.appendChild(ctx.button(STAR_EATER_TO_CHOICE_LABEL, 'star-eater-to-choice', () => showChoice()))
      screen.appendChild(ctx.button('back to the core', 'star-eater-to-core', () => showCaramelCore(), 0))
    }

    function renderLost(): void {
      silhouette()
      paragraph(STAR_EATER_LOST_BLURB, 'blurb', 'star-eater-lost')
      screen.appendChild(ctx.button(STAR_EATER_RETRY_LABEL, 'star-eater-retry', () => { reset(); render() }))
      screen.appendChild(ctx.button('back to the core', 'star-eater-to-core', () => showCaramelCore(), 0))
    }

    // Open on the intro the first time (a fresh, un-defeated arrival), then into the broadside.
    function openOrFight(): void {
      const s = session.getState()
      if (starEaterDefeated(s) || !starEaterAvailable(s)) {
        render()
        return
      }
      ctx.clearScreen()
      heading(STAR_EATER_HEADING, 'star-eater-screen')
      silhouette()
      paragraph(STAR_EATER_INTRO_BLURB, 'blurb', 'star-eater-intro')
      screen.appendChild(ctx.button('bring her about', 'star-eater-begin', () => render()))
    }

    openOrFight()
  }

  /**
   * The choice screen (Quest 13's aftermath, §16/§200-204) — the series-tradition finite, poignant ending. A
   * thin wiring screen: the gate (canChoose = starEaterDefeated && !endingChosen), the threshold for ending 3
   * (canEatIt), and each ending's commit-once effect all live in the tested engine (engine/content/endings).
   * This only draws the three options + routes the clicks. Once an ending is committed, re-entry shows the
   * chosen terminal scene (showEnding); the choice is locked (commit-once — no ending can be re-triggered).
   * Coverage-excluded, Playwright-verified — the same thin-wiring contract as the rest of the finale.
   */
  function showChoice(): void {
    ctx.clearScreen()
    const s = session.getState()

    heading(CHOICE_HEADING, 'choice-screen')

    // Already chosen: the choice is terminal — route to the committed ending's scene (the game is over).
    // showEnding() is itself terminal for EVERY committed value (hatch/feed draw the scene; a deferred 'eat'
    // or a corrupt/forward-compat string draws a safe terminal fallback) — it NEVER re-enters showChoice(),
    // so this hop can never mutually recurse.
    if (endingChosen(s)) {
      showEnding()
      return
    }
    // Defensive: a stray route here before the star-eater is driven off answers in voice, not a blank screen.
    if (!canChoose(s)) {
      paragraph(
        'There is no choice to make yet. The thing in the dark is still coming.',
        'blurb',
        'choice-shut',
      )
      screen.appendChild(ctx.button('back to the core', 'choice-to-core', () => showCaramelCore(), 0))
      return
    }

    const art = doc.createElement('pre')
    art.className = 'arena glow-egg'
    art.setAttribute('data-testid', 'choice-art')
    art.textContent = CHOICE_ART
    screen.appendChild(art)

    paragraph(CHOICE_BLURB, 'blurb', 'choice-blurb')

    // Ending 1 — let it hatch (the poignant default; always offered).
    screen.appendChild(ctx.button(HATCH_LABEL, 'choice-hatch', () => commit('hatch')))
    paragraph(HATCH_DESC, 'blurb choice-desc', 'choice-hatch-desc')

    // Ending 2 — feed the sun (always offered).
    screen.appendChild(ctx.button(FEED_LABEL, 'choice-feed', () => commit('feed')))
    paragraph(FEED_DESC, 'blurb choice-desc', 'choice-feed-desc')

    // Ending 3 — eat it (threshold-gated; disabled below the §22-open lifetime threshold). When enabled it
    // routes to a confirm screen, then eats the sun and begins the NG+ dark save (the §367 inverted opening).
    const eatEnabled = canEatIt(s)
    const eat = ctx.button(EAT_LABEL, 'choice-eat', () => eatIt())
    if (!eatEnabled) {
      eat.disabled = true
      eat.classList.add('shop-unaffordable')
    }
    screen.appendChild(eat)
    paragraph(EAT_DESC, 'blurb choice-desc', 'choice-eat-desc')
    if (!eatEnabled) paragraph(EAT_LOCKED_NOTE, 'blurb', 'choice-eat-locked')

    screen.appendChild(ctx.button(CHOICE_BACK_LABEL, 'choice-back', () => showStarEater(), 0))
  }

  /**
   * Commit ending 1 or 2: dispatch the pure commit-once transition (chooseHatch / chooseFeed sets the
   * endingChosen string + its branch flag — and, for feed, zeroes the candy hoard — atomically), log the
   * beat, then route to the terminal scene. A no-op at the engine level once any ending is already chosen, so
   * a double-click cannot re-fire the effect.
   */
  function commit(ending: Exclude<Ending, 'eat'>): void {
    if (endingChosen(session.getState())) {
      showEnding()
      return
    }
    if (ending === 'hatch') {
      session.dispatch((st) => chooseHatch(st))
      ctx.logText('You open the shell. The sun goes dark — and then something climbs out of it, burning, and goes up to put the stars back.')
    } else {
      session.dispatch((st) => chooseFeed(st))
      ctx.logText('You pour the whole hoard into the light. The dragon sleeps on, and the star-eater settles in to keep the watch. The sky stops.')
    }
    showEnding()
  }

  /**
   * Ending 3 (EAT IT) — the point-of-no-return confirm (§204/§286/§367). Defensive: re-validates canEatSun (the
   * pure gate: star-eater driven off, no ending committed, lifetime past the threshold) before offering the
   * commit, so a stale click cannot reach the eat past a committed ending. The confirm does NOT touch state; only
   * the commit (commitEat) does. Choosing 'not yet' returns to the open choice.
   */
  function eatIt(): void {
    ctx.clearScreen()
    const s = session.getState()
    heading(CHOICE_HEADING, 'choice-screen')

    if (!canEatSun(s)) {
      // The gate closed under us (already chosen, or never qualified) — route to whatever is true now.
      showChoice()
      return
    }

    const art = doc.createElement('pre')
    art.className = 'arena glow-egg'
    art.setAttribute('data-testid', 'choice-eat-confirm-art')
    art.textContent = CHOICE_ART
    screen.appendChild(art)

    paragraph(EAT_CONFIRM_NOTE, 'blurb', 'choice-eat-confirm')
    screen.appendChild(ctx.button(EAT_CONFIRM_LABEL, 'choice-eat-confirm-yes', () => commitEat()))
    screen.appendChild(ctx.button(EAT_CANCEL_LABEL, 'choice-eat-confirm-no', () => showChoice(), 0))
  }

  /**
   * Commit ending 3 (EAT IT) — the terminal scene + the NG+ dark-save round-trip that ENDS the game. The order:
   * draw the black screen + the night sky + the eater's line, now yours ("You have 8,100 stars."), THEN, on the
   * 'begin again, in the dark' click, dispatch chooseEat (which builds the fresh dark save — fresh default +
   * carried lifetime + the §367 darkRun flag + the inverted 8100 opening, all commit-once), persist it with
   * save(), and reboot so the bootstrap re-loads the autosaved dark save and opens on the inverted opener.
   *
   * The state effect (chooseEat -> beginDarkSave) is the tested engine; this only draws the scene and routes the
   * reboot. chooseEat is commit-once at the engine level (a SAME-ref no-op once any ending is chosen), so a
   * double-click cannot re-roll the dark save; and after the reboot the loaded dark save has endingChosen='eat'
   * carried forward, so a stray re-entry on it is still gated.
   */
  function commitEat(): void {
    if (endingChosen(session.getState())) {
      showEnding()
      return
    }
    ctx.clearScreen()
    heading(EAT_HEADING, 'ending-screen')

    const art = doc.createElement('pre')
    art.className = 'arena glow-sun'
    art.setAttribute('data-testid', 'ending-art')
    art.setAttribute('data-ending', 'eat')
    art.textContent = EAT_ART
    screen.appendChild(art)

    paragraph(EAT_BLURB, 'blurb', 'ending-eat-blurb')

    // The eater's counter, now yours — the §367 inverted opening, already falling from 8100.
    const sky = doc.createElement('p')
    sky.className = 'blurb'
    sky.setAttribute('data-testid', 'ending-eat-opening')
    sky.textContent = `${t('ending.eat.darkOpening')} (${t('ending.eat.darkSky')})`
    screen.appendChild(sky)

    // The point of no return: eat the sun (build + persist the dark save), then reboot into the dark opener.
    screen.appendChild(
      ctx.button(DARK_BEGIN_LABEL, 'ending-eat-begin', () => {
        session.dispatch((st) => chooseEat(st))
        session.save()
        ctx.logText('You eat the sun. The light goes out, and the world begins again, in the dark.')
        ctx.reboot()
      }),
    )
  }

  /**
   * The terminal ending presentation (§200/§201) — the chosen scene, read off the committed endingChosen
   * string. The dragon ascending and the night sky refilling (hatch), or the sealed egg and the watch and the
   * frozen sky (feed). A re-entry shows the same scene; the corner star readout reflects the up-tick / the
   * freeze automatically (it reads projectedStars). The end of the game — no onward route but the map.
   */
  function showEnding(): void {
    ctx.clearScreen()
    const s = session.getState()
    const ending = chosenEnding(s)

    // These two branches MUST render terminally INLINE and must NOT call showChoice(): showChoice() routes any
    // committed endingChosen straight back here, so bouncing back to it would mutually recurse and hang the tab.
    //
    // No committed ending at all (corrupt/forward-compat endingChosen string -> chosenEnding === null, while
    // endingChosen() may still read true): a deadpan terminal fallback + the map button. Never re-enter the
    // choice.
    if (ending === null) {
      heading(CHOICE_HEADING, 'ending-screen')
      paragraph(
        'The light is gone, and what came after it has not been written down anywhere you can read.',
        'blurb',
        'ending-unknown',
      )
      screen.appendChild(ctx.button('back to the map', 'ending-to-map', () => ctx.showMap(), 0))
      return
    }
    // Ending 3 (EAT IT) — the terminal night-sky scene, read off the committed 'eat' string. In the normal flow
    // the eat path reboots straight into the inverted §367 opener (it never lands here); this is the defensive
    // re-entry (e.g. a committed dark save routed back through showChoice -> showEnding). Render it terminally
    // INLINE — the black screen, the night sky, the eater's line now yours — and never bounce to showChoice
    // (the recursion guard). The only route out is to look at the (dark) map.
    if (ending === 'eat') {
      heading(EAT_HEADING, 'ending-screen')
      const eatArt = doc.createElement('pre')
      eatArt.className = 'arena glow-sun'
      eatArt.setAttribute('data-testid', 'ending-art')
      eatArt.setAttribute('data-ending', 'eat')
      eatArt.textContent = EAT_ART
      screen.appendChild(eatArt)
      paragraph(EAT_BLURB, 'blurb', 'ending-eat-blurb')
      const eatSky = doc.createElement('p')
      eatSky.className = 'blurb'
      eatSky.setAttribute('data-testid', 'ending-eat-opening')
      eatSky.textContent = `${t('ending.eat.darkOpening')} (${t('ending.eat.darkSky')})`
      screen.appendChild(eatSky)
      screen.appendChild(ctx.button('back to the map', 'ending-to-map', () => ctx.showMap(), 0))
      return
    }

    const isHatch = ending === 'hatch'
    heading(isHatch ? HATCH_HEADING : FEED_HEADING, 'ending-screen')

    const art = doc.createElement('pre')
    art.className = 'arena glow-sun'
    art.setAttribute('data-testid', 'ending-art')
    art.setAttribute('data-ending', ending)
    art.textContent = isHatch ? HATCH_ART : FEED_ART
    screen.appendChild(art)

    paragraph(isHatch ? HATCH_BLURB : FEED_BLURB, 'blurb', 'ending-blurb')

    // The sky readout, surfaced on the terminal scene itself (the corner StatusBar also reflects it): rising
    // for hatch, held for feed. projectedStars reads the right branch automatically.
    const sky = doc.createElement('p')
    sky.className = 'blurb'
    sky.setAttribute('data-testid', 'ending-sky')
    sky.textContent = isHatch
      ? `${t('ui.starCounter')}: ${projectedStars(s).toLocaleString()} (${t('ending.hatch.sky')})`
      : `${t('ui.starCounter')}: ${projectedStars(s).toLocaleString()} (${t('ending.feed.sky')})`
    screen.appendChild(sky)

    screen.appendChild(ctx.button('back to the map', 'ending-to-map', () => ctx.showMap(), 0))
  }

  function showFinale(): void {
    showDescentPort()
  }

  return { showDescentPort, showCaramelCore, showStarEater, showChoice, showEnding, showFinale }
}

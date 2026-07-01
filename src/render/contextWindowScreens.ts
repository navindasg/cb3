import type { GameSession } from '@/engine/session/gameSession'
import {
  scrollBy,
  atTop,
  atBottom,
  visibleWindow,
} from '@/engine/content/contextWindow'
import {
  createHallucination,
  resolveHallucination,
  hallucinationOutcome,
  beatFor,
  shownFoeHp,
  hallucinationDefeated,
  grantHallucinationReward,
  type HallucinationState,
  type HallucinationOutcome,
} from '@/engine/content/hallucination'
import {
  CONTEXT_WINDOW_LINES,
  TERMINAL_HEADING,
  VIEWPORT_LINES,
} from '@/content/moon/contextWindow'
import {
  HALLUCINATION_HEADING,
  SECOND_PANEL_BLURB,
  OPEN_SECOND_PANEL_LABEL,
  HALLUCINATION_INTRO,
  HALLUCINATION_WON_FIRST,
  HALLUCINATION_WON_AGAIN,
  HALLUCINATION_CALM,
  HP_BAR_LIE_MAX,
  MAX_TURNS,
  type TrustAction,
} from '@/content/moon/hallucination'
import { deathEpitaph } from '@/render/deathEpitaph'

// The context window terminal + the hallucination (Phase 5 — §28 / hidden boss 3, §17). A wiring sub-module of
// the DOM bootstrap, sibling to skyScreens/reflectionScreens: it owns NO game logic. The pure scroll machine
// (scrollBy / visibleWindow / atTop / atBottom) and the hatch-reveal flag live in the tested engine
// (engine/content/contextWindow); the honest hallucination fight (createHallucination / resolveHallucination /
// hallucinationOutcome / shownFoeHp) lives in the tested engine (engine/content/hallucination) over content
// config (content/moon/hallucination). This only draws the monospace terminal, routes the scroll clicks, opens
// the SECOND panel, and draws the hallucination's FAKE UI over the honest engine — counterfeit buttons that do
// nothing, false damage numbers, and a lying HP bar. The lies are DRAWN here; the outcome is resolved in the
// engine on the TRUTH, so the deception can never change the result. Coverage-excluded, Playwright-verified.
// Routed back to the moon it hatches off of.
//
// The scroll cursor + the fight cursor are EPHEMERAL — held in this closure; nothing persists but the hatch-
// opened flag (set on the moon screen) and the hallucination-defeated flag + the fourth-wall fragment (committed
// once here, gated by hallucinationDefeated — farm-proof, the kraken idiom).

/** A pure-ASCII HP bar, e.g. [#####] / [##---]. */
function hpBar(cur: number, max: number, width = 12): string {
  const filled = Math.max(0, Math.min(width, Math.round((cur / max) * width)))
  return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}]`
}

export interface ContextWindowContext {
  readonly doc: Document
  readonly screen: HTMLElement
  readonly session: GameSession
  clearScreen(): void
  button(label: string, testid: string, onClick: () => void, accelIndex?: number): HTMLButtonElement
  notify(text: string): void
  logText(text: string): void
  /** Back to the moon (the hatch is on its far side). */
  showMoon(): void
}

export interface ContextWindowScreens {
  showContextWindow(): void
}

/** Wire the context-window terminal screen (+ the hallucination behind its second panel) over a bootstrap host. */
export function createContextWindowScreens(ctx: ContextWindowContext): ContextWindowScreens {
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

      // The second panel (the hallucination's entry, §17) is signposted at the foot of the notes. Opening it
      // starts the fight; once beaten it hangs open on an empty cupboard. A curiosity that never blocks progress.
      if (bottom) {
        const s = session.getState()
        if (hallucinationDefeated(s)) {
          paragraph(HALLUCINATION_CALM, 'blurb', 'context-window-second-panel')
        } else {
          paragraph(SECOND_PANEL_BLURB, 'blurb', 'context-window-second-panel')
          screen.appendChild(
            ctx.button(OPEN_SECOND_PANEL_LABEL, 'context-window-open-panel', () => showHallucination()),
          )
        }
      }

      screen.appendChild(ctx.button('close the panel', 'context-window-to-moon', () => ctx.showMoon(), 0))
    }

    function doScroll(delta: number): void {
      cursor = scrollBy(cursor, delta, CONTEXT_WINDOW_LINES.length, VIEWPORT_LINES)
      render()
    }

    render()
  }

  /** The hallucination fight (createHallucination / resolveHallucination / hallucinationOutcome) lives in the
   * tested engine (engine/content/hallucination); this only draws its FAKE UI — a LYING HP bar (shownFoeHp), the
   * counterfeit shown damage numbers, and a decoy button that does nothing — over the HONEST engine, and commits
   * the fourth-wall fragment ONCE (gated by hallucinationDefeated — farm-proof, the kraken idiom). Transient: an
   * abandoned or lost fight is forfeit; only the cleared flag + the one-off fragment persist. */
  function showHallucination(): void {
    let fight: HallucinationState | null = null
    let committed = false
    // True only on the FIRST win (the fragment was actually granted) — the victory blurb must not promise a
    // shard already in your pocket on a rematch.
    let looted = false

    function render(): void {
      ctx.clearScreen()
      const s = session.getState()
      heading(HALLUCINATION_HEADING, 'hallucination-screen')

      if (hallucinationDefeated(s) && !fight) {
        // Beaten and not here to re-fight — the calm cupboard. (You may still re-open to fight again from the
        // terminal foot; that path sets `fight` first, so this branch is the truly-done state.)
        paragraph(HALLUCINATION_CALM, 'blurb', 'hallucination-calm')
      } else {
        if (!fight) fight = createHallucination()
        renderFight(fight)
      }

      screen.appendChild(ctx.button('back to the terminal', 'hallucination-to-terminal', () => showContextWindow(), 0))
    }

    function renderFight(f: HallucinationState): void {
      const outcome: HallucinationOutcome = hallucinationOutcome(f)

      if (outcome === 'won') {
        if (!committed) commitVictory()
        paragraph(looted ? HALLUCINATION_WON_FIRST : HALLUCINATION_WON_AGAIN, 'blurb', 'hallucination-won')
        return
      }
      if (outcome === 'lost') {
        paragraph(deathEpitaph('hallucination'), 'blurb', 'hallucination-epitaph')
        paragraph(
          'It draws a "YOU DIED" that is the wrong size and slightly the wrong colour, and under it a button marked TRY AGAIN that does, for once, nothing false: press it. Stop reading its numbers. Read the thing. It lies exactly as often as it tells the truth — believe the honest turns, disbelieve the lies, and it cannot touch you.',
          'blurb',
          'hallucination-lost',
        )
        screen.appendChild(ctx.button('try again (this button is real)', 'hallucination-retry', () => doRetry()))
        return
      }

      // --- the fight in progress: the FAKE UI over the HONEST engine ---
      paragraph(HALLUCINATION_INTRO, 'blurb', 'hallucination-blurb')

      // The player's TRUE HP bar (honest — the player has to trust SOMETHING; it is the thing's UI that lies).
      paragraph(
        `you             ${hpBar(f.yourHp, f.yourMaxHp, 12)}  ${Math.max(0, Math.ceil(f.yourHp))}/${f.yourMaxHp}`,
        'blurb',
        'hallucination-your-hp',
      )

      // The COUNTERFEIT foe HP bar — it runs BACKWARDS (shownFoeHp), looking healthy as it dies. The e2e asserts
      // the TRUE HP via data-true; the drawn text is the LIE (data-shown). The outcome never reads either bar's
      // text — only f.foeHp — so the lie is pure decoration.
      const shownHp = shownFoeHp(f)
      const foeBar = doc.createElement('p')
      foeBar.className = 'blurb'
      foeBar.setAttribute('data-testid', 'hallucination-foe-hp')
      foeBar.setAttribute('data-shown', String(shownHp)) // the lie the bar draws
      foeBar.setAttribute('data-true', String(Math.max(0, Math.ceil(f.foeHp)))) // the truth the outcome reads
      foeBar.textContent = `the thing      ${hpBar(shownHp, HP_BAR_LIE_MAX, 12)}  ${shownHp}/${HP_BAR_LIE_MAX}`
      screen.appendChild(foeBar)

      // The beat: it SHOWS a damage number (the lie the render draws) beside the TRUE one (only in data-true, for
      // the e2e — the player never sees it; they must learn the cadence by dying). The scene prints only `shown`.
      const beat = beatFor(f.turn)
      const pre = doc.createElement('pre')
      pre.className = 'arena'
      pre.setAttribute('data-testid', 'hallucination-scene')
      pre.setAttribute('data-shown', String(beat.shown)) // the counterfeit number on the fake button
      pre.setAttribute('data-true', String(beat.trueDmg)) // the true blow (e2e only — the player cannot see it)
      pre.setAttribute('data-turn', String(f.turn))
      pre.textContent = sceneText(beat.shown)
      screen.appendChild(pre)

      // The two REAL actions. Their labels quote the SHOWN (lying) number — the interface over-promises — but the
      // engine resolves on the truth. data-shown/data-true let the e2e play perfectly while the player learns.
      const believe = ctx.button(
        `believe it (brace for ${beat.shown} — take nothing if it was honest)`,
        'hallucination-believe',
        () => doAction('believe'),
      )
      believe.setAttribute('data-shown', String(beat.shown))
      believe.setAttribute('data-true', String(beat.trueDmg))
      screen.appendChild(believe)

      const disbelieve = ctx.button(
        `disbelieve it (ignore ${beat.shown} and counter — take nothing if it was lying)`,
        'hallucination-disbelieve',
        () => doAction('disbelieve'),
      )
      disbelieve.setAttribute('data-shown', String(beat.shown))
      disbelieve.setAttribute('data-true', String(beat.trueDmg))
      screen.appendChild(disbelieve)

      // A COUNTERFEIT button: it looks like a third option ("critical strike (999)"), but it is not wired to any
      // action — clicking it does nothing at all (the notes warned: it draws buttons that do nothing). The e2e
      // asserts it is inert (data-counterfeit) and that pressing it never advances the fight. Legible + fair: it
      // is visibly too good to be true, and the player learns the interface itself is the lie.
      const decoy = ctx.button('CRITICAL STRIKE (999 dmg!)', 'hallucination-decoy', () => {
        /* a counterfeit — it does nothing, on purpose */
      })
      decoy.setAttribute('data-counterfeit', 'true')
      decoy.classList.add('shop-unaffordable') // drawn dim/odd, to hint it is not real
      screen.appendChild(decoy)

      paragraph(
        `(turn ${f.turn + 1} of ${MAX_TURNS} — it wears you down after. it lies as often as it tells the truth; the numbers on the screen are the thing you must NOT trust.)`,
        'blurb',
        'hallucination-turn',
      )
    }

    /** The thing, drawn mid-lie: it announces a damage number (the shown lie) it "means" to deal. Pure ASCII. */
    function sceneText(shown: number): string {
      return [
        '   .-""""-.',
        `  / .-. .-.\\    "this hits for ${shown}"`,
        '  \\ (_) (_)/    (it is drawing the number itself)',
        "   )  ^  (      do not believe the number.",
        '  /`-.__.-`\\    read the THING.',
        "  `--------`",
      ].join('\n')
    }

    function doAction(action: TrustAction): void {
      if (!fight) return
      fight = resolveHallucination(fight, action)
      render()
    }

    function commitVictory(): void {
      committed = true
      // First win only grants (and logs) the fragment; a rematch (already defeated) is loot-less. `looted` gates
      // both the victory blurb and the log line so neither promises a shard already in your pocket.
      looted = !hallucinationDefeated(session.getState())
      session.dispatch((s) => {
        if (hallucinationDefeated(s)) return s // already looted — never twice
        return grantHallucinationReward(s)
      })
      ctx.logText(
        looted
          ? 'You beat the hallucination — the thing behind the second panel — by refusing to read its lies, and the fourth-wall fragment is yours: a shard of counterfeit interface that still draws a button doing nothing. (Its one-real-secret-a-day gift waits on a system not yet built; for now it is a trophy.)'
          : 'You beat the hallucination again. It had nothing left to give but the strange company of being lied to and winning anyway.',
      )
    }

    function doRetry(): void {
      fight = createHallucination()
      committed = false
      looted = false
      render()
    }

    render()
  }

  return { showContextWindow }
}

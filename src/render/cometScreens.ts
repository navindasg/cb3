import type { GameSession } from '@/engine/session/gameSession'
import type { GameState } from '@/engine/types/GameState'
import { formatCount } from '@/engine/number/format'
import { setNumber, setFlag } from '@/engine/state/reducers'
import { addResource } from '@/engine/types/Resource'
import {
  createChase,
  aimBy,
  looseHarpoon,
  chaseOver,
  cometExited,
  interceptPoint,
  aimAdvice,
  cometCatchable,
  currentPass,
  msUntilNextPass,
  type ChaseState,
} from '@/engine/content/cometChase'
import {
  LAUNCH,
  ARENA_W,
  ARENA_H,
  AIM_STEP,
  HARPOON_SPEED,
  FLIGHT_DT,
  POP_ROCKS_PER_CATCH,
  POP_ROCKS_FIRST_CATCH_BONUS,
  COMET_LAST_PASS_KEY,
} from '@/content/comet/cometChase'
import { COMET_FIRST_CAUGHT_FLAG } from '@/content/flags'

// The comet (Act 2 — "the comet passes", DESIGN §175/§180). A wiring sub-module of the DOM bootstrap,
// sibling to skyPortScreens/reefScreens: it owns NO game logic. The lead-the-target harpoon (createChase
// / aimBy / looseHarpoon / interceptAimRad) and the once-per-pass cooldown (cometCatchable) are pure,
// tested engine (engine/content/cometChase) over content config (content/comet/cometChase); this only
// draws the ASCII sky, routes the aim/fire clicks, and commits the pop-rock haul. Coverage-excluded,
// Playwright-verified — the same thin-wiring contract as the reef. Routed back through showSkyPort.
//
// The chase sim is TRANSIENT (it never persists — an abandoned chase is forfeit, like a quest). Only the
// harvested pop rocks and the harvested-pass marker (numbers.cometLastPass) are persisted. To stay
// farm-proof the haul is committed ONLY on a catch, and a catch advances cometLastPass so the same pass
// cannot be harvested twice — the recurring faucet is gated to one catch per ~90s of game time. Misses
// (the comet outruns you, or the harpoons run dry) bank nothing and let you loose another volley.

const firstCaught = (state: GameState): boolean => state.flags[COMET_FIRST_CAUGHT_FLAG] === true

/** Seconds (rounded) until the comet next comes round, for the cooldown readout. */
const secsUntilNextPass = (state: GameState): number => Math.ceil(msUntilNextPass(state) / 1000)

export interface CometContext {
  readonly doc: Document
  readonly screen: HTMLElement
  readonly session: GameSession
  clearScreen(): void
  button(label: string, testid: string, onClick: () => void, accelIndex?: number): HTMLButtonElement
  notify(text: string): void
  logText(text: string): void
  /** Return to the overworld map. */
  showMap(): void
  /** Return to the sky port (the galleon's home berth). */
  showSkyPort(): void
}

export interface CometScreens {
  showComet(): void
}

/** Wire the comet-chase screen over a bootstrap host. */
export function createCometScreens(ctx: CometContext): CometScreens {
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

  /** Draw the dark as an ASCII grid: the comet '*', a ghost 'o' at where it WILL be (the lead point — so
   * the "aim ahead of it" intuition is legible by eye, not just prose), the harpoon battery 'A', and a
   * dotted line of '.' tracing the current aim. Nothing wraps — this is open sky. */
  function skyText(chase: ChaseState): string {
    const rows: string[][] = Array.from({ length: ARENA_H }, () => Array<string>(ARENA_W).fill(' '))
    const put = (x: number, y: number, ch: string): void => {
      const cx = Math.round(x)
      const cy = Math.round(y)
      if (cx >= 0 && cx < ARENA_W && cy >= 0 && cy < ARENA_H) rows[cy]![cx] = ch
    }
    // the aim line: a few harpoon-flight steps along the current aim
    const dx = Math.cos(chase.aimRad) * HARPOON_SPEED * FLIGHT_DT
    const dy = Math.sin(chase.aimRad) * HARPOON_SPEED * FLIGHT_DT
    for (let k = 1; k <= 18; k++) put(LAUNCH.x + dx * k, LAUNCH.y + dy * k, '.')
    const lead = interceptPoint(chase)
    put(lead.x, lead.y, 'o') // the comet's predicted position — lead your shot here
    put(chase.comet.x, chase.comet.y, '*')
    put(LAUNCH.x, LAUNCH.y, 'A')
    return rows.map((r) => r.join('')).join('\n')
  }

  function showComet(): void {
    // The chase is transient to this visit; a fresh one is laid in whenever the comet is catchable.
    let chase: ChaseState | null = null

    function render(): void {
      ctx.clearScreen()
      const s = session.getState()
      heading('the comet', 'comet-screen')

      if (!cometCatchable(s)) {
        chase = null
        renderCooldown(s)
      } else {
        if (!chase) chase = createChase()
        renderChase(s, chase)
      }

      screen.appendChild(ctx.button('back to the sky port', 'comet-to-skyport', () => ctx.showSkyPort(), 0))
      screen.appendChild(ctx.button('back to the map', 'comet-to-map', () => ctx.showMap()))
    }

    // --- the cooldown: the comet has already been stripped this pass --------------------------------

    function renderCooldown(s: GameState): void {
      paragraph(
        `The comet hangs low and guttering, already stripped of its pop rocks this pass. It will burn bright again when it next comes round — about ${secsUntilNextPass(s)}s.`,
        'blurb',
        'comet-cooldown',
      )
      paragraph(`pop rocks in the hold: ${formatCount(s.popRocks.current)}`, 'blurb', 'comet-hud')
    }

    // --- the chase: the lead-the-target harpoon ----------------------------------------------------

    function renderChase(s: GameState, c: ChaseState): void {
      paragraph(
        firstCaught(s)
          ? 'The comet comes round again, blazing across the dark. Lead it with the harpoon battery — fire where it will be, not where it is.'
          : 'A comet tears across the dark, trailing pop rocks like sparks. The shipwright bolts a harpoon battery to the rail. "You\'ll not hit it by aiming AT it. Aim where it\'s going."',
        'blurb',
        'comet-blurb',
      )

      if (chaseOver(c)) {
        // Reached only on a miss-out (a catch commits and flips to the cooldown branch on re-render).
        paragraph(
          cometExited(c)
            ? 'The comet outruns your last harpoon and is gone over the dark. It will come round again.'
            : 'Your harpoons are all loosed and the comet sails on, untouched.',
          'blurb',
          'comet-missed',
        )
        screen.appendChild(ctx.button('loose another volley', 'comet-retry', () => doRetry()))
        return
      }

      paragraph(
        `harpoons: ${c.harpoonsLeft}    pop rocks in the hold: ${formatCount(s.popRocks.current)}`,
        'blurb',
        'comet-hud',
      )

      const pre = doc.createElement('pre')
      pre.className = 'arena'
      pre.setAttribute('data-testid', 'comet-sky')
      pre.textContent = skyText(c)
      screen.appendChild(pre)

      // The aim advice (engine-computed, like the reef's bestFireDir). The prose is directional only —
      // it points you at the ghost 'o' (where the comet WILL be) and never calls the shot; reading the
      // lead and choosing the moment is yours. The machine-readable data-advice is for the e2e to follow.
      const advice = aimAdvice(c)
      const hint = doc.createElement('p')
      hint.className = 'blurb'
      hint.setAttribute('data-testid', 'comet-hint')
      hint.setAttribute('data-advice', advice)
      hint.textContent =
        advice === 'fire'
          ? "your line crosses the ghost — that's the lead."
          : advice === 'higher'
            ? 'the ghost rides above your line — raise the battery.'
            : 'the ghost rides below your line — lower the battery.'
      screen.appendChild(hint)

      screen.appendChild(ctx.button('aim higher', 'comet-aim-higher', () => doAim(-AIM_STEP)))
      screen.appendChild(ctx.button('aim lower', 'comet-aim-lower', () => doAim(AIM_STEP)))
      screen.appendChild(ctx.button('loose the harpoon', 'comet-fire', () => doFire()))
    }

    function doAim(delta: number): void {
      if (!chase) return
      chase = aimBy(chase, delta)
      render()
    }

    function doFire(): void {
      if (!chase) return
      const result = looseHarpoon(chase)
      chase = result.state
      if (result.caught) {
        const wasFirstCatch = !firstCaught(session.getState())
        const heldBefore = session.getState().popRocks.current
        // Commit the haul, guarded on catchable at dispatch time, and stamp this pass as harvested so it
        // cannot be farmed by re-entry. The first-ever catch pays a one-time bonus + the ride-it lore.
        session.dispatch((st) => {
          if (!cometCatchable(st)) return st
          const bonus = firstCaught(st) ? 0 : POP_ROCKS_FIRST_CATCH_BONUS
          const harvested = setNumber(
            { ...st, popRocks: addResource(st.popRocks, POP_ROCKS_PER_CATCH + bonus) },
            COMET_LAST_PASS_KEY,
            currentPass(st),
          )
          return setFlag(harvested, COMET_FIRST_CAUGHT_FLAG)
        })
        const gained = session.getState().popRocks.current - heldBefore // the actual haul (bonus included)
        ctx.logText(
          `The harpoon bites and the comet swings round on the line — ${formatCount(gained)} pop rocks shaken loose into the hold.`,
        )
        if (wasFirstCatch) {
          // the first catch — signpost the deferred ride without spelling it out
          ctx.notify('Riding the comet down, pop rocks raining into the hold. You could almost steer it.')
        }
      }
      render()
    }

    function doRetry(): void {
      chase = createChase()
      render()
    }

    render()
  }

  return { showComet }
}

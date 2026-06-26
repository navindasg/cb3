import type { GameSession } from '@/engine/session/gameSession'
import type { GameState } from '@/engine/types/GameState'
import { formatCount } from '@/engine/number/format'
import {
  flavorFusionLearned,
  learnFusion,
  canTradeSour,
  tradeSour,
} from '@/engine/content/sourPlanet'
import { SOUR_TRADE_CANDY_COST, SOUR_TRADE_BATCH } from '@/content/planet/sourPlanet'
import { KRAKEN_DEFEATED_FLAG } from '@/content/flags'

// The sour planet & the gummy folk (Act 2 — quest 9, DESIGN §181/§260). A wiring sub-module of the DOM
// bootstrap, sibling to cometScreens/sourbeardScreens: it owns NO game logic. Learning flavor fusion and
// trading candies for sour essence are pure, tested engine (engine/content/sourPlanet); the actual
// fusing (growing two-flavor burrowers) happens back at the gummy vat on the moon (moonScreens), which
// reads the same learned flag. This only draws the arrival + the gummy folk and routes the clicks.
// Coverage-excluded, Playwright-verified. Routed back through showSkyPort.

export interface SourPlanetContext {
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
  /** Descend into the gas to face the sour kraken (its own screen; unlocked after first contact). */
  showKraken(): void
}

export interface SourPlanetScreens {
  showSourPlanet(): void
}

/** Wire the sour-planet screen over a bootstrap host. */
export function createSourPlanetScreens(ctx: SourPlanetContext): SourPlanetScreens {
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

  function showSourPlanet(): void {
    function render(): void {
      ctx.clearScreen()
      const s = session.getState()
      heading('the sour planet', 'sour-screen')

      paragraph(
        'Platforms of hardened candy-shell drift in a haze of corrosive sour gas, etching at the galleon\'s hull. Deep below, something vast and many-armed turns slowly over in the murk — not today. On the nearest platform, a small delegation waits.',
        'blurb',
        'sour-arrival',
      )

      if (!flavorFusionLearned(s)) renderFirstContact()
      else renderTrade(s)

      screen.appendChild(ctx.button('back to the sky port', 'sour-to-skyport', () => ctx.showSkyPort(), 0))
      screen.appendChild(ctx.button('back to the map', 'sour-to-map', () => ctx.showMap()))
    }

    function renderFirstContact(): void {
      paragraph(
        'The gummy folk are small, translucent, and entirely unbothered. Their elder peers up at you with frank, friendly bafflement, as if you were weather. "Oh — YOU. We wondered what you\'d look like." She turns one of her own kind over in her hands, thoughtful. "You work one flavor into a gummy. Only one? You poor thing. Here — watch. Two at once. We call it fusion."',
        'blurb',
        'sour-firstcontact',
      )
      screen.appendChild(ctx.button('let the elder teach you flavor fusion', 'sour-learn-fusion', () => doLearn()))
    }

    function renderTrade(s: GameState): void {
      paragraph(
        'The elder nods at you, unsurprised. "Still pressing your little single-flavor gummies, I expect. Take some sour off our hands — we are, as you may have noticed, rather steeped in it." Fold it into a worm gummy back at the vat and it will burrow twice as hungry.',
        'blurb',
        'sour-elder',
      )
      paragraph(`sour essence on hand: ${formatCount(s.sour.current)}`, 'blurb', 'sour-hud')

      const trade = ctx.button(
        `trade ${formatCount(SOUR_TRADE_CANDY_COST)} candies for ${SOUR_TRADE_BATCH} sour essence`,
        'sour-trade',
        () => doTrade(),
        0,
      )
      if (!canTradeSour(s)) {
        trade.disabled = true
        trade.classList.add('shop-unaffordable')
      }
      screen.appendChild(trade)

      // First contact made, you can now go looking for trouble: the thing in the gas (the sour kraken).
      // Optional — it gates no progression; the elder plainly thinks you should not.
      paragraph(
        s.flags[KRAKEN_DEFEATED_FLAG] === true
          ? 'The elder watches you finger the cold coral circlet and sighs. "You went DOWN there. And came back. And it let you." She shakes her head. "Family now, I suppose. Mind it does not visit."'
          : 'The elder catches you eyeing the haze below and her bafflement, for once, sharpens. "There is something down in the deep gas. Old. Many-armed. We do not go down. You — you have that LOOK." She does not actually say no.',
        'blurb',
        'sour-kraken-signpost',
      )
      screen.appendChild(
        ctx.button(
          s.flags[KRAKEN_DEFEATED_FLAG] === true ? 'descend to the calm deep' : 'descend into the gas (the kraken)',
          'sour-to-kraken',
          () => ctx.showKraken(),
        ),
      )
    }

    function doLearn(): void {
      const result = learnFusion(session.getState())
      if (!result.ok) return
      session.dispatch(() => result.state)
      ctx.logText('The elder shows you how to work two flavor essences into one gummy. Flavor fusion — learned. (Fuse them at the gummy vat, back on the moon.)')
      render()
    }

    function doTrade(): void {
      const result = tradeSour(session.getState())
      if (!result.ok) {
        ctx.notify(`You need ${formatCount(SOUR_TRADE_CANDY_COST)} candies to trade for sour essence.`)
        return
      }
      session.dispatch(() => result.state)
      ctx.logText(`The gummy folk decant ${SOUR_TRADE_BATCH} sour essence into your hold. The elder waves off your thanks.`)
      render()
    }

    render()
  }

  return { showSourPlanet }
}

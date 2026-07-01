import type { GameSession } from '@/engine/session/gameSession'
import type { GameState } from '@/engine/types/GameState'
import { formatCount } from '@/engine/number/format'
import {
  flavorFusionLearned,
  learnFusion,
  canTradeSour,
  tradeSour,
  observeSourDwell,
  sourMarinated,
  sourDwellMs,
  SOUR_MARINATE_MS,
} from '@/engine/content/sourPlanet'
import { t } from '@/content/i18n/en'
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
  /** Register a teardown run on the next screen switch (the marinate dwell interval). */
  onScreen(dispose: () => void): void
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
    // The marinate dwell paragraph, re-captured on each render so the tick can refresh it in place.
    let dwellP: HTMLParagraphElement | null = null

    // The marinate dwell interval. Internal render() calls clearScreen(), which fires ALL screen disposers,
    // so a once-registered interval would die on the first trade/learn re-render. render() therefore re-arms
    // it each pass (clearing any prior timer + registering a fresh teardown); the LAST teardown — from the
    // final render before a genuine screen switch — is the one clearScreen fires, so exactly one is live.
    // The tick itself updates the dwell paragraph IN PLACE and only re-renders on the marinate transition,
    // so there is no full rebuild every second (the questScreens hud.textContent idiom).
    let dwellTimer: ReturnType<typeof setInterval> | null = null
    function armMarinateTick(): void {
      if (dwellTimer !== null) clearInterval(dwellTimer)
      dwellTimer = setInterval(marinateTick, 1000)
      ctx.onScreen(() => {
        if (dwellTimer !== null) clearInterval(dwellTimer)
        dwellTimer = null
      })
    }

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

      renderMarinate(s)

      screen.appendChild(ctx.button('back to the sky port', 'sour-to-skyport', () => ctx.showSkyPort(), 0))
      screen.appendChild(ctx.button('back to the map', 'sour-to-map', () => ctx.showMap()))
      armMarinateTick()
    }

    // The sour-rain marinate (§18): stand here unarmoured and the corrosion slowly, permanently toughens
    // you — 'well-marinated', +1 sour resist, once. The engine's observeSourDwell is offline-safe on
    // accumulatedGameTimeMs; we only surface it (a bare, deadpan status) and let the tick below advance it.
    // The dwell paragraph reference is captured so the once-per-second tick can update its text IN PLACE
    // (the questScreens idiom) — no full rebuild every second, so buttons keep focus and the UI is calm.
    function renderMarinate(s: GameState): void {
      dwellP = null
      if (sourMarinated(s)) {
        paragraph(
          'You are well-marinated. The sour rain, which harrows everything else here, merely greets you.',
          'blurb',
          'sour-marinated',
        )
        return
      }
      if (s.equipped.armour !== null) {
        // Armoured: the rain finds no purchase, so the marinate can never latch. Rather than render
        // NOTHING (silently hiding a real §18 reward once the cloud-wolf cloak auto-equips with no
        // obvious way back), leave a deadpan, recoverable signpost — take off your armour to let it work.
        paragraph(
          'You are armoured; the sour rain finds no purchase, and merely patters off. (Take off your armour — in your inventory — to let it work on you.)',
          'blurb',
          'sour-armoured',
        )
        return
      }
      const p = doc.createElement('p')
      p.className = 'blurb'
      p.setAttribute('data-testid', 'sour-dwell')
      p.textContent = dwellText(s)
      screen.appendChild(p)
      dwellP = p
    }

    /** The deadpan dwell-progress line (recomputed each tick from the live dwell). */
    function dwellText(s: GameState): string {
      const secs = Math.floor(sourDwellMs(s) / 1000)
      return `You are standing, unarmoured, in the sour rain. It stings. (${secs}s / ${SOUR_MARINATE_MS / 1000}s — the gummy folk seem to be counting.)`
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

    // Advance the marinate dwell once a second while the screen is open. observeSourDwell is pure and
    // offline-safe (it reads accumulatedGameTimeMs, so time spent backgrounded still counts). On an
    // ordinary tick we only refresh the dwell paragraph's text IN PLACE (no rebuild); a full render()
    // runs ONLY on the transition that changes structure — the moment the marinate is earned (swap in
    // the 'well-marinated' line, drop the counter). Mirrors the questScreens hud.textContent idiom.
    function marinateTick(): void {
      const before = session.getState()
      const result = observeSourDwell(before)
      if (result.state !== before) session.dispatch(() => result.state)
      if (result.marinated) {
        ctx.logText(t('secret.sourMarinate.reveal'))
        render() // structure changed — swap in the well-marinated paragraph
        return
      }
      if (dwellP) dwellP.textContent = dwellText(session.getState())
    }

    render()
  }

  return { showSourPlanet }
}

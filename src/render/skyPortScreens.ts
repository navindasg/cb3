import type { GameSession } from '@/engine/session/gameSession'
import type { GameState, ResourceKey } from '@/engine/types/GameState'
import { formatCount } from '@/engine/number/format'
import {
  skyPortOpen,
  contribute,
  contributed,
  remaining,
  commissionComplete,
  galleonCommissioned,
  galleonName,
  nameGalleon,
} from '@/engine/content/galleonCommission'
import { GALLEON_COMMISSION, type CommissionLine } from '@/content/ship/galleon'
import { trackTier, nextTier, canUpgrade, upgradeGalleon } from '@/engine/content/galleonUpgrade'
import { reefReached } from '@/engine/content/reefVoyage'
import { sourbeardRetired } from '@/engine/content/shipDuel'
import {
  GALLEON_TRACKS,
  GALLEON_HULL_KEY,
  GALLEON_SAILS_KEY,
  type GalleonTrack,
} from '@/content/ship/galleonUpgrade'

// The sky port (Act 2 — built on the moon's far side, DESIGN §13/§177). A wiring sub-module of the
// DOM bootstrap, sibling to moonScreens/skyScreens: it owns NO game logic. The shipwright's commission
// (the materials ledger, the contribute/affordability rules, the naming) is pure, tested engine
// (engine/content/galleonCommission) over content config (content/ship/galleon); this only composes
// it into DOM and routes clicks. Coverage-excluded, Playwright-verified — the same thin-wiring
// contract as the moon screens, routed back through showMoon / showMap.

const RESOURCE_LABEL: Record<ResourceKey, string> = {
  candies: 'candies',
  lollipops: 'lollipops',
  chocolate: 'chocolate',
  caramel: 'caramel',
  rockCandy: 'rock candy',
  cottonCandy: 'cotton candy',
  licorice: 'licorice',
  popRocks: 'pop rocks',
  sour: 'sour essence',
}

/** A tiny ASCII galleon that gains canvas (sails) and plating (hull) as she is fitted out. Pure ASCII. */
function galleonArt(hull: number, sails: number): string {
  const canvas = sails >= 2 ? '  |^^^|' : '  |^^|'
  const plate = hull >= 3 ? '#' : hull >= 2 ? '=' : '-'
  return [canvas, '   | |', ` \\${plate.repeat(8)}/`, '  ~~~~~~~~~~'].join('\n')
}

/** Everything the sky port needs from the bootstrap host (its DOM + session + helpers). */
export interface SkyPortContext {
  readonly doc: Document
  readonly screen: HTMLElement
  readonly session: GameSession
  clearScreen(): void
  button(label: string, testid: string, onClick: () => void, accelIndex?: number): HTMLButtonElement
  notify(text: string): void
  logText(text: string): void
  /** Return to the overworld map. */
  showMap(): void
  /** Return to the jawbreaker moon (the near side). */
  showMoon(): void
  /** Set sail for the rock candy reef (Act 2 — the first voyage) — wired by the bootstrap. */
  showReef(): void
  /** Chase the comet (Act 2 — "the comet passes") — wired by the bootstrap. */
  showComet(): void
  /** Stand and fight Captain Sourbeard (Act 2 — quest 8) — wired by the bootstrap. */
  showSourbeard(): void
  /** Sail to the sour planet & the gummy folk (Act 2 — quest 9) — wired by the bootstrap. */
  showSourPlanet(): void
}

export interface SkyPortScreens {
  showSkyPort(): void
}

/** Wire the sky-port screen over a bootstrap host. */
export function createSkyPortScreens(ctx: SkyPortContext): SkyPortScreens {
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

  function showSkyPort(): void {
    function render(): void {
      ctx.clearScreen()
      const s = session.getState()
      heading('the sky port', 'skyport-screen')

      // The port is gated on the Act-1 gate, so this is defensive — if a stray route lands here early,
      // answer in voice rather than with a blank screen.
      if (!skyPortOpen(s)) {
        paragraph(
          'Scaffolding, half-built, lashed down against the vacuum. The shipwright is not taking commissions yet — learn to read the sky and seal yourself against the dark first.',
          'blurb',
          'skyport-shut',
        )
        screen.appendChild(ctx.button('back to the moon', 'skyport-to-moon', () => ctx.showMoon(), 0))
        return
      }

      if (galleonCommissioned(s)) {
        renderLaunched(s)
        return
      }

      renderShipwright(s)
      renderLedger(s)
      if (commissionComplete(s)) renderNaming()

      screen.appendChild(ctx.button('back to the moon', 'skyport-to-moon', () => ctx.showMoon(), 0))
      screen.appendChild(ctx.button('back to the map', 'skyport-to-map', () => ctx.showMap()))
    }

    /** The shipwright's standing patter — shifts once the commission is fully funded. */
    function renderShipwright(s: GameState): void {
      if (commissionComplete(s)) {
        paragraph(
          'The shipwright steps back from the slipway and wipes her hands. "That\'s the lot. Hull, plate, rigging, sails, and my fee. She\'s yours, captain — every plank of her. What do we call her?"',
          'blurb',
          'skyport-blurb',
        )
        return
      }
      paragraph(
        'A shipwright works the slipway on the moon\'s dark far side, the candied galleon\'s keel already laid against the stars. "So you mean to sail the dark. Bring me what she needs and I\'ll build her. Jawbreaker plate for her hull, licorice rigging, cotton-candy sails — and my fee, of course."',
        'blurb',
        'skyport-blurb',
      )
    }

    /** The materials ledger — one row per commission line, each with a deliver button. */
    function renderLedger(s: GameState): void {
      heading('the commission', 'skyport-commission')
      for (const line of GALLEON_COMMISSION) renderLine(s, line)
    }

    function renderLine(s: GameState, line: CommissionLine): void {
      const have = contributed(s, line.resource)
      const need = line.amount
      const label = RESOURCE_LABEL[line.resource]
      const done = have >= need
      paragraph(
        `${line.part}:  ${formatCount(have)} / ${formatCount(need)} ${label}${done ? '   (done)' : ''}`,
        'blurb',
        `skyport-line-${line.resource}`,
      )
      if (done) return

      const onHand = s[line.resource].current
      const deliverable = Math.min(onHand, remaining(s, line.resource))
      const deliver = ctx.button(
        `deliver ${label} (${formatCount(onHand)} on hand)`,
        `skyport-deliver-${line.resource}`,
        () => doContribute(line),
      )
      if (deliverable <= 0) {
        deliver.disabled = true
        deliver.classList.add('shop-unaffordable')
      }
      screen.appendChild(deliver)
    }

    function doContribute(line: CommissionLine): void {
      const result = contribute(session.getState(), line.resource)
      if (!result.ok) {
        ctx.notify(
          result.reason === 'lineFull'
            ? `The shipwright has all the ${RESOURCE_LABEL[line.resource]} she needs.`
            : `You have no ${RESOURCE_LABEL[line.resource]} to give.`,
        )
        return
      }
      session.dispatch(() => result.state)
      ctx.logText(
        `You hand over ${formatCount(result.delivered)} ${RESOURCE_LABEL[line.resource]} — ${line.part}.`,
      )
      render()
    }

    /** The naming beat — a text field + a button that lays down the keel under the given name. */
    function renderNaming(): void {
      heading('name her', 'skyport-naming')
      const input = doc.createElement('input')
      input.type = 'text'
      input.maxLength = 40
      input.placeholder = 'the name on her bow'
      input.className = 'name-input'
      input.setAttribute('data-testid', 'skyport-name-input')
      screen.appendChild(input)

      screen.appendChild(
        ctx.button('lay down the keel', 'skyport-name-submit', () => doName(input.value), 0),
      )
    }

    function doName(name: string): void {
      const result = nameGalleon(session.getState(), name)
      if (!result.ok) {
        ctx.notify(
          result.reason === 'emptyName'
            ? 'A ship needs a name. Give her one.'
            : 'She is not ready to be named yet.',
        )
        return
      }
      session.dispatch(() => result.state)
      ctx.logText(`The keel is laid — ${galleonName(result.state)}. The dark is the next thing.`)
      render()
    }

    /** The dock once she is launched — the galleon waits, named, for her first voyage. */
    function renderLaunched(s: GameState): void {
      paragraph(
        `She stands finished in the slipway — ${galleonName(s)} — candied hull catching the starlight, sails furled and waiting. The shipwright nods at the dark beyond the port. "She'll carry you out there now. Wherever out there is."`,
        'blurb',
        'skyport-launched',
      )
      screen.appendChild(ctx.button('set sail for the rock candy reef', 'skyport-set-sail', () => ctx.showReef(), 0))
      // Once the dark has been sailed once, a comet crosses your bearings (Act 2 — "the comet passes").
      if (reefReached(s)) {
        screen.appendChild(ctx.button('chase the comet', 'skyport-to-comet', () => ctx.showComet()))
        // ...and black sails start shadowing you (Act 2 — Captain Sourbeard, quest 8).
        screen.appendChild(
          ctx.button(
            sourbeardRetired(s) ? 'the dark where the Black Lollipop sank' : 'answer the Black Lollipop',
            'skyport-to-sourbeard',
            () => ctx.showSourbeard(),
          ),
        )
        // ...and a sour, gas-wreathed world hangs off the far bearing (Act 2 — the sour planet, quest 9).
        screen.appendChild(ctx.button('sail to the sour planet', 'skyport-to-sour', () => ctx.showSourPlanet()))
      }
      screen.appendChild(ctx.button("the shipwright's yard (fit out the galleon)", 'skyport-to-yard', () => showYard()))
      screen.appendChild(ctx.button('back to the moon', 'skyport-to-moon', () => ctx.showMoon()))
      screen.appendChild(ctx.button('back to the map', 'skyport-to-map', () => ctx.showMap()))
    }

    render()
  }

  // The shipwright's yard — fit out the galleon (hull/sails/cannons, DESIGN §13/§269). Drives the pure
  // engine (engine/content/galleonUpgrade); this only draws the spec + routes the upgrade clicks.
  function showYard(): void {
    function render(): void {
      ctx.clearScreen()
      const s = session.getState()
      heading("the shipwright's yard", 'skyport-yard-screen')
      paragraph(
        'The shipwright circles the galleon with a measuring eye. "Let us make her worth the dark. What are we fitting?"',
        'blurb',
        'skyport-yard-blurb',
      )

      const art = doc.createElement('pre')
      art.className = 'arena'
      art.setAttribute('data-testid', 'skyport-galleon-art')
      art.textContent = galleonArt(trackTier(s, GALLEON_HULL_KEY), trackTier(s, GALLEON_SAILS_KEY))
      screen.appendChild(art)

      for (const track of GALLEON_TRACKS) renderTrack(s, track)
      screen.appendChild(ctx.button('back to the dock', 'yard-to-dock', () => showSkyPort(), 0))
    }

    function renderTrack(s: GameState, track: GalleonTrack): void {
      const current = track.tiers.find((t) => t.tier === trackTier(s, track.key))
      paragraph(`${track.label}:  ${current?.name ?? `tier ${trackTier(s, track.key)}`}`, 'blurb', `yard-${track.label}`)

      const next = nextTier(s, track)
      if (!next) {
        paragraph('  fully fitted.', 'blurb', `yard-${track.label}-max`)
        return
      }
      if (next.deferred) {
        paragraph(`  next: ${next.name} — not yet (${next.note}).`, 'blurb', `yard-${track.label}-locked`)
        return
      }

      const priceText = (next.price ?? [])
        .map((l) => `${formatCount(l.amount)} ${RESOURCE_LABEL[l.resource]}`)
        .join(' + ')
      const extra = next.consumes ? ' + the storm-silk' : ''
      const fit = ctx.button(`fit ${next.name} (${priceText}${extra})`, `yard-upgrade-${track.label}`, () => doUpgrade(track))
      if (!canUpgrade(s, track)) {
        fit.disabled = true
        fit.classList.add('shop-unaffordable')
      }
      screen.appendChild(fit)
    }

    function doUpgrade(track: GalleonTrack): void {
      const result = upgradeGalleon(session.getState(), track)
      if (!result.ok) {
        ctx.notify(
          result.reason === 'missingItem'
            ? 'You do not have what that fitting needs yet.'
            : result.reason === 'unaffordable'
              ? "you can't afford that fitting yet."
              : 'not available yet.',
        )
        return
      }
      session.dispatch(() => result.state)
      const fitted = track.tiers.find((t) => t.tier === trackTier(result.state, track.key))
      ctx.logText(`The shipwright fits the ${fitted?.name ?? track.label}. The galleon sits a little prouder.`)
      render()
    }

    render()
  }

  return { showSkyPort }
}

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
      screen.appendChild(ctx.button('back to the moon', 'skyport-to-moon', () => ctx.showMoon(), 0))
      screen.appendChild(ctx.button('back to the map', 'skyport-to-map', () => ctx.showMap()))
    }

    render()
  }

  return { showSkyPort }
}

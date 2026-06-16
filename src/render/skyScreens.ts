import type { GameSession } from '@/engine/session/gameSession'
import type { GameState } from '@/engine/types/GameState'
import { formatCount } from '@/engine/number/format'
import { buyCloudSheep, cloudSheepCount, cloudSheepPrice } from '@/engine/content/paddock'
import { payToll, TOLL_GIANT_COST } from '@/engine/content/tollGiant'
import { PADDOCK_CONFIG } from '@/content/sky/paddock'
import { CLOUD_COMMONS_REACHED_FLAG, TOLL_GIANT_PAID_FLAG } from '@/content/flags'

// The sky screens (Act 1 — the cumulus commons, the cloud village at the top of the beanstalk).
// A wiring sub-module of the DOM bootstrap, sibling to townScreens: it owns NO game logic. Every
// rule lives in the tested engine (paddock buying, the cottonCandy producer/tick) and content
// (PADDOCK_CONFIG); this only composes them into DOM and routes clicks. Verified end-to-end by
// Playwright, so it shares bootstrap's coverage exclusion. The cloud-sheep paddock is the working
// centrepiece; the balloon workshop and the toll giant are signposted "next" the way Act 0
// signposted unfinished locations (a visible, in-voice notice, never a dead click).

/** Cotton candy a full paddock grazes per minute (the screen shows a friendlier per-minute rate). */
const PER_MINUTE = PADDOCK_CONFIG.cottonPerSheepPerSec * 60

/** Everything the sky screens need from the bootstrap host (its DOM + session + helpers). */
export interface SkyContext {
  readonly doc: Document
  readonly screen: HTMLElement
  readonly session: GameSession
  clearScreen(): void
  button(label: string, testid: string, onClick: () => void, accelIndex?: number): HTMLButtonElement
  notify(text: string): void
  /** Append a literal line to the event log (a purchase, a shepherd's aside). */
  logText(text: string): void
  /** Return to the overworld map. */
  showMap(): void
}

export interface SkyScreens {
  showCloudCommons(): void
}

/** Wire the cumulus commons screen over a bootstrap host. */
export function createSkyScreens(ctx: SkyContext): SkyScreens {
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

  // --- the cumulus commons hub -------------------------------------------------------------

  function showCloudCommons(): void {
    // Reaching the commons surfaces the cotton-candy readout in the status bar (one-time flag).
    session.dispatch((s: GameState) =>
      s.flags[CLOUD_COMMONS_REACHED_FLAG] === true
        ? s
        : { ...s, flags: { ...s.flags, [CLOUD_COMMONS_REACHED_FLAG]: true } },
    )

    function render(): void {
      ctx.clearScreen()
      heading('the cumulus commons', 'cloud-commons-screen')
      paragraph(
        'A village of packed cloud. Sheep the colour of dawn graze the edges, a balloon half-rigged in a workshop, and a very large giant sitting on the only bridge up.',
        'blurb',
      )

      renderPaddock()
      renderBalloonWorkshop()
      renderTollGiant()

      screen.appendChild(ctx.button('back to the map', 'cloud-commons-to-map', () => ctx.showMap(), 0))
    }

    // The cloud sheep paddock: buy sheep with candies (price climbs per head); each grazes a
    // passive trickle of cotton candy. The live total shows in the status bar; here we show the
    // herd, the rate, and the price of the next head.
    function renderPaddock(): void {
      const s = session.getState()
      const count = cloudSheepCount(s, PADDOCK_CONFIG)
      const price = cloudSheepPrice(count, PADDOCK_CONFIG)

      heading('the cloud sheep paddock', 'paddock-section')
      paragraph(`cloud sheep: ${count}`, 'blurb', 'sheep-count')
      paragraph(`cotton candy: ${formatCount(s.cottonCandy.current)}`, 'blurb', 'cotton-total')
      paragraph(
        count === 0
          ? 'An empty paddock. A bored shepherd leans on a crook. "Buy a sheep, why not."'
          : `The herd grazes about ${formatCount(count * PER_MINUTE)} cotton candy a minute.`,
        'blurb',
      )

      const buy = ctx.button(
        `buy a cloud sheep (${formatCount(price)} candies)`,
        'buy-cloud-sheep',
        () => buySheep(),
      )
      if (s.candies.current < price) {
        buy.disabled = true
        buy.classList.add('shop-unaffordable')
      }
      screen.appendChild(buy)
    }

    function buySheep(): void {
      const result = buyCloudSheep(session.getState(), PADDOCK_CONFIG)
      if (!result.ok) {
        ctx.notify("you can't afford another sheep yet.")
        return
      }
      session.dispatch(() => result.state)
      ctx.logText('A cloud sheep ambles into the paddock and begins, immediately, to graze.')
      render()
    }

    // Signposted-but-not-yet-built (the Act 0 idiom): the balloon needs licorice + somewhere to go.
    function renderBalloonWorkshop(): void {
      heading('the balloon workshop', 'balloon-section')
      paragraph(
        'A cotton-candy balloon, half-rigged. "Bring me 500 cotton candy and 50 licorice," the balloonwright says, "and I\'ll fly you to the moon. Once I find some licorice."',
        'blurb',
      )
      screen.appendChild(
        ctx.button('ask about the balloon', 'balloon-ask', () =>
          ctx.notify('The balloonwright shrugs. "No licorice, no moon. Come back when the storm front opens up."'),
        ),
      )
    }

    function renderTollGiant(): void {
      const s = session.getState()
      heading('the toll giant', 'toll-giant-section')

      if (s.flags[TOLL_GIANT_PAID_FLAG] === true) {
        paragraph(
          'The giant shifts aside, still knitting. "Mind the updrafts," he says. The bridge is open — the storm front stacks and flickers beyond it. (Find it on the map.)',
          'blurb',
          'toll-giant-paid',
        )
        return
      }

      paragraph(
        `A giant sits across the only bridge upward, knitting. "${formatCount(TOLL_GIANT_COST)} candies to pass," he says pleasantly, "or you can try your luck. I'd pay, personally."`,
        'blurb',
      )
      const pay = ctx.button(
        `pay the toll (${formatCount(TOLL_GIANT_COST)} candies)`,
        'pay-toll',
        () => payTollGiant(),
      )
      if (s.candies.current < TOLL_GIANT_COST) {
        pay.disabled = true
        pay.classList.add('shop-unaffordable')
      }
      screen.appendChild(pay)
      screen.appendChild(
        ctx.button('size up a fight', 'toll-giant-fight', () =>
          ctx.notify('You measure the giant against yourself. This is not the day. (Fighting him comes later; for now, pay.)'),
        ),
      )
    }

    function payTollGiant(): void {
      const result = payToll(session.getState(), TOLL_GIANT_COST, TOLL_GIANT_PAID_FLAG)
      if (!result.ok) {
        ctx.notify(
          result.reason === 'alreadyPaid'
            ? 'The bridge is already open.'
            : "you can't cover the toll yet.",
        )
        return
      }
      session.dispatch(() => result.state)
      ctx.logText('You hand over the toll. The giant counts it twice, nods, and shifts aside. The bridge is open.')
      render()
    }

    render()
  }

  return { showCloudCommons }
}

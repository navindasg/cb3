import type { GameSession } from '@/engine/session/gameSession'
import type { GameState } from '@/engine/types/GameState'
import { t } from '@/content/i18n/en'
import type { GameTextKey } from '@/content/i18n/schema'
import { formatCount } from '@/engine/number/format'
import {
  buyCloudSheep,
  cloudSheepCount,
  cloudSheepPrice,
  shearSheep,
  shearStreakIndex,
  shearStreakCount,
  cloudWolfAvailable,
} from '@/engine/content/paddock'
import {
  createWolfFight,
  resolveWolfExchange,
  wolfOutcome,
  moveFor,
  cloudWolfDefeated,
  type WolfState,
  type WolfAction,
} from '@/engine/content/cloudWolf'
import { SHEAR_TO_REVEAL, MAX_TURNS as WOLF_MAX_TURNS } from '@/content/sky/cloudWolf'
import { payToll, TOLL_GIANT_COST, currentTollCost, hasTollMercy, takeTollLoss } from '@/engine/content/tollGiant'
import { purchase, canPurchase, grantItem } from '@/engine/shop/purchase'
import { setFlag } from '@/engine/state/reducers'
import { PADDOCK_CONFIG } from '@/content/sky/paddock'
import { BALLOON_ENTRY } from '@/content/sky/balloon'
import { ITEM_MAP, WOLF_WOOL_CLOAK } from '@/content/items/items'
import { CLOUD_COMMONS_REACHED_FLAG, TOLL_GIANT_PAID_FLAG, BALLOON_BUILT_FLAG, CLOUD_WOLF_DEFEATED_FLAG } from '@/content/flags'
import { deathEpitaph } from '@/render/deathEpitaph'

// The sky screens (Act 1 — the cumulus commons, the cloud village at the top of the beanstalk).
// A wiring sub-module of the DOM bootstrap, sibling to townScreens: it owns NO game logic. Every
// rule lives in the tested engine (paddock buying, the cottonCandy producer/tick) and content
// (PADDOCK_CONFIG); this only composes them into DOM and routes clicks. Verified end-to-end by
// Playwright, so it shares bootstrap's coverage exclusion. The cloud-sheep paddock is the working
// centrepiece; the balloon workshop and the toll giant are signposted "next" the way Act 0
// signposted unfinished locations (a visible, in-voice notice, never a dead click).

const tk = (key: string): string => t(key as GameTextKey)

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
  /** The cloud-wolf fight sub-screen (Phase 5, hidden boss 1) — routed to from the commons once revealed, and
   * exposed for the e2e hook (it drives the fight directly, like showKraken). */
  showCloudWolf(): void
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
      renderCloudWolf()
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

      renderShearing(count)
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

    // Shearing: a chore, until it isn't. Each sheep is its own head you can shear over and over; shearing the
    // SAME one seven times running reveals the wolf (engine/content/paddock tracks the streak + latches the
    // reveal). We surface up to a handful of individually-shearable heads (enough to shear the same one on
    // purpose). Reveal is a one-way latch; the streak count is cosmetic until it hits the threshold. Once the
    // wolf is revealed (or already dealt with) the busywork is done, so we stop offering it.
    function renderShearing(count: number): void {
      const s = session.getState()
      if (count === 0 || cloudWolfAvailable(s) || cloudWolfDefeated(s)) return

      const shown = Math.min(count, 4)
      const streakIdx = shearStreakIndex(s)
      const streak = shearStreakCount(s)
      paragraph(
        streak > 0 && streakIdx < shown
          ? `You have sheared the ${ordinal(streakIdx)} sheep ${streak} time${streak === 1 ? '' : 's'} in a row. It does not seem to mind. It does not seem to be a sheep, quite.`
          : 'The shepherd offers you the shears. "Wool\'s wool," he says. "Take your pick."',
        'blurb',
        'shear-streak',
      )
      for (let i = 0; i < shown; i++) {
        const isStreak = i === streakIdx && streak > 0
        const label = `shear the ${ordinal(i)} sheep${isStreak ? ` (${streak}/${SHEAR_TO_REVEAL})` : ''}`
        screen.appendChild(ctx.button(label, `shear-sheep-${i}`, () => doShear(i)))
      }
    }

    function doShear(index: number): void {
      const next = shearSheep(session.getState(), index)
      session.dispatch(() => next)
      if (cloudWolfAvailable(next)) {
        ctx.logText(
          'The wool comes away in your hands and there is no sheep under it — there is a wolf, grey as a thunderhead, and it has been holding very still for a long time. It opens one eye.',
        )
      } else {
        ctx.logText('You shear the sheep. The wool is soft and faintly electric. The sheep says nothing.')
      }
      render()
    }

    // The balloon workshop: spend cotton candy + licorice to build the balloon (the tested generic
    // purchase handler), which reveals the jawbreaker moon. The licorice comes from the thickened
    // beanstalk (feed it past the clouds); the cotton candy from the paddock — its first real sink.
    function renderBalloonWorkshop(): void {
      const s = session.getState()
      heading('the balloon workshop', 'balloon-section')

      if (s.flags[BALLOON_BUILT_FLAG] === true) {
        paragraph(
          'The cotton-candy balloon strains at its mooring line, fully rigged. "She\'ll carry you to the moon whenever you like," the balloonwright says. (It\'s on the map now.)',
          'blurb',
          'balloon-built',
        )
        return
      }

      const cost = BALLOON_ENTRY.price
        .map((l) => `${formatCount(l.amount)} ${l.resource === 'cottonCandy' ? 'cotton candy' : l.resource}`)
        .join(' + ')
      paragraph(
        `A balloon half-rigged in spun cloud. "Bring me ${cost}," the balloonwright says, "and I'll fly you to the moon."`,
        'blurb',
      )
      paragraph(
        `you have: ${formatCount(s.cottonCandy.current)} cotton candy, ${formatCount(s.licorice.current)} licorice`,
        'blurb',
        'balloon-have',
      )

      const build = ctx.button(`build the balloon (${cost})`, 'build-balloon', () => buildBalloon())
      if (!canPurchase(s, BALLOON_ENTRY)) {
        build.disabled = true
        build.classList.add('shop-unaffordable')
      }
      screen.appendChild(build)
    }

    function buildBalloon(): void {
      const result = purchase(session.getState(), BALLOON_ENTRY, ITEM_MAP)
      if (!result.ok) {
        ctx.notify(
          result.reason === 'unaffordable'
            ? "you don't have the cotton candy and licorice yet."
            : 'the balloon is not available.',
        )
        return
      }
      session.dispatch(() => result.state)
      if (result.speechKey) ctx.logText(tk(result.speechKey))
      render()
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

      const cost = currentTollCost(s)
      const mercy = hasTollMercy(s)
      paragraph(
        mercy
          ? `The giant sits across the only bridge upward, still a little sheepish about the whole business. "${formatCount(cost)} candies," he says, softer than before. "Mate's rates."`
          : `A giant sits across the only bridge upward, knitting. "${formatCount(TOLL_GIANT_COST)} candies to pass," he says pleasantly, "or you can try your luck. I'd pay, personally."`,
        'blurb',
        mercy ? 'toll-giant-mercy' : undefined,
      )
      const pay = ctx.button(
        `pay the toll (${formatCount(cost)} candies)`,
        'pay-toll',
        () => payTollGiant(),
      )
      if (s.candies.current < cost) {
        pay.disabled = true
        pay.classList.add('shop-unaffordable')
      }
      screen.appendChild(pay)
      // The 'size up a fight' button stays until mercy is earned: the first click loses (the death line),
      // the second — a deliberate rematch — earns the discount. Only mercy removes the button.
      if (!mercy) {
        screen.appendChild(ctx.button('size up a fight', 'toll-giant-fight', () => sizeUpFight()))
      }
    }

    // Try your luck against the toll giant. You lose — he is a mountain that knits. The FIRST loss just
    // flattens you and plays the deadpan §19 death line; sizing him up a SECOND time, having already
    // tried and lost, earns his pity and a permanent 10% toll discount (the §18 mercy secret). A
    // curiosity, never a gate: paying the full toll was always available. Both losses persist their state
    // (the sized-up marker, then the mercy flag), so the death beat + the discount stay farm-proof.
    function sizeUpFight(): void {
      const result = takeTollLoss(session.getState())
      if (result.firstLoss) {
        session.dispatch(() => result.state) // remember you tried (so the next loss is the deliberate one)
        ctx.notify(`${deathEpitaph('tollGiantLoss')} (Fighting him comes later; for now, pay.)`)
        return
      }
      if (!result.ok) return // already merciful — nothing to farm
      session.dispatch(() => result.state)
      ctx.logText(t('secret.tollMercy.reveal'))
      render()
    }

    function payTollGiant(): void {
      const cost = currentTollCost(session.getState())
      const result = payToll(session.getState(), cost, TOLL_GIANT_PAID_FLAG)
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

    // The cloud wolf (Phase 5, hidden boss 1): once the shears reveal it, a quiet, dangerous shape at the edge
    // of the paddock. Beat it for the wolf-wool cloak (storm immunity). Before the reveal there is nothing here
    // — the whole point is that you find it by shearing, not by being told. Post-defeat: a keepsake note.
    function renderCloudWolf(): void {
      const s = session.getState()
      if (cloudWolfDefeated(s)) {
        heading('the cloud wolf', 'cloud-wolf-section')
        paragraph(
          'Where the wolf stood there is a bare patch of sky and a folded grey cloak. The other sheep have gone back to grazing, as if nothing was ever wrong. You keep the cloak. The storm, when you next climb it, does not seem to notice you at all.',
          'blurb',
          'cloud-wolf-done',
        )
        return
      }
      if (!cloudWolfAvailable(s)) return

      heading('the cloud wolf', 'cloud-wolf-section')
      paragraph(
        'It has not moved from the spot where the sheep used to be. It is watching you the way a stormcloud watches a field. The shepherd has gone very quiet.',
        'blurb',
        'cloud-wolf-revealed',
      )
      screen.appendChild(ctx.button('face the wolf', 'cloud-wolf-fight', () => showCloudWolf()))
    }

    render()
  }

  // --- the cloud-wolf fight (Phase 5, hidden boss 1) --------------------------------------------
  // A pure-ASCII HP bar, e.g. [#####] / [##---].
  function hpBar(cur: number, max: number, width = 5): string {
    const filled = Math.max(0, Math.min(width, Math.round((cur / max) * width)))
    return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}]`
  }

  /** The read-the-pounce fight (createWolfFight / resolveWolfExchange / wolfOutcome) lives in the tested engine
   * (engine/content/cloudWolf); this only draws the crouch tell + HP bars, routes the counter/strike clicks,
   * and commits the cloak ONCE (gated by CLOUD_WOLF_DEFEATED_FLAG — farm-proof, the kraken idiom). Transient:
   * an abandoned or lost clinch is forfeit; only the cleared flag + the one-off cloak persist. */
  function showCloudWolf(): void {
    let fight: WolfState | null = null
    let committed = false

    function render(): void {
      ctx.clearScreen()
      const s = session.getState()
      heading('the cloud wolf', 'cloud-wolf-screen')

      if (cloudWolfDefeated(s)) {
        renderCalm()
      } else {
        if (!fight) fight = createWolfFight(s)
        renderFight(fight)
      }

      screen.appendChild(ctx.button('back to the commons', 'cloud-wolf-to-commons', () => showCloudCommons(), 0))
    }

    function renderCalm(): void {
      paragraph(
        'The wolf is gone, and the wool it left is a cloak now, folded over your arm — thunderhead-grey, faintly humming. Whatever it was, it is not in the paddock any more.',
        'blurb',
        'cloud-wolf-calm',
      )
    }

    function renderFight(f: WolfState): void {
      const outcome = wolfOutcome(f)

      if (outcome === 'won') {
        if (!committed) commitVictory()
        paragraph(
          "The wolf sits, all at once, the way a dog sits — and then it is only wool again, a grey heap of it, settling. You gather it up. It is warm, and it is yours, and the storm is never going to touch you again.",
          'blurb',
          'cloud-wolf-won',
        )
        return
      }
      if (outcome === 'lost') {
        paragraph(deathEpitaph('cloudWolf'), 'blurb', 'cloud-wolf-epitaph')
        paragraph(
          'It bears you down into the cloud and, unhurried, lets you back up again — this time. Catch your breath, bring a real blade, and learn to read the crouch: meet its leaps, and only cut when it merely snaps.',
          'blurb',
          'cloud-wolf-lost',
        )
        screen.appendChild(ctx.button('catch your breath and face it again', 'cloud-wolf-retry', () => doRetry()))
        return
      }

      // --- the fight in progress ---
      paragraph(
        'It crouches, and reads you back. When it gathers to LEAP (a lunge), meet it — counter its lunge and it turns on your guard and you cut deep. When it only feints and SNAPS, a counter-snap turns it too. But it lies with its body: the crouch it shows is not always the move it makes. STRIKE and you hit hard, but its move always lands. Guess wrong and it bites for free.',
        'blurb',
        'cloud-wolf-blurb',
      )

      paragraph(`you        ${hpBar(f.yourHp, f.yourMaxHp, 12)}  ${Math.max(0, Math.ceil(f.yourHp))}/${f.yourMaxHp}`, 'blurb', 'cloud-wolf-your-hp')
      paragraph(`the wolf   ${hpBar(f.foeHp, f.foeMaxHp, 12)}  ${Math.max(0, Math.ceil(f.foeHp))}/${f.foeMaxHp}`, 'blurb', 'cloud-wolf-foe-hp')

      const beat = moveFor(f.turn)
      const pre = doc.createElement('pre')
      pre.className = 'arena'
      pre.setAttribute('data-testid', 'cloud-wolf-scene')
      // machine-readable hints for the e2e (the player reads the crouch by eye): the tell it SHOWS, and the
      // move it ACTUALLY makes (a feint when they differ). The screen draws only the tell; the test reads both.
      pre.setAttribute('data-tell', beat.crouch)
      pre.setAttribute('data-move', beat.move)
      pre.setAttribute('data-turn', String(f.turn))
      pre.textContent = sceneText(beat.crouch)
      screen.appendChild(pre)

      screen.appendChild(ctx.button('counter its lunge (guard the leap)', 'cloud-wolf-counter-lunge', () => doAction('counter-lunge')))
      screen.appendChild(ctx.button('counter its snap (guard low)', 'cloud-wolf-counter-snap', () => doAction('counter-snap')))
      screen.appendChild(ctx.button('strike (commit — its move lands)', 'cloud-wolf-strike', () => doAction('strike')))

      const w = f.weapon
      paragraph(
        `your hand: damage ${w.damage}${w.strikes > 1 ? ` x${w.strikes}` : ''}   (turn ${f.turn + 1} of ${WOLF_MAX_TURNS} — it wears you down after)`,
        'blurb',
        'cloud-wolf-weapon',
      )
    }

    /** The wolf's crouch, drawn by the tell it shows (a leap-crouch or a low snarl). */
    function sceneText(tell: string): string {
      return tell === 'lunge'
        ? ['     ,--.__', "    (      `>   it gathers to LEAP", "     `--'  ^^"].join('\n')
        : ['      __', "   <`  )__     it lowers, and snarls", "    `----' ^^"].join('\n')
    }

    function doAction(action: WolfAction): void {
      if (!fight) return
      fight = resolveWolfExchange(fight, action)
      render()
    }

    function commitVictory(): void {
      committed = true
      session.dispatch((s) => {
        if (cloudWolfDefeated(s)) return s // already looted — never twice
        return grantItem(setFlag(s, CLOUD_WOLF_DEFEATED_FLAG), WOLF_WOOL_CLOAK)
      })
      ctx.logText(
        'The cloud wolf is beaten, and the wolf-wool cloak is yours — now worn. The storm front will not touch you again (re-equip another cloak at your inventory if you ever want to feel the weather).',
      )
    }

    function doRetry(): void {
      fight = createWolfFight(session.getState())
      committed = false
      render()
    }

    render()
  }

  return { showCloudCommons, showCloudWolf }
}

/** Small ordinal helper for the shear labels ("the 1st sheep", "the 2nd sheep", …). Pure, ASCII. */
function ordinal(index: number): string {
  const n = index + 1
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'
  return `${n}${suffix}`
}

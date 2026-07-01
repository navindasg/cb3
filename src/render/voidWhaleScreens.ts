import type { GameSession } from '@/engine/session/gameSession'
import type { GameState } from '@/engine/types/GameState'
import type { ShopEntry } from '@/engine/types/defs'
import { formatCount } from '@/engine/number/format'
import { addResource } from '@/engine/types/Resource'
import { purchase } from '@/engine/shop/purchase'
import { visibleShopRows } from '@/engine/shop/shopView'
import {
  plotVoidBearing,
  voidReached,
  currentVoidLeg,
  voidLeg,
  voidWaypoint,
  createWhaleFight,
  resolveWhaleTurn,
  whaleOutcome,
  telegraphedTooth,
  strikeTarget,
  voidWhaleDefeated,
  grantWhaleReward,
  blackGrimoireOwned,
  castGrimoireEclipse,
  type WhaleState,
  type WhaleAction,
} from '@/engine/content/voidWhale'
import { eclipsed, projectedStars } from '@/engine/content/starCounter'
import {
  VOID_BEARINGS,
  VOID_LEGS,
  HERMIT_SHOP,
  WHALE_CANDY,
  WHALE_CHOCOLATE,
  MAX_TURNS,
} from '@/content/void/voidWhale'
import { ITEM_MAP } from '@/content/items/items'
import { t } from '@/content/i18n/en'
import type { GameTextKey } from '@/content/i18n/schema'
import { deathEpitaph } from '@/render/deathEpitaph'

// The void whale (Phase 5 — hidden boss 4, DESIGN §17). A wiring sub-module of the DOM bootstrap, sibling to
// reefScreens/contextWindowScreens: it owns NO game logic. The empty-space crossing (plot-a-course), the
// optional telegraph-and-sever fight (reads the equipped hand weapon), the hermit's shop grants, and the
// eclipse world-spell all live in the tested engine (engine/content/voidWhale + starCounter) over content
// config (content/void/voidWhale). This only composes them into DOM, draws the ASCII, and routes clicks.
// Coverage-excluded, Playwright-verified. Routed back to the sky port (you sailed from the galleon's berth).
//
// Three phases, all soft-lock-free:
//   1) the crossing to empty space (gated at entry on the acorn — the squirrel's coordinate)
//   2) the belly: the hermit's shop (best gloves + the black grimoire) + the OPTIONAL fight + LEAVE
//   3) leaving is ALWAYS allowed. The reward is the shop + the grimoire, not the kill; the hermit prefers it.
//
// The fight is TRANSIENT (never persisted — an abandoned or lost bout is forfeit). Only the crossing progress
// (numbers), the reached flag, the hermit's grants (shop-priced, once each), and the optional void-pearl drop
// (commit-once, gated by the cleared flag — farm-proof, the kraken idiom) persist.

/** A pure-ASCII HP bar, e.g. [#####] / [##---]. */
function hpBar(cur: number, max: number, width = 12): string {
  const filled = Math.max(0, Math.min(width, Math.round((cur / max) * width)))
  return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}]`
}

/** Display name of a bearing by id. */
const bearingName = (id: string): string => VOID_BEARINGS.find((b) => b.id === id)?.name ?? id

export interface VoidWhaleContext {
  readonly doc: Document
  readonly screen: HTMLElement
  readonly session: GameSession
  clearScreen(): void
  button(label: string, testid: string, onClick: () => void, accelIndex?: number): HTMLButtonElement
  notify(text: string): void
  logText(text: string): void
  /** Back to the sky port (you sailed from the galleon's berth). */
  showSkyPort(): void
}

export interface VoidWhaleScreens {
  showVoidWhale(): void
}

/** Wire the void-whale screen (the crossing + the belly + the hermit + the optional fight) over a host. */
export function createVoidWhaleScreens(ctx: VoidWhaleContext): VoidWhaleScreens {
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

  function showVoidWhale(): void {
    // The whale fight is transient to this visit; the pearl commits once on a win. The scene has three states:
    // the crossing (not yet reached), the belly (reached), and — inside the belly — an optional live fight.
    let fight: WhaleState | null = null
    let committed = false
    // True only on the FIRST whale win (the pearl was actually granted) — the victory blurb must not promise a
    // pearl already in your pocket on a rematch.
    let looted = false

    function render(): void {
      ctx.clearScreen()
      const s = session.getState()
      if (voidReached(s)) renderBelly(s)
      else renderCrossing(s)
      screen.appendChild(ctx.button('back to the sky port', 'void-to-skyport', () => ctx.showSkyPort(), 0))
    }

    // --- phase 1: the crossing to empty space (plot a course to the coordinate) ------------------

    function renderCrossing(s: GameState): void {
      heading('a course to nowhere', 'void-crossing-screen')
      paragraph(
        'The acorn of knowledge whispers a coordinate, and the coordinate points at nothing — a stretch of the dark with no star in it, deliberately empty, the way a held breath is empty. You could plot a course out to it. There is nothing there. You are fairly sure there is nothing there.',
        'blurb',
        'void-crossing-blurb',
      )

      const leg = currentVoidLeg(s, VOID_LEGS) ?? []
      const plotted = voidWaypoint(s)
      paragraph(
        `the leg:        ${leg.map(bearingName).join(' -> ')}    (leg ${voidLeg(s) + 1} of ${VOID_LEGS.length})`,
        'blurb',
        'void-leg',
      )
      paragraph(
        `you have plotted:  ${leg.map((id, i) => (i < plotted ? bearingName(id) : '?')).join(' -> ')}`,
        'blurb',
        'void-plot',
      )

      for (const bearing of VOID_BEARINGS) {
        screen.appendChild(ctx.button(bearing.name, `void-bearing-${bearing.id}`, () => doPlot(bearing.id)))
      }
    }

    function doPlot(bearingId: string): void {
      const result = plotVoidBearing(session.getState(), bearingId, VOID_LEGS)
      if (!result.ok) return
      session.dispatch(() => result.state)
      if (!result.correct) {
        ctx.notify('The bearing drifts wide. The leg is lost — read it again from the top.')
      } else if (result.reached) {
        ctx.logText('You reach the empty coordinate. There is nothing there — and then the nothing opens, and it has a mouth, and the galleon is gone down it whole. You are inside the void whale.')
      } else if (result.legComplete) {
        ctx.logText('The leg closes, bearing to bearing. The dark ahead gets, if anything, darker.')
      }
      render()
    }

    // --- phase 2: the belly (the hermit's shop + the grimoire + the optional fight + leave) -------

    function renderBelly(s: GameState): void {
      // An active fight takes over the belly view until it resolves.
      if (fight) {
        renderFight(fight)
        return
      }

      heading('inside the whale', 'void-whale-screen')

      const belly = doc.createElement('pre')
      belly.className = 'arena glow-star'
      belly.setAttribute('data-testid', 'void-belly-art')
      belly.textContent = [
        '   .-~~~-.',
        '  /  o    \\   ',
        ' |   .-.   |  the ribs arch away into the dark',
        '  \\ (   ) /   a small warm light, far in',
        "   `-...-'",
      ].join('\n')
      screen.appendChild(belly)

      paragraph(
        'The whale did not even notice it had swallowed you. Somehow that is worse. Deep in it, among the ribs, a hermit has made a small dry home of the dark. He looks up without much surprise. "Oh," he says. "You. Well. You had better come in, then, since you are in."',
        'blurb',
        'void-belly-blurb',
      )

      // The hermit's shop — the gloves + the grimoire, on the generic purchase rails. Best-in-game gloves fill
      // the empty gloves slot; the grimoire unlocks eclipse. Bought once each.
      appendHermitShop(s)

      // The black grimoire's ECLIPSE, once owned — the one world spell (pauses the star counter for a window).
      if (blackGrimoireOwned(s)) renderEclipse(s)

      // The OPTIONAL fight. Never required to claim the shop/grimoire; the hermit would rather you did not.
      if (voidWhaleDefeated(s)) {
        paragraph(
          'The whale is quiet around you now, the way it was before, only more so. The hermit does not mention the fight. It was not necessary, and you both know it.',
          'blurb',
          'void-whale-done',
        )
      } else {
        paragraph(
          '"There is the whale itself, of course," the hermit says, not looking up, "if you feel you must. Its teeth. I would rather you did not — it has never done you any harm, and it will not, unless you start it. But you are your own person. Or you can simply go. I would go."',
          'blurb',
          'void-fight-offer',
        )
        screen.appendChild(ctx.button('fight the whale (you do not have to)', 'void-fight-begin', () => beginFight()))
      }
    }

    function appendHermitShop(s: GameState): void {
      const rows = visibleShopRows(s, HERMIT_SHOP, ITEM_MAP)
      for (const row of rows) {
        const line = doc.createElement('div')
        line.className = 'shop-row'
        line.setAttribute('data-testid', `void-shop-row-${row.item.id}`)
        const name = t(row.item.displayKey as GameTextKey)
        const desc = t(row.item.descKey as GameTextKey)
        if (row.owned) {
          const label = doc.createElement('span')
          label.className = 'shop-owned'
          label.textContent = `${row.item.ascii} ${name} — owned`
          line.appendChild(label)
        } else {
          const label = doc.createElement('span')
          label.className = 'shop-item'
          label.textContent = `${row.item.ascii} ${name} — ${desc}`
          line.appendChild(label)
          const buy = ctx.button(`take it (${priceText(row.entry)})`, `void-buy-${row.item.id}`, () => doBuy(row.entry))
          if (!row.affordable) {
            buy.disabled = true
            buy.classList.add('shop-unaffordable')
          }
          line.appendChild(buy)
        }
        screen.appendChild(line)
      }
    }

    function priceText(entry: ShopEntry): string {
      return entry.price.map((p) => `${formatCount(p.amount)} ${p.resource}`).join(' + ')
    }

    function doBuy(entry: ShopEntry): void {
      const result = purchase(session.getState(), entry, ITEM_MAP)
      if (!result.ok) {
        ctx.notify(result.reason === 'unaffordable' ? "you can't afford that yet." : 'not available.')
        return
      }
      session.dispatch(() => result.state)
      if (result.speechKey) ctx.logText(t(result.speechKey as GameTextKey))
      render()
    }

    function renderEclipse(s: GameState): void {
      const under = eclipsed(s)
      paragraph(
        under
          ? `A shadow is across the sky. The stars are not falling — held, for a while. (${t('ui.starCounter')}: ${projectedStars(s).toLocaleString()})`
          : 'The black grimoire falls open to the eclipse. You could draw a shadow across the sky, and the stars would stop falling, for a while.',
        'blurb',
        'void-eclipse-blurb',
      )
      const cast = ctx.button(under ? 'the eclipse holds' : 'cast eclipse (hold back the sky)', 'void-cast-eclipse', () => doEclipse())
      if (under) {
        cast.disabled = true
        cast.classList.add('shop-unaffordable')
      }
      screen.appendChild(cast)
    }

    function doEclipse(): void {
      const result = castGrimoireEclipse(session.getState())
      if (!result.ok) {
        ctx.notify('You do not have the grimoire.')
        return
      }
      session.dispatch(() => result.state)
      ctx.logText('You cast eclipse. A shadow crosses the sky, and the stars stop falling. For a while. Nothing does, for long. But a while is a while.')
      render()
    }

    // --- the optional fight (transient) ---------------------------------------------------------

    function beginFight(): void {
      fight = createWhaleFight(session.getState())
      committed = false
      render()
    }

    function renderFight(f: WhaleState): void {
      heading('the whale itself', 'void-whale-screen')
      const outcome = whaleOutcome(f)

      if (outcome === 'won') {
        if (!committed) commitVictory()
        paragraph(
          looted
            ? 'The last tooth shatters and the throat gapes and the whale, at last, notices you — a small cold attention, there and gone. It lets you go. On the gum where the tooth was, a dark bead has come loose: a void pearl. You take it. The hermit says nothing, but he looks a little sad, the way you look at someone who did a thing they did not need to.'
            : 'You shatter the teeth again; the whale gapes and lets you go, as it did before. It leaves nothing new behind — you already took the pearl, the first time. The hermit still looks a little sad.',
          'blurb',
          'void-whale-won',
        )
        screen.appendChild(ctx.button('back to the hermit', 'void-whale-to-belly', () => { fight = null; render() }))
        return
      }
      if (outcome === 'lost') {
        paragraph(deathEpitaph('voidWhale'), 'blurb', 'void-whale-epitaph')
        paragraph(
          'The throat closes and you are swallowed deeper, and the whale never does notice. You did not have to do that. Read its teeth if you try again: swing AT the far tooth it winds up (your reach intercepts its crush — take nothing), brace the far ones you cannot reach, and shatter them all before the throat shuts. Or, as the hermit keeps saying, simply leave.',
          'blurb',
          'void-whale-lost',
        )
        screen.appendChild(ctx.button('try again', 'void-whale-retry', () => { fight = createWhaleFight(session.getState()); committed = false; render() }))
        screen.appendChild(ctx.button('leave the whale be', 'void-whale-give-up', () => { fight = null; render() }))
        return
      }

      // --- the fight in progress ---
      paragraph(
        'The teeth grind forward out of the dark, one winding back to strike. STRIKE the tooth you can reach (swing AT the winding one to intercept its crush — reach is your defence) or BRACE (set your feet, halve a blow you cannot reach). Shatter them all before the throat closes.',
        'blurb',
        'void-whale-blurb',
      )

      paragraph(`you    ${hpBar(f.yourHp, f.yourMaxHp)}  ${Math.max(0, Math.ceil(f.yourHp))}/${f.yourMaxHp}`, 'blurb', 'void-your-hp')
      paragraph(`teeth left: ${f.teeth.length}`, 'blurb', 'void-teeth')

      const tel = telegraphedTooth(f)
      const target = strikeTarget(f)
      const pre = doc.createElement('pre')
      pre.className = 'arena'
      pre.setAttribute('data-testid', 'void-whale-scene')
      pre.setAttribute('data-turn', String(f.turn))
      pre.setAttribute('data-telegraphed', tel ? String(tel.id) : '')
      pre.setAttribute('data-target', target ? String(target.id) : '')
      pre.setAttribute('data-reach', String(f.weapon.reach))
      pre.textContent = [
        'the throat:  ' + f.teeth.map((tth) => (tel && tth.id === tel.id ? `[${tth.dist}]` : ` ${tth.dist} `)).join(''),
        tel ? `it winds the far tooth (band ${tel.dist}) back to crush` : '',
      ].join('\n')
      screen.appendChild(pre)

      screen.appendChild(ctx.button('strike (swing at the tooth you can reach)', 'void-whale-strike', () => doTurn('strike')))
      screen.appendChild(ctx.button('brace (set your feet)', 'void-whale-brace', () => doTurn('brace')))

      const w = f.weapon
      paragraph(
        `your hand: damage ${w.damage}${w.strikes > 1 ? ` x${w.strikes}` : ''}  reach ${w.reach}   (turn ${f.turn + 1} of ${MAX_TURNS} — the throat closes after)`,
        'blurb',
        'void-whale-weapon',
      )
    }

    function doTurn(action: WhaleAction): void {
      if (!fight) return
      fight = resolveWhaleTurn(fight, action)
      render()
    }

    function commitVictory(): void {
      committed = true
      // First win only grants (and logs) the pearl + the hoard; a rematch (already defeated) is loot-less.
      looted = !voidWhaleDefeated(session.getState())
      session.dispatch((s) => {
        if (voidWhaleDefeated(s)) return s // already looted — never twice
        const rewarded = grantWhaleReward(s)
        return { ...rewarded, candies: addResource(rewarded.candies, WHALE_CANDY), chocolate: addResource(rewarded.chocolate, WHALE_CHOCOLATE) }
      })
      ctx.logText(
        looted
          ? `The void whale lets you go. In its belly-hoard: ${formatCount(WHALE_CANDY)} candies, ${formatCount(WHALE_CHOCOLATE)} chocolate, and a void pearl. The hermit watches you pocket the pearl and does not say the thing he is thinking.`
          : 'The void whale lets you go again. There was nothing new to take — the pearl was already yours. The hermit shakes his head, kindly.',
      )
    }

    render()
  }

  return { showVoidWhale }
}

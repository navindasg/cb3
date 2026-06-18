import type { GameSession } from '@/engine/session/gameSession'
import type { GameState } from '@/engine/types/GameState'
import { formatCount } from '@/engine/number/format'
import { setNumber } from '@/engine/state/reducers'
import {
  mineStratum,
  upgradePick,
  currentStratum,
  nextPick,
  moonPickTier,
  stratumProgress,
  canMine,
  canUpgradePick,
  wormTunnelsOpen,
} from '@/engine/content/moonStrata'
import {
  MOON_STRATA,
  MOON_PICKS,
  STARTER_PICK_TIER,
  MOON_PICK_TIER_KEY,
} from '@/content/moon/strata'
import { MOON_WORM_DEFEATED_FLAG } from '@/content/flags'
import { t } from '@/content/i18n/en'
import type { GameTextKey } from '@/content/i18n/schema'

// The moon screens (Act 1 — the jawbreaker moon, reached by the cotton-candy balloon). A wiring
// sub-module of the DOM bootstrap, sibling to skyScreens/townScreens: it owns NO game logic. The
// strata mining + pick upgrades are pure, tested engine (engine/content/moonStrata) over content
// config (content/moon/strata); this only composes them into DOM and routes clicks. Coverage-
// excluded, Playwright-verified. On arrival the lunar outfitter hands you the starter candy pick.

const tk = (key: string): string => t(key as GameTextKey)

const RESOURCE_LABEL: Record<string, string> = {
  candies: 'candies',
  rockCandy: 'rock candy',
  cottonCandy: 'cotton candy',
  licorice: 'licorice',
}

/** The display name of a pick tier (the free starter, then the buyable ladder). */
function pickName(tier: number): string {
  if (tier <= 0) return 'bare hands'
  if (tier === STARTER_PICK_TIER) return tk('moon.pick.candyPick')
  const pick = MOON_PICKS.find((p) => p.tier === tier)
  return pick ? tk(pick.displayKey) : `pick tier ${tier}`
}

function priceText(price: readonly { resource: string; amount: number }[]): string {
  return price.map((l) => `${formatCount(l.amount)} ${RESOURCE_LABEL[l.resource] ?? l.resource}`).join(' + ')
}

export interface MoonContext {
  readonly doc: Document
  readonly screen: HTMLElement
  readonly session: GameSession
  clearScreen(): void
  button(label: string, testid: string, onClick: () => void, accelIndex?: number): HTMLButtonElement
  notify(text: string): void
  logText(text: string): void
  showMap(): void
  /** Launch the moon-worm quest (Quest 4) — wired by the bootstrap to the quest screens. */
  startMoonWorm(): void
}

export interface MoonScreens {
  showMoon(): void
}

/** Wire the jawbreaker-moon screen over a bootstrap host. */
export function createMoonScreens(ctx: MoonContext): MoonScreens {
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

  function showMoon(): void {
    // The lunar outfitter hands every arrival the starter candy pick (one-time, free).
    session.dispatch((s: GameState) =>
      moonPickTier(s) >= STARTER_PICK_TIER ? s : setNumber(s, MOON_PICK_TIER_KEY, STARTER_PICK_TIER),
    )

    function render(): void {
      ctx.clearScreen()
      const s = session.getState()
      heading('the jawbreaker moon', 'moon-screen')
      paragraph(
        'Everyone in the village swore it was cheese. It is a jawbreaker — vast, banded, and very hard. A lunar outfitter has lent you a pick.',
        'blurb',
      )

      paragraph(
        `rock candy: ${formatCount(s.rockCandy.current)}    candies: ${formatCount(s.candies.current)}`,
        'blurb',
        'moon-resources',
      )
      paragraph(`your pick: ${pickName(moonPickTier(s))}`, 'blurb', 'moon-pick')

      renderStratum(s)
      renderOutfitter(s)
      renderWormTunnels(s)

      screen.appendChild(ctx.button('back to the map', 'moon-to-map', () => ctx.showMap(), 0))
    }

    /** The moon worm (Quest 4) surfaces once your digging breaks into its tunnels; gone once it's
     * dead, with a note that its mold now doubles your haul. The engine owns both predicates. */
    function renderWormTunnels(s: GameState): void {
      if (!wormTunnelsOpen(s)) return
      heading('the worm tunnels', 'moon-worm-section')
      if (s.flags[MOON_WORM_DEFEATED_FLAG] === true) {
        paragraph(
          'The colossal worm is dead. Its mold is yours — gummy pressed into it digs alongside you, and every dig comes up doubled.',
          'blurb',
          'moon-worm-cleared',
        )
        return
      }
      paragraph(
        'Your digging has broken into a glistening bore-hole, chewed clean through the candy. Something colossal is still in there, eating.',
        'blurb',
        'moon-worm-blurb',
      )
      screen.appendChild(ctx.button('into the worm tunnels', 'moon-worm-enter', () => ctx.startMoonWorm(), 0))
    }

    function renderStratum(s: GameState): void {
      const stratum = currentStratum(s, MOON_STRATA)
      heading('strata mining', 'moon-mining-section')

      if (!stratum) {
        paragraph('You have mined clean through to the hollow core. There is nothing left to break here — for now.', 'blurb', 'moon-depleted')
        return
      }

      paragraph(
        `${tk(stratum.displayKey)} — dug ${stratumProgress(s)} / ${stratum.digsToClear}`,
        'blurb',
        'moon-stratum',
      )

      const canBreak = canMine(s, MOON_STRATA)
      if (!canBreak) {
        paragraph(`Your ${pickName(moonPickTier(s))} just skitters off it. You need a stronger pick.`, 'blurb', 'moon-too-hard')
      }
      const mine = ctx.button('mine', 'moon-mine', () => doMine(), 0)
      if (!canBreak) {
        mine.disabled = true
        mine.classList.add('shop-unaffordable')
      }
      screen.appendChild(mine)
    }

    function doMine(): void {
      const result = mineStratum(session.getState(), MOON_STRATA)
      if (!result.ok) {
        ctx.notify(
          result.reason === 'pickTooWeak'
            ? 'The stratum is too hard for your pick. Upgrade it at the outfitter.'
            : 'There is nothing left to mine here.',
        )
        return
      }
      session.dispatch(() => result.state)
      if (result.advanced) ctx.logText('The stratum gives way — you break through to the layer below.')
      render()
    }

    function renderOutfitter(s: GameState): void {
      const pick = nextPick(s, MOON_PICKS)
      if (!pick) return // already at the top of the pick ladder
      heading('the lunar outfitter', 'moon-outfitter-section')
      paragraph(`next pick: ${tk(pick.displayKey)} — ${priceText(pick.price)}`, 'blurb', 'moon-next-pick')

      const buy = ctx.button('upgrade your pick', 'moon-upgrade-pick', () => doUpgrade())
      if (!canUpgradePick(s, MOON_PICKS)) {
        buy.disabled = true
        buy.classList.add('shop-unaffordable')
      }
      screen.appendChild(buy)
    }

    function doUpgrade(): void {
      const result = upgradePick(session.getState(), MOON_PICKS)
      if (!result.ok) {
        ctx.notify(result.reason === 'maxTier' ? 'You already wield the best pick there is.' : "you can't afford that pick yet.")
        return
      }
      session.dispatch(() => result.state)
      ctx.logText(`The outfitter fits you with a ${pickName(moonPickTier(result.state))}.`)
      render()
    }

    render()
  }

  return { showMoon }
}

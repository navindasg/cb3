import type { GameSession } from '@/engine/session/gameSession'
import type { GameState, ResourceKey } from '@/engine/types/GameState'
import type { ShopEntry, CauldronEntry, ItemDef } from '@/engine/types/defs'
import type { GameTextKey } from '@/content/i18n/schema'
import { t } from '@/content/i18n/en'
import { formatCount } from '@/engine/number/format'
import { spendResource } from '@/engine/types/Resource'
import { purchase, type PurchaseResult } from '@/engine/shop/purchase'
import { visibleShopRows } from '@/engine/shop/shopView'
import { buyTelescope } from '@/engine/content/observatory'
import { brew } from '@/engine/cauldron/brew'
import { fireAny } from '@/engine/content/secrets'
import { tellRumor, rumorAvailable } from '@/engine/content/tavern'
import { act1GateCleared } from '@/engine/content/actGate'
import { selectVariant } from '@/engine/content/dialogue'
import { FORGE_ENTRIES } from '@/content/shops/forge'
import { SHOP_ENTRIES } from '@/content/shops/shop'
import { OBSERVATORY_ENTRIES } from '@/content/shops/observatory'
import { CAULDRON_RECIPES } from '@/content/recipes/cauldron'
import { ACT0_SECRETS } from '@/content/secrets'
import { ASTRONOMER_DIALOGUE } from '@/content/dialogue/astronomer'
import { TAVERN_RUMORS } from '@/content/tavern/rumors'
import { ITEM_MAP } from '@/content/items/items'
import { VILLAGE_REACHED_FLAG } from '@/content/flags'

// The town screens (the village hub + the forge, the general shop, the observatory + its cauldron)
// — a wiring sub-module of the DOM bootstrap, extracted to keep bootstrap.ts thin. Like bootstrap
// it owns NO game logic: every rule lives in the tested engine (purchase, shopView, buyTelescope,
// brew, secrets) and content (the registries). This file only composes them into DOM and routes
// clicks. It is verified end-to-end by Playwright (so it shares bootstrap's coverage exclusion).
// The generic shop renderer is reused by the forge, the shop and the observatory alike.

const tk = (key: string): string => t(key as GameTextKey)

/** Human labels for the resources that appear in Act 0 prices. */
const RESOURCE_LABEL: Partial<Record<ResourceKey, string>> = {
  candies: 'candies',
  rockCandy: 'rock candy',
  lollipops: 'lollipops',
  chocolate: 'chocolate',
  caramel: 'caramel',
  cottonCandy: 'cotton candy',
  licorice: 'licorice',
}

function priceText(entry: ShopEntry): string {
  return entry.price
    .map((line) => `${formatCount(line.amount)} ${RESOURCE_LABEL[line.resource] ?? line.resource}`)
    .join(' + ')
}

/** Everything the town screens need from the bootstrap host (its DOM + session + helpers). */
export interface TownContext {
  readonly doc: Document
  readonly screen: HTMLElement
  readonly session: GameSession
  clearScreen(): void
  button(label: string, testid: string, onClick: () => void, accelIndex?: number): HTMLButtonElement
  notify(text: string): void
  /** Append a literal line to the event log (a merchant's thanks, a secret's reveal). */
  logText(text: string): void
  /** Return to the overworld map. */
  showMap(): void
  /** Start the gummy-worm cellar mini-quest (a village house; owned by the quest screens). */
  startCellar(): void
}

export interface TownScreens {
  showVillage(): void
  showForge(): void
  showShop(): void
  showObservatory(): void
  showCauldron(): void
  showTavern(): void
}

type PurchaseFn = (state: GameState, entry: ShopEntry, items: ReadonlyMap<string, ItemDef>) => PurchaseResult

/** Wire the village + forge + shop + observatory + cauldron screens over a bootstrap host. */
export function createTownScreens(ctx: TownContext): TownScreens {
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

  // --- the village hub ---------------------------------------------------------------------

  function showVillage(): void {
    ctx.clearScreen()
    // Reaching the village reveals the sugar mines + the mountain on the overworld (one-time).
    session.dispatch((s: GameState) =>
      s.flags[VILLAGE_REACHED_FLAG] === true
        ? s
        : { ...s, flags: { ...s.flags, [VILLAGE_REACHED_FLAG]: true } },
    )

    heading('the village', 'village-screen')
    paragraph('A handful of crooked houses, a forge, a shop, a tavern, and a well. People nod at you.', 'blurb')

    screen.appendChild(ctx.button('the forge', 'village-forge', () => showForge(), 4))
    screen.appendChild(ctx.button('the shop', 'village-shop', () => showShop(), 4))
    screen.appendChild(ctx.button('the tavern', 'village-tavern', () => showTavern(), 4))
    screen.appendChild(ctx.button('the well', 'village-well', () => throwAtWell(), 4))
    screen.appendChild(ctx.button('the old cellar', 'village-cellar', () => ctx.startCellar(), 8))
    screen.appendChild(ctx.button('back to the map', 'village-to-map', () => ctx.showMap(), 0))
  }

  // --- the tavern: one free rumor (a hint) per accumulated game hour --------------------------

  function showTavern(): void {
    ctx.clearScreen()
    heading('the tavern', 'tavern-screen')
    paragraph('Warm, low-ceilinged, and smelling of caramel. The barkeep leans over the bar.', 'blurb')

    if (rumorAvailable(session.getState())) {
      screen.appendChild(
        ctx.button('ask for a rumor', 'tavern-rumor', () => {
          const result = tellRumor(session.getState(), TAVERN_RUMORS)
          if (result.rumor) {
            session.dispatch(() => result.state)
            ctx.logText(tk(result.rumor.textKey))
          }
          showTavern()
        }, 0),
      )
    } else {
      paragraph('"Told you all I know for now," the barkeep shrugs. "Come back in a while."', 'blurb')
    }
    screen.appendChild(ctx.button('back to the village', 'tavern-to-village', () => showVillage(), 0))
  }

  /** The well-interest secret: throw a candy in and (the first time) one comes back with interest. */
  function throwAtWell(): void {
    const before = session.getState()
    if (before.candies.current < 1) {
      ctx.notify('you have no candy to throw in.')
      return
    }
    const result = fireAny(before, ACT0_SECRETS, { kind: 'throw', target: 'well', count: 1 })
    if (result.fired && result.revealKey) {
      // fireAny already added the +1 reward; spend the candy you threw → net the flag + the reveal.
      const spent = spendResource(result.state.candies, 1)
      session.dispatch(() => (spent ? { ...result.state, candies: spent } : result.state))
      ctx.logText(tk(result.revealKey))
    } else {
      session.dispatch((s) => {
        const spent = spendResource(s.candies, 1)
        return spent ? { ...s, candies: spent } : s
      })
      ctx.notify('You throw a candy in the well. Nothing comes back. It was a one-time thing.')
    }
  }

  // --- a generic shop screen (the forge / the general shop / the observatory store) ----------

  /** Append the visible, buyable rows of `entries` to the screen (no title/back chrome). */
  function appendShopRows(entries: readonly ShopEntry[], buyFn: PurchaseFn, rerender: () => void): void {
    const rows = visibleShopRows(session.getState(), entries, ITEM_MAP)
    for (const row of rows) {
      const line = doc.createElement('div')
      line.className = 'shop-row'
      line.setAttribute('data-testid', `shop-row-${row.item.id}`)
      const name = tk(row.item.displayKey)
      const desc = tk(row.item.descKey)

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
        const buy = ctx.button(`buy (${priceText(row.entry)})`, `buy-${row.item.id}`, () =>
          buyEntry(row.entry, buyFn, rerender),
        )
        if (!row.affordable) {
          buy.disabled = true
          buy.classList.add('shop-unaffordable')
        }
        line.appendChild(buy)
      }
      screen.appendChild(line)
    }
  }

  function buyEntry(entry: ShopEntry, buyFn: PurchaseFn, rerender: () => void): void {
    // Compute from the live state, then dispatch the precomputed result (the codebase idiom).
    const result = buyFn(session.getState(), entry, ITEM_MAP)
    if (!result.ok) {
      ctx.notify(result.reason === 'unaffordable' ? "you can't afford that yet." : 'not available yet.')
      return
    }
    session.dispatch(() => result.state)
    if (result.speechKey) ctx.logText(tk(result.speechKey))
    rerender()
  }

  function showForge(): void {
    ctx.clearScreen()
    const s = session.getState()
    heading('the forge', 'forge-screen')
    paragraph('The blacksmith wipes her hands. "Spoon will only get you so far. Pick something."', 'blurb')

    // The Act-1 capstone framing (DESIGN §171): once you can navigate, she eyes the moon dust on
    // your boots and the great commission she has waited her whole life to attempt; once it is done,
    // the gate is closed and the dark is the next thing.
    if (act1GateCleared(s)) {
      paragraph('The fishbowl helm sits finished on the bench, catching the forge-light. She keeps glancing at it. "Go on, then. The dark will not sail itself."', 'blurb', 'forge-fishbowl-done')
    } else if (s.flags['celestialNavigationLearned'] === true) {
      paragraph('She nods at the moon dust on your boots. "So. You will be wanting to breathe up there. Bring me rock candy and I will seal you something ridiculous."', 'blurb', 'forge-fishbowl-ready')
    }

    appendShopRows(FORGE_ENTRIES, purchase, showForge)
    screen.appendChild(ctx.button('back to the village', 'forge-to-village', () => showVillage(), 0))
  }

  function showShop(): void {
    ctx.clearScreen()
    heading('the shop', 'shop-screen')
    paragraph('A general store. Hats, oddments, and — for the trusted — a back-room book.', 'blurb')
    appendShopRows(SHOP_ENTRIES, purchase, showShop)
    screen.appendChild(ctx.button('back to the village', 'shop-to-village', () => showVillage(), 0))
  }

  // --- the observatory (atop the mountain) + its cauldron basement ----------------------------

  function showObservatory(): void {
    ctx.clearScreen()
    heading('the observatory', 'observatory-screen')

    const variant = selectVariant(ASTRONOMER_DIALOGUE, session.getState())
    if (variant) {
      const who = doc.createElement('p')
      who.className = 'speaker'
      who.textContent = `${tk(ASTRONOMER_DIALOGUE.nameKey)}:`
      screen.appendChild(who)
      const speech = doc.createElement('div')
      speech.className = 'dialogue'
      speech.setAttribute('data-testid', 'astronomer-dialogue')
      for (const lineKey of variant.lines) {
        const p = doc.createElement('p')
        p.className = 'dialogue-line'
        p.textContent = tk(lineKey)
        speech.appendChild(p)
      }
      screen.appendChild(speech)
    }

    appendShopRows(OBSERVATORY_ENTRIES, buyTelescope, showObservatory)
    screen.appendChild(ctx.button('down to the cauldron', 'obs-cauldron', () => showCauldron(), 8))
    screen.appendChild(ctx.button('back to the map', 'observatory-to-map', () => ctx.showMap(), 0))
  }

  // --- the cauldron (the observatory basement): a small action-log brewing puzzle -------------

  function showCauldron(): void {
    // The action log is transient UI state (resolved decision 5 — not persisted); each action
    // appends to it and a brew matches the whole log against the recipe registry.
    let log: CauldronEntry[] = []

    function render(): void {
      ctx.clearScreen()
      heading('the cauldron', 'cauldron-screen')
      paragraph('A black pot mutters to itself. Add things. Stir. Heat. See what happens.', 'blurb')

      const trail = doc.createElement('p')
      trail.className = 'cauldron-log'
      trail.setAttribute('data-testid', 'cauldron-log')
      trail.textContent = log.length === 0 ? '(empty)' : log.map(describeStep).join(' → ')
      screen.appendChild(trail)

      const row = doc.createElement('div')
      row.className = 'shop-row'
      row.appendChild(ctx.button('add a candy', 'cauldron-add-candy', () => addIngredient('candy', 'candies')))
      row.appendChild(ctx.button('add a lollipop', 'cauldron-add-lollipop', () => addIngredient('lollipop', 'lollipops')))
      row.appendChild(ctx.button('stir', 'cauldron-stir', () => addAction('stir')))
      row.appendChild(ctx.button('heat', 'cauldron-heat', () => addAction('heat')))
      screen.appendChild(row)

      screen.appendChild(ctx.button('brew', 'cauldron-brew', () => doBrew(), 0))
      screen.appendChild(ctx.button('empty the cauldron', 'cauldron-empty', () => { log = []; render() }))
      screen.appendChild(ctx.button('back upstairs', 'cauldron-back', () => showObservatory(), 5))
    }

    function addAction(action: string): void {
      log = [...log, { action }]
      render()
    }

    function loggedAdds(subject: string): number {
      return log.filter((s) => s.action === 'add' && s.subject === subject).length
    }

    function addIngredient(subject: string, resource: ResourceKey): void {
      // Nothing is spent until a brew SUCCEEDS — a wrong order, or hitting "empty", costs you
      // nothing. Guard only against logging more of an ingredient than you actually hold.
      if (session.getState()[resource].current <= loggedAdds(subject)) {
        ctx.notify(`you have no more ${subject === 'candy' ? 'candy' : subject + 's'} to add.`)
        return
      }
      log = [...log, { action: 'add', subject }]
      render()
    }

    function doBrew(): void {
      const result = brew(session.getState(), log, CAULDRON_RECIPES)
      if (result.brewed && result.recipe) {
        // Only NOW consume exactly what the log put in, then bank the recipe's output.
        let next = result.state
        const candies = spendResource(next.candies, loggedAdds('candy'))
        if (candies) next = { ...next, candies }
        const lollipops = spendResource(next.lollipops, loggedAdds('lollipop'))
        if (lollipops) next = { ...next, lollipops }
        session.dispatch(() => next)
        ctx.logText(`The cauldron yields ${tk(result.recipe.displayKey)}.`)
      } else {
        ctx.notify('The mixture sulks and yields nothing — your ingredients are untouched. (The order matters.)')
      }
      log = []
      render()
    }

    render()
  }

  return { showVillage, showForge, showShop, showObservatory, showCauldron, showTavern }
}

/** Render one cauldron-log step for the trail display. */
function describeStep(step: CauldronEntry): string {
  return step.subject ? `${step.action} ${step.subject}` : step.action
}

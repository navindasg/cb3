import { signal, effect } from '@/engine/signals/signal'
import { createGameSession } from '@/engine/session/gameSession'
import type { GameSession } from '@/engine/session/gameSession'
import { createLoopDriver, browserClock } from '@/engine/loop/driver'
import { parseSpeedParam, MIN_SPEED } from '@/engine/loop/timeScale'
import { createDevPanel, type DevPanel } from '@/render/devPanel'
import { projectedStars, starCounterVisible } from '@/engine/content/starCounter'
import { formatCount, candyCountSentence } from '@/engine/number/format'
import { eatAllCandies, throwCandies, equip } from '@/engine/state/reducers'
import { derivedMaxHp, MAX_HP_KEY } from '@/engine/state/recomputeCaches'
import { isRevealed } from '@/engine/content/reveal'
import { FIELD_REVEAL_THRESHOLDS } from '@/content/fieldReveal'
import {
  requestVisible,
  requestView,
  purchaseFeature,
} from '@/engine/content/progressiveUnlock'
import {
  ACT0_FEATURE_REQUESTS,
  STATUS_BAR_UNLOCKED_FLAG,
  HEALTH_BAR_UNLOCKED_FLAG,
  MAP_UNLOCKED_FLAG,
} from '@/content/gui/featureRequests'
import { plantSeed, feedBeanstalk } from '@/engine/content/beanstalk'
import { fireAny } from '@/engine/content/secrets'
import { CANDY_PRODUCERS } from '@/content/producers/candy'
import { COTTON_CANDY_PRODUCERS } from '@/content/producers/cottonCandy'
import { LICORICE_PRODUCERS } from '@/content/producers/licorice'
import { ROCK_CANDY_PRODUCERS } from '@/content/producers/rockCandy'
import { PEPPERMINT_PRODUCERS } from '@/content/producers/peppermint'
import { SOLAR_COLLECTOR_PRODUCERS } from '@/content/producers/solarCollector'
import { CARAMEL_PRODUCERS } from '@/content/producers/caramel'
import { STARDUST_PRODUCERS } from '@/content/producers/stardust'
import { ACT0_OVERWORLD } from '@/content/overworld'
import { BEANSTALK_ELEVATOR_FLAG, CLOUD_COMMONS_REACHED_FLAG } from '@/content/flags'
import { ACT0_SECRETS } from '@/content/secrets'
import { inventoryView } from '@/content/items/inventoryView'
import { WOODEN_SPOON, ITEM_MAP } from '@/content/items/items'
import { GRANDMA_DIALOGUE, GRANDMA_INTRO_VARIANT_ID } from '@/content/dialogue/grandma'
import { selectVariant, markVariantShown } from '@/engine/content/dialogue'
import { grantItem } from '@/engine/shop/purchase'
import { t } from '@/content/i18n/en'
import type { GameTextKey } from '@/content/i18n/schema'
import { createStatusBar, type StatusBar } from '@/render/StatusBar'
import { createHealthBar, type HealthBar } from '@/render/healthBar'
import { createOverworldRenderer, type OverworldRenderer } from '@/render/Overworld'
import { createTownScreens, type TownScreens } from '@/render/townScreens'
import { createSkyScreens, type SkyScreens } from '@/render/skyScreens'
import { createMoonScreens, type MoonScreens } from '@/render/moonScreens'
import { createSkyPortScreens, type SkyPortScreens } from '@/render/skyPortScreens'
import { createReefScreens, type ReefScreens } from '@/render/reefScreens'
import { createCometScreens, type CometScreens } from '@/render/cometScreens'
import { createSourbeardScreens, type SourbeardScreens } from '@/render/sourbeardScreens'
import { createSourPlanetScreens, type SourPlanetScreens } from '@/render/sourPlanetScreens'
import { createKrakenScreens, type KrakenScreens } from '@/render/krakenScreens'
import { createMintPlanetScreens, type MintPlanetScreens } from '@/render/mintPlanetScreens'
import { createScaffoldScreens, type ScaffoldScreens } from '@/render/scaffoldScreens'
import { createFinaleScreens, type FinaleScreens } from '@/render/finaleScreens'
import { createDescentAudio } from '@/render/descentAudio'
import { createQuestScreens, type QuestScreens } from '@/render/questScreens'
import { STEP_MS } from '@/render/loopTiming'
import { createEventLog, type EventLog } from '@/render/eventLog'
import { createHotkeyLayer, acceleratorKey, underlinedLabel, type HotkeyLayer } from '@/render/hotkeys'
import { wireLifecycleEvents, wasDiscarded } from '@/render/lifecycleEvents'
import { applyReducedMotion, markDecorative } from '@/render/a11y'
import { parseAction } from '@/render/actionRouter'
import { requestPersistence } from '@/engine/save/localStorage'
import type { CellMetrics } from '@/render/font'

// The DOM bootstrap (Phase 1 Block H, ADR §5). It is the wiring layer only: every rule lives
// in the tested engine modules (gameSession, reducers, progressiveUnlock, reveal, dialogue,
// questHost, beanstalk) and the tested render pieces (StatusBar, Overworld, ArenaRenderer,
// eventLog, hotkeys, a11y). This file just composes them into screens and routes clicks/keys.
// It is verified end-to-end by the Playwright suite (e2e/) rather than unit tests, so it is
// excluded from coverage like src/main.ts. Keep it free of game logic so that stays honest.

const FALLBACK_METRICS: CellMetrics = { cellW: 9, cellH: 19.2 }
const tk = (key: GameTextKey): string => t(key)

/** The derived max HP currently in effect (the live cache, or recomputed from lifetime). */
function maxHpOf(s: ReturnType<GameSession['getState']>): number {
  return s.numbers[MAX_HP_KEY] ?? derivedMaxHp(s.lifetimeCandiesEaten)
}

export interface BootstrapHandles {
  readonly session: GameSession
  destroy(): void
}

/** Wire the whole game into `statusRoot` + `mainRoot`. Returns handles for teardown/tests. */
export function bootstrap(statusRoot: HTMLElement, mainRoot: HTMLElement): BootstrapHandles {
  const doc = statusRoot.ownerDocument
  const session = createGameSession({
    // The tick sums producers by resource, so the registries simply concat: cotton candy is inert
    // until you own cloud sheep, licorice until the beanstalk thickens. Offline catch-up credits
    // every produced resource (engine/loop/catchup is resource-agnostic).
    producers: [
      ...CANDY_PRODUCERS,
      ...COTTON_CANDY_PRODUCERS,
      ...LICORICE_PRODUCERS,
      ...ROCK_CANDY_PRODUCERS,
      ...PEPPERMINT_PRODUCERS,
      ...SOLAR_COLLECTOR_PRODUCERS,
      ...CARAMEL_PRODUCERS,
      ...STARDUST_PRODUCERS,
    ],
    onEvents: (events) => events.forEach((e) => log(e as GameTextKey)),
  })

  // Reduced-motion gate on the whole content root (kills the glow pulse + comet/sun motion).
  applyReducedMotion(mainRoot)

  // --- reactive status bar: candy + HP, each gated by its progressive-unlock flag ----------
  const initial = session.getState()
  const candy = signal(initial.candies.current)
  const cottonCandy = signal(initial.cottonCandy.current)
  const licorice = signal(initial.licorice.current)
  const caramel = signal(initial.caramel.current)
  const hp = signal(initial.playerHpCurrent)
  const maxHp = signal(maxHpOf(initial))
  const statusBarUnlocked = signal(initial.flags[STATUS_BAR_UNLOCKED_FLAG] === true)
  const healthBarUnlocked = signal(initial.flags[HEALTH_BAR_UNLOCKED_FLAG] === true)
  // Cotton candy (Act 1) only joins the bar once you've reached the cumulus commons — a new
  // resource should not haunt the HUD with a 0 for all of Act 0.
  const cloudCommonsReached = signal(initial.flags[CLOUD_COMMONS_REACHED_FLAG] === true)
  // Licorice surfaces the moment you've ever produced any (the beanstalk thickened), not before.
  const licoriceSeen = signal(initial.licorice.historicalMax > 0)
  // Caramel surfaces the moment you've ever boiled any (the cauldron's first industry, §111), not before.
  const caramelSeen = signal(initial.caramel.historicalMax > 0)

  const bar: StatusBar = createStatusBar(statusRoot, [
    { id: 'candy', label: 'candies: ', source: candy, visible: statusBarUnlocked },
    { id: 'cottonCandy', label: 'cotton candy: ', source: cottonCandy, visible: cloudCommonsReached },
    { id: 'licorice', label: 'licorice: ', source: licorice, visible: licoriceSeen },
    { id: 'caramel', label: 'caramel: ', source: caramel, visible: caramelSeen },
  ])
  // The HP readout is a graphical health bar (green→orange→red), gated on the health-bar unlock.
  const healthBar: HealthBar = createHealthBar(statusRoot, {
    hp,
    maxHp,
    visible: healthBarUnlocked,
  })
  // The whole bar is hidden until the status bar feature is requested (CB2: no HUD at all first).
  const topDisposers: Array<() => void> = []
  topDisposers.push(
    effect(() => {
      statusRoot.style.display = statusBarUnlocked.get() ? '' : 'none'
    }),
  )

  const offState = session.subscribe((s) => {
    candy.set(s.candies.current)
    cottonCandy.set(s.cottonCandy.current)
    licorice.set(s.licorice.current)
    caramel.set(s.caramel.current)
    hp.set(s.playerHpCurrent)
    maxHp.set(maxHpOf(s))
    statusBarUnlocked.set(s.flags[STATUS_BAR_UNLOCKED_FLAG] === true)
    healthBarUnlocked.set(s.flags[HEALTH_BAR_UNLOCKED_FLAG] === true)
    cloudCommonsReached.set(s.flags[CLOUD_COMMONS_REACHED_FLAG] === true)
    licoriceSeen.set(s.licorice.historicalMax > 0)
    caramelSeen.set(s.caramel.historicalMax > 0)
  })

  // --- the event log (capped + fading; never the old uncapped clutter) ---------------------
  const eventLog: EventLog = createEventLog(mainRoot, { maxLines: 5 })
  function log(key: GameTextKey): void {
    eventLog.push(tk(key))
  }
  function logText(text: string): void {
    eventLog.push(text)
  }

  // --- a transient, always-visible notice (clicking a map location must never be silent) ---
  const toast = doc.createElement('div')
  toast.className = 'toast'
  toast.setAttribute('data-testid', 'toast')
  toast.setAttribute('role', 'status')
  toast.setAttribute('aria-live', 'polite')
  doc.body.appendChild(toast)
  let toastTimer: ReturnType<typeof setTimeout> | undefined
  function notify(text: string): void {
    toast.textContent = text
    toast.classList.add('toast-show')
    logText(text) // also keep the deadpan record in the event log
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => toast.classList.remove('toast-show'), 3200)
  }

  // --- keyboard accelerators (the underlined letter on each button triggers its action) -----
  const hotkeys: HotkeyLayer = createHotkeyLayer(doc)

  // --- screen container --------------------------------------------------------------------
  const screen = doc.createElement('div')
  screen.className = 'screen'
  mainRoot.insertBefore(screen, eventLog.el)

  let map: OverworldRenderer | null = null
  // Screen-scoped teardown (effects, subscriptions, quest intervals + arena unmounts) cleared on
  // every screen switch. Quest screens register their interval/arena teardown here via onScreen.
  const screenDisposers: Array<() => void> = []
  const onScreen = (dispose: () => void): void => void screenDisposers.push(dispose)

  function clearScreen(): void {
    for (const d of screenDisposers.splice(0)) d()
    hotkeys.clearBindings()
    if (map) {
      map.unmount()
      map = null
    }
    screen.replaceChildren()
    // Leaving a quest: the status-bar health bar reflects the persisted (town) HP again. During
    // a quest the quest screens drive these signals from the live scene player instead.
    const s = session.getState()
    hp.set(s.playerHpCurrent)
    maxHp.set(maxHpOf(s))
  }

  /**
   * A CB2 "stone button". When `accelIndex` points at a letter, that letter is underlined and the
   * matching key is bound to the same action (torn down on the next screen switch).
   */
  function button(
    label: string,
    testid: string,
    onClick: () => void,
    accelIndex?: number,
  ): HTMLButtonElement {
    const b = doc.createElement('button')
    b.setAttribute('data-testid', testid)
    const key = accelIndex === undefined ? '' : acceleratorKey(label, accelIndex)
    if (key) {
      const { before, letter, after } = underlinedLabel(label, accelIndex!)
      if (before) b.appendChild(doc.createTextNode(before))
      const u = doc.createElement('u')
      u.textContent = letter
      b.appendChild(u)
      if (after) b.appendChild(doc.createTextNode(after))
      hotkeys.bind(key, onClick)
    } else {
      b.textContent = label
    }
    b.addEventListener('click', onClick)
    return b
  }

  // --- screens -------------------------------------------------------------

  function showOpener(): void {
    clearScreen()
    const art = doc.createElement('pre')
    art.textContent = ' . \n( )\n `—`'
    art.classList.add('glow-sun')
    markDecorative(art)
    screen.appendChild(art)
    const line = doc.createElement('p')
    line.setAttribute('data-testid', 'opening-line')
    line.textContent = 'You have 1 candy.'
    screen.appendChild(line)
    screen.appendChild(
      button(
        'look around',
        'ack-opener',
        () => {
          session.acknowledgeOpener()
          showField()
        },
        0,
      ),
    )
  }

  function showField(): void {
    clearScreen()

    const title = doc.createElement('h2')
    title.textContent = 'your field'
    screen.appendChild(title)

    // The adaptive candy line, CB2-style, updating every commit ("You have N candies").
    const counter = doc.createElement('p')
    counter.setAttribute('data-testid', 'candy-counter')
    counter.className = 'candy-counter'
    screen.appendChild(counter)
    onScreen(
      effect(() => {
        counter.textContent = candyCountSentence(candy.get())
      }),
    )

    // The controls re-build only when the SET of available affordances changes (crossing a candy
    // threshold or unlocking a feature) — not on every idle tick. CB2's update()/updatePlace().
    const controls = doc.createElement('div')
    controls.className = 'field-controls'
    screen.appendChild(controls)

    let signature = ' ' // force the first build

    function buildControls(): void {
      const s = session.getState()
      hotkeys.clearBindings()
      controls.replaceChildren()

      if (isRevealed(FIELD_REVEAL_THRESHOLDS, 'eat', s)) {
        controls.appendChild(
          button(tk('action.eat'), 'eat-candy', () => session.dispatch(eatAllCandies), 0),
        )
      }
      if (isRevealed(FIELD_REVEAL_THRESHOLDS, 'throw', s)) {
        controls.appendChild(
          button(tk('action.throw'), 'throw-candy', () => session.dispatch((st) => throwCandies(st)), 0),
        )
      }
      // "enter your house" — always available; the 'h' in "house" is the accelerator.
      const houseLabel = tk('action.enterHouse')
      controls.appendChild(button(houseLabel, 'enter-house', () => showHouse(), houseLabel.indexOf('h')))

      // "inventory" appears once you own any gear (grandma's spoon, a forge weapon, …).
      if (Object.values(s.ownedItems).some(Boolean)) {
        const invLabel = tk('action.inventory')
        controls.appendChild(button(invLabel, 'open-inventory', () => showInventory(), invLabel.indexOf('i')))
      }

      if (s.flags[MAP_UNLOCKED_FLAG] === true) {
        const mapLabel = tk('action.openMap')
        controls.appendChild(button(mapLabel, 'open-map', () => showMap(), mapLabel.indexOf('m')))
      }

      if (requestVisible(ACT0_FEATURE_REQUESTS, s)) {
        const view = requestView(ACT0_FEATURE_REQUESTS, s)
        if (view.justUnlocked) {
          const comment = doc.createElement('p')
          comment.className = 'gui-comment'
          comment.setAttribute('data-testid', 'gui-comment')
          comment.textContent = tk(view.justUnlocked.commentKey)
          controls.appendChild(comment)
        }
        if (view.next) {
          const next = view.next
          controls.appendChild(
            button(tk(next.buttonKey), 'request-feature', () => session.dispatch((st) => purchaseFeature(st, next)), 0),
          )
        }
      }

      if (starCounterVisible(s)) {
        const stars = doc.createElement('p')
        stars.className = 'star-counter'
        stars.setAttribute('data-testid', 'star-counter')
        stars.textContent = `${tk('ui.starCounter')}: ${formatCount(projectedStars(s))}`
        controls.appendChild(stars)
      }
    }

    function controlsSignature(): string {
      const s = session.getState()
      const view = requestVisible(ACT0_FEATURE_REQUESTS, s)
        ? requestView(ACT0_FEATURE_REQUESTS, s)
        : { next: null, justUnlocked: null }
      return [
        isRevealed(FIELD_REVEAL_THRESHOLDS, 'eat', s),
        isRevealed(FIELD_REVEAL_THRESHOLDS, 'throw', s),
        s.flags[MAP_UNLOCKED_FLAG] === true,
        Object.values(s.ownedItems).some(Boolean),
        view.next?.flag ?? '',
        view.justUnlocked?.flag ?? '',
        starCounterVisible(s),
      ].join('|')
    }

    function refresh(): void {
      const next = controlsSignature()
      if (next !== signature) {
        signature = next
        buildControls()
      }
    }

    refresh()
    onScreen(session.subscribe(() => refresh()))
  }

  // --- your house: grandma presses the wooden spoon into your hands (the first weapon) ------

  function showHouse(): void {
    clearScreen()
    const title = doc.createElement('h2')
    title.textContent = 'your house'
    screen.appendChild(title)

    const variant = selectVariant(GRANDMA_DIALOGUE, session.getState())
    if (variant) {
      const who = doc.createElement('p')
      who.className = 'speaker'
      who.textContent = `${tk(GRANDMA_DIALOGUE.nameKey as GameTextKey)}:`
      screen.appendChild(who)

      const speech = doc.createElement('div')
      speech.className = 'dialogue'
      speech.setAttribute('data-testid', 'grandma-dialogue')
      for (const lineKey of variant.lines) {
        const line = doc.createElement('p')
        line.className = 'dialogue-line'
        line.textContent = tk(lineKey as GameTextKey)
        speech.appendChild(line)
      }
      screen.appendChild(speech)

      // Showing the intro IS the grant: mark it seen and press the spoon into the player's hands.
      if (variant.id === GRANDMA_INTRO_VARIANT_ID) {
        session.dispatch((s) => grantItem(markVariantShown(s, variant), WOODEN_SPOON))
      }
    }

    const back = tk('action.backToHouse')
    screen.appendChild(button(back, 'house-to-field', () => showField(), back.indexOf('b')))
  }

  // --- the inventory: equipment slots + combat stats + owned items (CB2's Inventory) --------

  function showInventory(): void {
    clearScreen()
    const state = session.getState()
    const view = inventoryView(state, maxHpOf(state))

    const title = doc.createElement('h2')
    title.textContent = 'inventory'
    title.setAttribute('data-testid', 'inventory-screen')
    screen.appendChild(title)

    const weaponName =
      view.stats.weaponId === 'bareHands'
        ? 'bare hands'
        : tk(ITEM_MAP.get(view.stats.weaponId)!.displayKey as GameTextKey)
    const speed = (1000 / view.stats.weaponCooldownMs).toFixed(1)
    const stats = doc.createElement('p')
    stats.className = 'inv-stats'
    stats.setAttribute('data-testid', 'inv-stats')
    stats.textContent = `max hp: ${view.stats.maxHp}    weapon: ${weaponName} (dmg ${view.stats.weaponDamage}, ${speed}/s)`
    screen.appendChild(stats)

    for (const slot of view.slots) {
      if (slot.owned.length === 0) continue
      const row = doc.createElement('div')
      row.className = 'inv-slot'
      const label = doc.createElement('span')
      label.className = 'inv-slot-label'
      label.textContent = `${slot.slot}:`
      row.appendChild(label)
      for (const item of slot.owned) {
        const equipped = item.id === slot.equippedId
        const name = tk(item.displayKey as GameTextKey)
        const b = button(
          `${item.ascii} ${name}${equipped ? ' ✓' : ''}`,
          `inv-equip-${item.id}`,
          () => {
            session.dispatch((s) => equip(s, slot.slot, item.id))
            showInventory()
          },
        )
        if (equipped) b.classList.add('equipped')
        row.appendChild(b)
      }
      screen.appendChild(row)
    }

    if (view.otherItems.length > 0) {
      const others = doc.createElement('p')
      others.className = 'inv-others'
      others.textContent = `items: ${view.otherItems
        .map((i) => tk(i.displayKey as GameTextKey))
        .join(', ')}`
      screen.appendChild(others)
    }

    const back = tk('action.backToField')
    screen.appendChild(button(back, 'inventory-back', () => showField(), back.indexOf('b')))
  }

  function showMap(): void {
    clearScreen()
    map = createOverworldRenderer(screen, {
      world: ACT0_OVERWORLD,
      onRegion: (action) => routeZone(action),
      describeLocation: () => 'The world map. Click a place to travel.',
    })
    map.render(session.getState())
    const back = tk('action.backToField')
    screen.appendChild(button(back, 'map-to-field', () => showField(), back.indexOf('b')))
  }

  // Friendly names for the not-yet-built locations, so the "coming soon" notice reads naturally.
  const ZONE_NAMES: Record<string, string> = {
    forest: 'the forest',
    village: 'the village',
    sugarMines: 'the sugar mines',
    mountain: 'the mountain',
    observatory: 'the observatory',
    sky: 'the sky',
    cloudCommons: 'the cumulus commons',
  }

  function routeZone(action: string): void {
    const { kind, target } = parseAction(action)
    if (kind === 'enter' && target === 'field') return showField()
    if (kind === 'enter' && target === 'village') return town.showVillage()
    if (kind === 'enter' && target === 'beanstalkGarden') return showGarden()
    if (kind === 'quest' && target === 'forest') return quests.startForest()
    if (kind === 'quest' && target === 'beanstalkClimb') return quests.startClimb()
    if (kind === 'quest' && target === 'sugarMines') return quests.startMines()
    if (kind === 'quest' && target === 'mountain') return quests.startMountain()
    if (kind === 'quest' && target === 'stormFront') return quests.startStormFront()
    if (kind === 'enter' && target === 'observatory') return town.showObservatory()
    if (kind === 'enter' && target === 'cloudCommons') return sky.showCloudCommons()
    if (kind === 'enter' && target === 'moon') return moon.showMoon()
    if (kind === 'enter' && target === 'sun') return scaffold.showScaffold()
    // "the sky" is the cloud band itself; once the beanstalk is an elevator it carries you up to
    // the cumulus commons. Before that it's just sky — answer visibly, never with a dead click.
    if (kind === 'travel' && target === 'sky') {
      if (session.getState().flags[BEANSTALK_ELEVATOR_FLAG] === true) return sky.showCloudCommons()
      return notify('The sky is up there. You will need to climb the beanstalk to reach it.')
    }
    const name = ZONE_NAMES[target] ?? (target || kind)
    notify(`${name} — not open yet (building this out next).`)
  }

  // --- the seed pivot + beanstalk garden ----------------------------------

  /** Test/dev shortcut: arm the falling-star gate (telescope + lifetime candies) so the next
   * lifecycle pass fires the seed event without the full idle grind. Not a player-facing button. */
  function armSeed(): void {
    session.dispatch((s) => ({
      ...s,
      flags: { ...s.flags, telescopeOwned: true },
      candies: { ...s.candies, lifetimeAccumulated: Math.max(s.candies.lifetimeAccumulated, 50000) },
    }))
  }

  function showGarden(): void {
    clearScreen()
    const title = doc.createElement('h2')
    title.textContent = 'the beanstalk garden'
    screen.appendChild(title)

    const planted = session.getState().flags['beanstalkPlanted'] === true
    if (!planted) {
      screen.appendChild(
        button('plant the seed', 'plant-seed', () => {
          session.dispatch((s) => plantSeed(s))
          showGarden()
        }),
      )
    } else {
      screen.appendChild(
        button('feed the beanstalk', 'feed-beanstalk', () => {
          const fed = feedBeanstalk(session.getState(), session.getState().candies.current)
          session.dispatch(() => fed.state)
          if (fed.reachedClouds) log('beanstalk.reachedClouds')
          else if (fed.fed) log('beanstalk.feedProgress')
          if (fed.thickened) log('beanstalk.thickened') // the stalk sheds licorice cuttings now
          showGarden()
        }),
      )
      const fed = session.getState().numbers['beanstalkCandiesFed'] ?? 0
      const fedLine = doc.createElement('p')
      fedLine.setAttribute('data-testid', 'fed-total')
      fedLine.textContent = `fed: ${fed}`
      screen.appendChild(fedLine)
    }
    // The single-lollipop leaf secret: a great leaf unfurls into a hammock if you hold EXACTLY one
    // lollipop while you rest (lollipops come from the gummy-worm cellar). The trigger does the
    // exactly-one check; we only surface the option once you hold any.
    if (session.getState().lollipops.current >= 1) {
      screen.appendChild(
        button('rest in the great leaf', 'garden-leaf', () => {
          const before = session.getState()
          const result = fireAny(before, ACT0_SECRETS, { kind: 'hold', resource: 'lollipops' })
          if (result.fired && result.revealKey) {
            session.dispatch(() => result.state)
            logText(tk(result.revealKey as GameTextKey))
          } else {
            notify('You curl up in the leaf. It is just a leaf. (Try holding exactly one lollipop.)')
          }
        }),
      )
    }
    screen.appendChild(button('back to the map', 'garden-to-map', () => showMap()))
  }

  // The quest screens (the forest, the beanstalk climb, the mine-gate fight + the sugar-mines
  // descent) live in a sub-module to keep this file lean; they receive this host's DOM + session
  // + the status-bar HP signals + helpers, and self-manage their step interval/arena via onScreen.
  const quests: QuestScreens = createQuestScreens({
    doc,
    screen,
    session,
    metrics: FALLBACK_METRICS,
    hp,
    maxHp,
    maxHpOf,
    button,
    notify,
    log,
    logText,
    clearScreen,
    showMap,
    onScreen,
  })

  // The town screens (the village hub + the forge) live in a sub-module to keep this file lean;
  // they receive this host's DOM + session + helpers and route clicks back through showMap.
  const town: TownScreens = createTownScreens({
    doc,
    screen,
    session,
    clearScreen,
    button,
    notify,
    logText,
    showMap,
    startCellar: quests.startCellar,
  })

  // The sky screens (Act 1 — the cumulus commons at the top of the beanstalk) live in a sub-module
  // like the town screens; same thin-wiring contract, routed back through showMap.
  const sky: SkyScreens = createSkyScreens({
    doc,
    screen,
    session,
    clearScreen,
    button,
    notify,
    logText,
    showMap,
  })

  // The moon screens (Act 1 — the jawbreaker moon, reached by the balloon). Same thin-wiring
  // contract; strata mining + pick upgrades live in the tested engine, routed back through showMap.
  const moon: MoonScreens = createMoonScreens({
    doc,
    screen,
    session,
    clearScreen,
    button,
    notify,
    logText,
    showMap,
    startMoonWorm: quests.startMoonWorm,
    // The sky port lives on its own screen; cross to it from the moon's far side (a thunk because
    // skyport is created just below — it is only read at click time, by which point it is assigned).
    showSkyPort: () => skyport.showSkyPort(),
  })

  // The sky-port screens (Act 2 — the shipwright's commission for the candied galleon, on the moon's
  // far side). Same thin-wiring contract; the commission ledger + naming live in the tested engine
  // (engine/content/galleonCommission), routed back through showMoon / showMap.
  const skyport: SkyPortScreens = createSkyPortScreens({
    doc,
    screen,
    session,
    clearScreen,
    button,
    notify,
    logText,
    showMap,
    showMoon: moon.showMoon,
    // The reef is its own screen, reached by setting sail (a thunk: reef is created just below).
    showReef: () => reef.showReef(),
    // The comet is its own screen, reached once the reef has been sailed (a thunk: comet is below).
    showComet: () => comet.showComet(),
    // Sourbeard's duel is its own screen, likewise reached after the reef (a thunk: created below).
    showSourbeard: () => sourbeard.showSourbeard(),
    // The sour planet is its own screen, likewise reached after the reef (a thunk: created below).
    showSourPlanet: () => sourPlanet.showSourPlanet(),
    // The mint planet is its own screen, likewise reached after the reef (a thunk: created below).
    showMintPlanet: () => mintPlanet.showMintPlanet(),
    // The dyson scaffold is its own screen, reached once the Act-2 gate is cleared (a thunk: the
    // scaffold is created just below — read only at click time, by which point it is assigned).
    showScaffold: () => scaffold.showScaffold(),
  })

  // The reef screens (Act 2 — the first voyage: plot a course out to the rock candy reef, then break
  // its asteroids for rock candy). Same thin-wiring contract; the crossing + harvest live in the
  // tested engine (engine/content/reefVoyage + reef), routed back through showSkyPort / showMap.
  const reef: ReefScreens = createReefScreens({
    doc,
    screen,
    session,
    clearScreen,
    button,
    notify,
    logText,
    showMap,
    showSkyPort: skyport.showSkyPort,
  })

  // The comet screens (Act 2 — "the comet passes": the lead-the-target harpoon for pop rocks). Same
  // thin-wiring contract; the chase sim + once-per-pass cooldown live in the tested engine
  // (engine/content/cometChase), routed back through showSkyPort / showMap.
  const comet: CometScreens = createCometScreens({
    doc,
    screen,
    session,
    clearScreen,
    button,
    notify,
    logText,
    showMap,
    showSkyPort: skyport.showSkyPort,
    // Ride-the-comet fast-travel (Act 2 — §175) drops you at a far stratum. Thunks: sourPlanet/mintPlanet
    // are created just below; read only at click time, by which point they are assigned.
    showReef: () => reef.showReef(),
    showSourPlanet: () => sourPlanet.showSourPlanet(),
    showMintPlanet: () => mintPlanet.showMintPlanet(),
  })

  // The Sourbeard duel screen (Act 2 — quest 8: the broadside duel that reads the yard's hull/cannon/sail
  // tiers). Same thin-wiring contract; the deterministic turn-based duel lives in the tested engine
  // (engine/content/shipDuel), routed back through showSkyPort / showMap.
  const sourbeard: SourbeardScreens = createSourbeardScreens({
    doc,
    screen,
    session,
    clearScreen,
    button,
    notify,
    logText,
    showMap,
    showSkyPort: skyport.showSkyPort,
  })

  // The sour-planet screen (Act 2 — quest 9: the gummy folk teach flavor fusion + trade sour essence).
  // Same thin-wiring contract; the fusion-learning + trade live in the tested engine
  // (engine/content/sourPlanet), and the fusing itself happens at the moon's gummy vat. Routed back
  // through showSkyPort / showMap.
  const sourPlanet: SourPlanetScreens = createSourPlanetScreens({
    doc,
    screen,
    session,
    clearScreen,
    button,
    notify,
    logText,
    showMap,
    showSkyPort: skyport.showSkyPort,
    // The kraken is its own screen, descended into from the sour planet (a thunk: created just below).
    showKraken: () => kraken.showKraken(),
  })

  // The sour-kraken screen (Act 2 — an optional tail: the telegraph-and-sever fight that reads the equipped
  // hand weapon, deep in the sour gas). Same thin-wiring contract; the deterministic turn fight lives in the
  // tested engine (engine/content/krakenFight). Routed back up to the sour planet you descended from.
  const kraken: KrakenScreens = createKrakenScreens({
    doc,
    screen,
    session,
    clearScreen,
    button,
    notify,
    logText,
    showSourPlanet: sourPlanet.showSourPlanet,
  })

  // The mint-planet screen (Act 2 — quest 10, the act capstone: the ice labyrinth, the frost wyrm, and
  // peppermint mining toward the §184 gate). Same thin-wiring contract; the labyrinth / wyrm / condensers
  // / act gate live in the tested engine (engine/content/mintPlanet + actGate). Routed back through
  // showSkyPort / showMap.
  const mintPlanet: MintPlanetScreens = createMintPlanetScreens({
    doc,
    screen,
    session,
    clearScreen,
    button,
    notify,
    logText,
    showMap,
    showSkyPort: skyport.showSkyPort,
  })

  // The dyson-scaffold screen (Act 3 — reach the sun: the 5-stage build machine over the sun's ASCII).
  // Same thin-wiring contract; the stage machine + the reach gate (act2GateCleared) + the sun-art
  // assembler live in the tested engine (engine/content/dysonScaffold). Routed back through showSkyPort /
  // showMap. First arrival sets sunReached (reveal-only), surfacing the 'sun' overworld region.
  const scaffold: ScaffoldScreens = createScaffoldScreens({
    doc,
    screen,
    session,
    clearScreen,
    button,
    notify,
    logText,
    showMap,
    showSkyPort: skyport.showSkyPort,
    // The descent port is its own (finale) screen, reached from the scaffold once the bathysphere is
    // built (a thunk: finale is created just below — read only at click time, by which point assigned).
    showDescentPort: () => finale.showDescentPort(),
  })

  // The game's ONLY audio glue (Act 4 — §194): the descent cue. Test-safe (feature-detected, lazy on the
  // user gesture, never constructed at load), coverage-excluded. Created here, held by the finale screens.
  const descentAudio = createDescentAudio()

  // The finale screens (Act 4 — the photosphere descent port + the one cue). Same thin-wiring contract;
  // the reach gate (descentPortAvailable = act3GateCleared), the cue decision, and the fire-once latch live
  // in the tested engine (engine/content/photosphere). Routed back through showScaffold / showMap.
  const finale: FinaleScreens = createFinaleScreens({
    doc,
    screen,
    session,
    descentAudio,
    clearScreen,
    button,
    notify,
    logText,
    showMap,
    showScaffold: scaffold.showScaffold,
    // The choice / ending screen is the next slice (4.5); the star-eater win's onward hook routes there.
    // Until that screen exists, the hook lands the player back at the scaffold — the win has already
    // committed starEaterDefeated, so re-entry shows the aftermath, ready for 4.5 to wire the real choice in.
    showChoice: () => scaffold.showScaffold(),
  })

  // --- driver + lifecycle wiring ------------------------------------------

  const initialSpeed = import.meta.env.DEV
    ? parseSpeedParam(doc.defaultView?.location.search ?? '')
    : MIN_SPEED
  const driver = createLoopDriver((dt) => session.advance(dt), {
    clock: browserClock,
    stepMs: STEP_MS,
    initialSpeed,
  })

  let devPanel: DevPanel | null = null
  if (import.meta.env.DEV) {
    devPanel = createDevPanel(mainRoot, {
      initialSpeed: driver.getSpeed(),
      onSpeed: (speed) => driver.setSpeed(speed),
      onReset: () => {
        offLifecycle()
        driver.stop()
        doc.defaultView?.localStorage.clear()
        doc.defaultView?.location.reload()
      },
    })
  }

  const offLifecycle = wireLifecycleEvents({
    doc,
    onHidden: () => session.onHidden(),
    onVisible: () => session.onVisible(),
    onAutosave: () => session.save(),
    autosaveIntervalMs: 30_000,
    onFirstInteraction: () => void requestPersistence(),
  })

  if (wasDiscarded(doc)) logText('Welcome back. The tab was reclaimed; your progress is intact.')

  // First screen: a warm start with a map drops you on it; otherwise the field (or the cold open).
  const flags = session.getState().flags
  if (flags[MAP_UNLOCKED_FLAG] === true) showMap()
  else if (flags['openerSeen'] === true) showField()
  else showOpener()
  driver.start()

  // A tiny test hook so Playwright can drive deterministic flows without scraping internals.
  ;(doc.defaultView as (Window & { __cb3?: unknown }) | null)!.__cb3 = {
    session,
    showMap,
    showField,
    showGarden,
    showInventory,
    showVillage: town.showVillage,
    showForge: town.showForge,
    showShop: town.showShop,
    showObservatory: town.showObservatory,
    showCauldron: town.showCauldron,
    showTavern: town.showTavern,
    showCloudCommons: sky.showCloudCommons,
    showMoon: moon.showMoon,
    showSkyPort: skyport.showSkyPort,
    showReef: reef.showReef,
    showComet: comet.showComet,
    showScaffold: scaffold.showScaffold,
    showDescentPort: finale.showDescentPort,
    showCaramelCore: finale.showCaramelCore,
    showStarEater: finale.showStarEater,
    showFinale: finale.showFinale,
    startClimb: quests.startClimb,
    startStormFront: quests.startStormFront,
    startForest: quests.startForest,
    startMineGate: quests.startMineGate,
    startMines: quests.startMines,
    startMountain: quests.startMountain,
    startCellar: quests.startCellar,
    startMoonWorm: quests.startMoonWorm,
    armSeed,
    log: logText,
  }

  return {
    session,
    destroy() {
      driver.stop()
      offLifecycle()
      offState()
      for (const d of topDisposers) d()
      healthBar.dispose()
      bar.dispose()
      hotkeys.dispose()
      devPanel?.dispose()
      clearScreen()
      if (toastTimer) clearTimeout(toastTimer)
      toast.remove()
      eventLog.dispose()
      screen.remove()
    },
  }
}

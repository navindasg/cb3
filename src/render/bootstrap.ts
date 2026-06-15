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
import { createQuestHost } from '@/engine/quest/questHost'
import { VerticalDriver } from '@/engine/quest/physics/VerticalDriver'
import { HorizontalDriver } from '@/engine/quest/physics/HorizontalDriver'
import { nearestHostileDistance } from '@/engine/quest/combat'
import { createEntityFactory } from '@/engine/content/entityFactory'
import { spellAbilities } from '@/engine/content/spells'
import { applyQuestWin } from '@/engine/quest/questRewards'
import { CANDY_PRODUCERS } from '@/content/producers/candy'
import { ACT0_OVERWORLD } from '@/content/overworld'
import { TEMPLATE_MAP } from '@/content/quests/entityTemplates'
import { GRIMOIRE_SPELLS } from '@/content/spells/grimoire'
import { BEANSTALK_CLIMB } from '@/content/quests/beanstalkClimb'
import { FOREST_QUEST, FOREST_GOAL } from '@/content/quests/forest'
import { playerQuestWeapons } from '@/content/items/playerLoadout'
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
import { createArenaRenderer, type ArenaRenderer } from '@/render/ArenaRenderer'
import { BEANSTALK_BACKDROP } from '@/render/arenaBackdrop'
import { toArenaModel } from '@/engine/content/arenaView'
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

const STEP_MS = 100
const FALLBACK_METRICS: CellMetrics = { cellW: 9, cellH: 19.2 }
const tk = (key: GameTextKey): string => t(key)

/** The derived max HP currently in effect (the live cache, or recomputed from lifetime). */
function maxHpOf(s: ReturnType<GameSession['getState']>): number {
  return s.numbers[MAX_HP_KEY] ?? derivedMaxHp(s.lifetimeCandiesEaten)
}

// The forest arena backdrop (drawn UNDER the entities): a sparse treeline up top and a ground
// line along the bottom row, so the @ and the gummy critters walk a path rather than a void.
const FOREST_BACKDROP: readonly string[] = [
  '     ^          ^             ^             ^           ^',
  '    /=\\        /=\\           /=\\           /=\\         /=\\',
  '     |          |             |             |           |',
  '',
  '',
  '',
  '',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
]

export interface BootstrapHandles {
  readonly session: GameSession
  destroy(): void
}

/** Wire the whole game into `statusRoot` + `mainRoot`. Returns handles for teardown/tests. */
export function bootstrap(statusRoot: HTMLElement, mainRoot: HTMLElement): BootstrapHandles {
  const doc = statusRoot.ownerDocument
  const session = createGameSession({
    producers: CANDY_PRODUCERS,
    onEvents: (events) => events.forEach((e) => log(e as GameTextKey)),
  })

  // Reduced-motion gate on the whole content root (kills the glow pulse + comet/sun motion).
  applyReducedMotion(mainRoot)

  // --- reactive status bar: candy + HP, each gated by its progressive-unlock flag ----------
  const initial = session.getState()
  const candy = signal(initial.candies.current)
  const hp = signal(initial.playerHpCurrent)
  const maxHp = signal(maxHpOf(initial))
  const statusBarUnlocked = signal(initial.flags[STATUS_BAR_UNLOCKED_FLAG] === true)
  const healthBarUnlocked = signal(initial.flags[HEALTH_BAR_UNLOCKED_FLAG] === true)

  const bar: StatusBar = createStatusBar(statusRoot, [
    { id: 'candy', label: 'candies: ', source: candy, visible: statusBarUnlocked },
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
    hp.set(s.playerHpCurrent)
    maxHp.set(maxHpOf(s))
    statusBarUnlocked.set(s.flags[STATUS_BAR_UNLOCKED_FLAG] === true)
    healthBarUnlocked.set(s.flags[HEALTH_BAR_UNLOCKED_FLAG] === true)
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
  let arena: ArenaRenderer | null = null
  let questCleanup: (() => void) | null = null
  // Screen-scoped teardown (effects, subscriptions) cleared on every screen switch.
  const screenDisposers: Array<() => void> = []
  const onScreen = (dispose: () => void): void => void screenDisposers.push(dispose)

  function clearScreen(): void {
    if (questCleanup) {
      questCleanup()
      questCleanup = null
    }
    for (const d of screenDisposers.splice(0)) d()
    hotkeys.clearBindings()
    if (map) {
      map.unmount()
      map = null
    }
    if (arena) {
      arena.unmount()
      arena = null
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

    let signature = ' ' // force the first build

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
  }

  function routeZone(action: string): void {
    const { kind, target } = parseAction(action)
    if (kind === 'enter' && target === 'field') return showField()
    if (kind === 'enter' && target === 'beanstalkGarden') return showGarden()
    if (kind === 'quest' && target === 'forest') return startForest()
    if (kind === 'quest' && target === 'beanstalkClimb') return startClimb()
    // Everything else is wired in the next build steps (forest/village/mines/mountain quests +
    // screens). Until then a click responds VISIBLY so a location never feels dead.
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
          showGarden()
        }),
      )
      const fed = session.getState().numbers['beanstalkCandiesFed'] ?? 0
      const fedLine = doc.createElement('p')
      fedLine.setAttribute('data-testid', 'fed-total')
      fedLine.textContent = `fed: ${fed}`
      screen.appendChild(fedLine)
    }
    screen.appendChild(button('back to the map', 'garden-to-map', () => showMap()))
  }

  // --- the beanstalk climb (the vertical quest) ---------------------------

  function startClimb(): void {
    clearScreen()
    const driver = new VerticalDriver({
      gravityY: 0.6,
      climbSpeed: 9,
      gustPeriodMs: 2000,
      gustStrength: 1,
      inversionVolumes: [],
    })
    const host = createQuestHost({
      def: BEANSTALK_CLIMB,
      driver,
      entityFactory: createEntityFactory(TEMPLATE_MAP),
      playerAbilities: spellAbilities(GRIMOIRE_SPELLS, session.getState()),
    })

    const hud = doc.createElement('p')
    hud.setAttribute('data-testid', 'climb-status')
    hud.className = 'climb-hud'
    hud.textContent = 'climbing the beanstalk…'
    screen.appendChild(hud)

    arena = createArenaRenderer(screen, { metrics: FALLBACK_METRICS })

    const controls = doc.createElement('div')
    controls.className = 'climb-controls'
    screen.appendChild(controls)

    let boost = false
    let boostTicks = 0
    const climbBtn = button('▲ climb', 'climb-up', () => {
      boostTicks = 5
    })
    climbBtn.addEventListener('pointerdown', () => {
      boost = true
    })
    const release = (): void => {
      boost = false
    }
    climbBtn.addEventListener('pointerup', release)
    climbBtn.addEventListener('pointerleave', release)
    controls.appendChild(climbBtn)
    controls.appendChild(button('leave', 'climb-leave', () => showMap()))

    const GOAL = 40
    let finished = false

    const paint = (): void => {
      const scene = host.scene()
      arena?.render({ ...toArenaModel(scene, TEMPLATE_MAP), background: BEANSTALK_BACKDROP })
      if (scene.phase === 'won') {
        if (!finished) {
          finished = true
          hud.textContent = 'reached the top'
          session.dispatch((s) => applyQuestWin(s, BEANSTALK_CLIMB))
          log('beanstalk.elevatorReady')
          controls.replaceChildren(button('back to the map', 'climb-done', () => showMap()))
          stop()
        }
        return
      }
      hud.textContent = `climbing the beanstalk — ${Math.min(GOAL, Math.round(scene.scroll))} / ${GOAL}`
    }

    const interval = setInterval(() => {
      const fast = boost || boostTicks > 0
      if (boostTicks > 0) boostTicks--
      for (let i = 0; i < (fast ? 2 : 1); i++) {
        host.step({ playerInput: { moveX: 0, moveY: 1, jump: false } }, STEP_MS)
      }
      paint()
    }, STEP_MS)
    function stop(): void {
      clearInterval(interval)
    }
    questCleanup = stop
    paint()
  }

  // --- the forest (the first HorizontalDriver combat quest) ---------------

  function startForest(): void {
    clearScreen()
    const startState = session.getState()
    // The quest's player HP floor is overridden by the player's eaten-candy-derived max HP, so
    // eating candies before the fight genuinely matters.
    const def = { ...FOREST_QUEST, playerMaxHp: maxHpOf(startState) }
    const driver = new HorizontalDriver({ gravityY: 30, moveSpeed: 7, jumpVelocity: 14 })
    const host = createQuestHost({
      def,
      driver,
      entityFactory: createEntityFactory(TEMPLATE_MAP),
      playerAbilities: spellAbilities(GRIMOIRE_SPELLS, startState),
      playerWeapons: playerQuestWeapons(startState),
    })

    const hud = doc.createElement('p')
    hud.setAttribute('data-testid', 'forest-status')
    hud.className = 'climb-hud'
    hud.textContent = 'into the forest…'
    screen.appendChild(hud)

    arena = createArenaRenderer(screen, { metrics: FALLBACK_METRICS })

    const controls = doc.createElement('div')
    controls.className = 'climb-controls'
    screen.appendChild(controls)

    // The march east is hands-free (you auto-advance and auto-swing); holding — or mashing —
    // ▶ hurry doubles the pace, the same agency the climb gives.
    let boost = false
    let boostTicks = 0
    const hurry = button('▶ hurry', 'forest-hurry', () => {
      boostTicks = 5
    })
    hurry.addEventListener('pointerdown', () => {
      boost = true
    })
    const release = (): void => {
      boost = false
    }
    hurry.addEventListener('pointerup', release)
    hurry.addEventListener('pointerleave', release)
    controls.appendChild(hurry)
    controls.appendChild(button('retreat', 'forest-leave', () => showMap()))

    let finished = false

    const paint = (): void => {
      const scene = host.scene()
      arena?.render({ ...toArenaModel(scene, TEMPLATE_MAP), background: FOREST_BACKDROP })
      if (scene.phase === 'won') {
        if (!finished) {
          finished = true
          hud.textContent = 'the forest is clear'
          session.dispatch((s) => applyQuestWin(s, def))
          notify('The forest is clear. The village lies to the east.')
          controls.replaceChildren(button('back to the map', 'forest-done', () => showMap()))
          stop()
        }
        return
      }
      const player = scene.player
      // Drive the status-bar health bar from the LIVE quest HP while fighting.
      if (player) {
        hp.set(player.hp)
        maxHp.set(player.maxHp)
      }
      const curHp = player ? Math.max(0, Math.round(player.hp)) : 0
      const maxV = player ? player.maxHp : 0
      hud.textContent = `into the forest — ${Math.min(FOREST_GOAL, Math.round(scene.scroll))} / ${FOREST_GOAL}   hp ${curHp}/${maxV}`
      // A respawn (death) raises lastDeath for exactly one frame — surface its line once.
      if (scene.lastDeath) log(scene.lastDeath.message as GameTextKey)
    }

    const interval = setInterval(() => {
      const scene = host.scene()
      const player = scene.player
      const reach = player ? player.weapons.reduce((m, w) => Math.max(m, w.range), 0) : 0
      const dist = player ? nearestHostileDistance(player, scene.entities) : Infinity
      // Advance east, but HOLD to fight when a critter is within weapon reach (then resume).
      const moveX = dist <= reach ? 0 : 1
      const fast = boost || boostTicks > 0
      if (boostTicks > 0) boostTicks--
      for (let i = 0; i < (fast ? 2 : 1); i++) {
        host.step({ playerInput: { moveX, moveY: 0, jump: false } }, STEP_MS)
      }
      paint()
    }, STEP_MS)
    function stop(): void {
      clearInterval(interval)
    }
    questCleanup = stop
    paint()
  }

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
    startClimb,
    startForest,
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

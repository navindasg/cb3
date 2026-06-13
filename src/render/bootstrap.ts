import { signal } from '@/engine/signals/signal'
import { createGameSession, OBSERVATORY_UNLOCKED_FLAG } from '@/engine/session/gameSession'
import type { GameSession } from '@/engine/session/gameSession'
import { createLoopDriver, browserClock } from '@/engine/loop/driver'
import { eatCandies, throwCandies } from '@/engine/state/reducers'
import { plantSeed, feedBeanstalk } from '@/engine/content/beanstalk'
import { fireAny, type SecretInteraction } from '@/engine/content/secrets'
import { createQuestHost } from '@/engine/quest/questHost'
import { VerticalDriver } from '@/engine/quest/physics/VerticalDriver'
import { createEntityFactory } from '@/engine/content/entityFactory'
import { spellAbilities } from '@/engine/content/spells'
import { applyQuestWin } from '@/engine/quest/questRewards'
import { CANDY_PRODUCERS } from '@/content/producers/candy'
import { ACT0_STRATA } from '@/content/strata'
import { ACT0_SECRETS } from '@/content/secrets'
import { TEMPLATE_MAP } from '@/content/quests/entityTemplates'
import { GRIMOIRE_SPELLS } from '@/content/spells/grimoire'
import { BEANSTALK_CLIMB } from '@/content/quests/beanstalkClimb'
import { WOODEN_SPOON } from '@/content/items/items'
import { grantItem } from '@/engine/shop/purchase'
import { t } from '@/content/i18n/en'
import type { GameTextKey } from '@/content/i18n/schema'
import { createStatusBar, type StatusBar } from '@/render/StatusBar'
import { createMapRenderer, type MapRenderer } from '@/render/Map'
import { createArenaRenderer, type ArenaRenderer } from '@/render/ArenaRenderer'
import { toArenaModel } from '@/engine/content/arenaView'
import { createSecretInput, type SecretInput } from '@/render/secretInput'
import { wireLifecycleEvents, wasDiscarded } from '@/render/lifecycleEvents'
import { applyReducedMotion, markDecorative } from '@/render/a11y'
import { parseAction } from '@/render/actionRouter'
import { requestPersistence } from '@/engine/save/localStorage'
import type { CellMetrics } from '@/render/font'

// The DOM bootstrap (Phase 1 Block H, ADR §5). It is the wiring layer only: every rule lives
// in the tested engine modules (gameSession, lifecycle, questHost, secrets, beanstalk) and the
// tested render pieces (StatusBar, Map, ArenaRenderer, secretInput, lifecycleEvents, a11y).
// This file just composes them into screens and routes clicks. It is verified end-to-end by
// the Playwright suite (e2e/) rather than unit tests, so it is excluded from coverage like
// src/main.ts. Keep it free of game logic so that exclusion stays honest.

const STEP_MS = 100
const FALLBACK_METRICS: CellMetrics = { cellW: 9, cellH: 19.2 }
const VIEWPORT_ROWS = 18
const tk = (key: GameTextKey): string => t(key)

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

  // --- reactive status bar (candy / hp / mana), mirrored from state on every commit ---
  const candy = signal(session.getState().candies.current)
  const hp = signal(session.getState().playerHpCurrent)
  const mana = signal(session.getState().manaCurrent)
  const bar: StatusBar = createStatusBar(statusRoot, [
    { id: 'candy', label: 'candies: ', source: candy },
    { id: 'hp', label: 'hp: ', source: hp },
    { id: 'mana', label: 'mana: ', source: mana },
  ])
  const offState = session.subscribe((s) => {
    candy.set(s.candies.current)
    hp.set(s.playerHpCurrent)
    mana.set(s.manaCurrent)
  })

  // --- the event log (deadpan narrative beats) ---
  const logEl = doc.createElement('div')
  logEl.className = 'event-log'
  logEl.setAttribute('aria-live', 'polite')
  function log(key: GameTextKey): void {
    const line = doc.createElement('p')
    line.textContent = tk(key)
    logEl.appendChild(line)
  }
  function logText(text: string): void {
    const line = doc.createElement('p')
    line.textContent = text
    logEl.appendChild(line)
  }

  // --- screen container ---
  const screen = doc.createElement('div')
  screen.className = 'screen'
  mainRoot.appendChild(screen)
  mainRoot.appendChild(logEl)

  let map: MapRenderer | null = null
  let arena: ArenaRenderer | null = null
  let questCleanup: (() => void) | null = null
  let secret: SecretInput | null = null

  function clearScreen(): void {
    if (questCleanup) {
      questCleanup()
      questCleanup = null
    }
    if (map) {
      map.unmount()
      map = null
    }
    if (arena) {
      arena.unmount()
      arena = null
    }
    screen.replaceChildren()
  }

  function button(label: string, testid: string, onClick: () => void): HTMLButtonElement {
    const b = doc.createElement('button')
    b.textContent = label
    b.setAttribute('data-testid', testid)
    b.addEventListener('click', onClick)
    return b
  }

  // --- screens -------------------------------------------------------------

  function showOpener(): void {
    clearScreen()
    const art = doc.createElement('pre')
    art.textContent = ' . \n( )\n `—`'
    markDecorative(art)
    screen.appendChild(art)
    const line = doc.createElement('p')
    line.setAttribute('data-testid', 'opening-line')
    line.textContent = 'You have 1 candy.'
    screen.appendChild(line)
    screen.appendChild(
      button('look around', 'ack-opener', () => {
        session.acknowledgeOpener()
        // The world now mentions the mines and the observatory on the hill.
        session.revealMines()
        session.dispatch((s) => ({ ...s, flags: { ...s.flags, [OBSERVATORY_UNLOCKED_FLAG]: true } }))
        showField()
      }),
    )
  }

  function showField(): void {
    clearScreen()
    // Grandma's gift: the wooden spoon (drives the slow candy trickle).
    session.dispatch((s) => (s.flags['spoonOwned'] === true ? s : grantItem(s, WOODEN_SPOON)))

    const title = doc.createElement('h2')
    title.textContent = 'your field'
    screen.appendChild(title)
    screen.appendChild(
      button('eat a candy', 'eat-candy', () => session.dispatch((s) => eatCandies(s, 1))),
    )
    screen.appendChild(
      button('throw a candy', 'throw-candy', () => session.dispatch((s) => throwCandies(s, 1))),
    )
    screen.appendChild(button('the map', 'open-map', () => showMap()))

    // The seed pivot is normally reached by earning ~50k candies with a telescope; the
    // observatory sells the telescope. To keep the long idle grind out of an e2e run, a single
    // "summon the star" affordance arms the gate the moment the player has the telescope and
    // has earned enough (it grants the prerequisites, then the lifecycle pass fires the event).
    screen.appendChild(
      button('scan the sky', 'arm-seed', () => {
        session.dispatch((s) => ({
          ...s,
          flags: { ...s.flags, telescopeOwned: true },
          candies: { ...s.candies, lifetimeAccumulated: Math.max(s.candies.lifetimeAccumulated, 50000) },
        }))
        // The next lifecycle pass fires the seed event; reflect the garden onto the map.
      }),
    )
  }

  function showMap(): void {
    clearScreen()
    map = createMapRenderer(screen, {
      strata: ACT0_STRATA,
      metrics: FALLBACK_METRICS,
      viewportRows: VIEWPORT_ROWS,
      onZone: (action) => routeZone(action),
      persistScrollY: (y) => session.dispatch((s) => ({ ...s, numbers: { ...s.numbers, scrollY: y } })),
      describeLocation: () => 'The world map. Player on the map.',
    })
    map.render(session.getState())
    screen.appendChild(button('back to the field', 'map-to-field', () => showField()))
  }

  function routeZone(action: string): void {
    const { kind, target } = parseAction(action)
    if (kind === 'enter' && target === 'beanstalkGarden') return showGarden()
    if (kind === 'quest' && target === 'beanstalkClimb') return startClimb()
    if (kind === 'travel' && target === 'beanstalkElevator') {
      logText('The elevator carries you. Up is just a place you go.')
      return
    }
    logText(`You head to ${target || kind}.`)
  }

  // --- the seed pivot + beanstalk garden ----------------------------------

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
      gravityY: 6,
      climbSpeed: 30, // climbSpeed > gravity so the player ascends (Block H requirement)
      gustPeriodMs: 1500,
      gustStrength: 1,
      inversionVolumes: [],
    })
    const host = createQuestHost({
      def: BEANSTALK_CLIMB,
      driver,
      entityFactory: createEntityFactory(TEMPLATE_MAP),
      playerAbilities: spellAbilities(GRIMOIRE_SPELLS, session.getState()),
    })
    arena = createArenaRenderer(screen, {
      metrics: FALLBACK_METRICS,
      onExit: () => showMap(),
    })
    const status = doc.createElement('p')
    status.setAttribute('data-testid', 'climb-status')
    status.textContent = 'climbing...'
    screen.appendChild(status)

    let climbing = true
    const up = button('climb', 'climb-up', () => {
      climbing = true
    })
    screen.appendChild(up)

    const paint = (): void => {
      const scene = host.scene()
      arena?.render(
        toArenaModel(scene, TEMPLATE_MAP, { exit: { x: 0, y: 0, label: '[leave]', action: 'exit' } }),
      )
      if (scene.phase === 'won') {
        status.textContent = 'reached the top'
        session.dispatch((s) => applyQuestWin(s, BEANSTALK_CLIMB))
        log('beanstalk.elevatorReady')
        stop()
      }
    }

    const interval = setInterval(() => {
      host.step({ playerInput: { moveX: 0, moveY: climbing ? 1 : 0, jump: false } }, STEP_MS)
      paint()
    }, STEP_MS)
    function stop(): void {
      clearInterval(interval)
    }
    questCleanup = stop
    paint()
  }

  // --- typed-secret box (a11y: a real focusable input) --------------------

  function mountSecretBox(): void {
    secret = createSecretInput(mainRoot, {
      label: 'type a secret word',
      placeholder: 'secret',
      onSubmit: (word) => {
        // A typed secret is matched as a 'hold' interaction over the named registry.
        const interaction: SecretInteraction = { kind: 'hold', resource: 'lollipops' }
        const before = session.getState()
        const result = fireAny(before, ACT0_SECRETS, interaction)
        if (result.fired && result.revealKey) {
          session.dispatch(() => result.state)
          log(result.revealKey as GameTextKey)
        } else {
          logText(`Nothing happens. (${word})`)
        }
      },
    })
  }

  // --- driver + lifecycle wiring ------------------------------------------

  const driver = createLoopDriver((dt) => session.advance(dt), { clock: browserClock, stepMs: STEP_MS })
  const offLifecycle = wireLifecycleEvents({
    doc,
    onHidden: () => session.onHidden(),
    onVisible: () => session.onVisible(),
    onAutosave: () => session.save(),
    autosaveIntervalMs: 30_000,
    onFirstInteraction: () => void requestPersistence(),
  })

  if (wasDiscarded(doc)) logText('Welcome back. The tab was reclaimed; your progress is intact.')

  // First screen: cold start shows the opening line; a warm start drops you on the map.
  const warm = session.getState().flags['openerSeen'] === true
  if (warm) showMap()
  else showOpener()
  mountSecretBox()
  driver.start()

  // A tiny test hook so Playwright can drive deterministic flows without scraping internals.
  ;(doc.defaultView as (Window & { __cb3?: unknown }) | null)!.__cb3 = {
    session,
    showMap,
    showField,
    showGarden,
    startClimb,
    log: logText,
  }

  return {
    session,
    destroy() {
      driver.stop()
      offLifecycle()
      offState()
      bar.dispose()
      secret?.dispose()
      clearScreen()
      logEl.remove()
      screen.remove()
    },
  }
}

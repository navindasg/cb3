import type { GameSession } from '@/engine/session/gameSession'
import type { GameState } from '@/engine/types/GameState'
import type { QuestDef } from '@/engine/types/defs'
import type { Signal } from '@/engine/signals/signal'
import type { CellMetrics } from '@/render/font'
import type { GameTextKey } from '@/content/i18n/schema'
import { t } from '@/content/i18n/en'
import { spendResource } from '@/engine/types/Resource'
import { createQuestHost } from '@/engine/quest/questHost'
import { VerticalDriver } from '@/engine/quest/physics/VerticalDriver'
import { HorizontalDriver } from '@/engine/quest/physics/HorizontalDriver'
import { nearestHostileDistance } from '@/engine/quest/combat'
import { createEntityFactory } from '@/engine/content/entityFactory'
import { spellAbilities } from '@/engine/content/spells'
import { applyQuestWin } from '@/engine/quest/questRewards'
import { fireAny } from '@/engine/content/secrets'
import { createArenaRenderer } from '@/render/ArenaRenderer'
import { toArenaModel } from '@/engine/content/arenaView'
import { BEANSTALK_BACKDROP, FOREST_BACKDROP, MINES_BACKDROP, MOUNTAIN_BACKDROP, CELLAR_BACKDROP } from '@/render/arenaBackdrop'
import { STEP_MS } from '@/render/loopTiming'
import { TEMPLATE_MAP } from '@/content/quests/entityTemplates'
import { GRIMOIRE_SPELLS } from '@/content/spells/grimoire'
import { BEANSTALK_CLIMB, CLIMB_HEIGHT } from '@/content/quests/beanstalkClimb'
import { FOREST_QUEST, FOREST_GOAL } from '@/content/quests/forest'
import { playerQuestWeapons } from '@/content/items/playerLoadout'
import { MINE_GATE, MINE_GATE_GOAL } from '@/content/quests/mineGate'
import { SUGAR_MINES, SUGAR_MINES_GOAL } from '@/content/quests/sugarMines'
import { MOUNTAIN, MOUNTAIN_GOAL } from '@/content/quests/mountain'
import { GUMMY_WORM_CELLAR, GUMMY_WORM_CELLAR_GOAL } from '@/content/quests/gummyWormCellar'
import { ACT0_SECRETS } from '@/content/secrets'
import { MINE_GATE_CLEARED_FLAG } from '@/content/flags'

// The quest screens — a wiring sub-module of the DOM bootstrap (extracted to keep bootstrap.ts
// thin as Act 0 grows several quests). Like bootstrap it owns NO game logic: the Scene/quest
// engine, combat, rewards and secrets all live in tested engine modules; this file only composes
// them into a screen and drives the per-step loop. It is verified end-to-end by Playwright (so it
// shares bootstrap's coverage exclusion). The horizontal quests (forest, the mine gate, the mines
// descent) share ONE generic runner that differs only by data + the win/death callbacks.

/** A tap of the ▶ hurry / ▲ climb button buys this many accelerated steps (a held press sustains). */
const TAP_BOOST_TICKS = 5
const tk = (key: string): string => t(key as GameTextKey)
const factory = createEntityFactory(TEMPLATE_MAP)

/** What a horizontal auto-march combat quest needs beyond its QuestDef. */
interface HorizontalQuestOpts {
  readonly def: QuestDef
  readonly backdrop: readonly string[]
  /** Scroll goal, for the HUD denominator. */
  readonly goal: number
  /** testid prefix for the hud/hurry/leave/done controls (e.g. 'forest'). */
  readonly idPrefix: string
  readonly hudEnter: string
  readonly hudPrefix: string
  readonly hudWon: string
  /** 'respawn' = farmable (log the death, fight on); 'eject' = one-life (a death ends the quest). */
  readonly death: 'respawn' | 'eject'
  /** Label of the bail-out button (default 'retreat'). */
  readonly leaveLabel?: string
  /** Run on victory; owns the win side-effects + the post-win controls (gets the controls row). */
  onWon(controls: HTMLElement): void
  /** Run on a death when `death === 'eject'`. */
  onEject?(): void
}

/** Everything the quest screens need from the bootstrap host (its DOM + session + helpers). */
export interface QuestContext {
  readonly doc: Document
  readonly screen: HTMLElement
  readonly session: GameSession
  readonly metrics: CellMetrics
  /** The status-bar HP signals, driven from the live scene player during a quest. */
  readonly hp: Signal<number>
  readonly maxHp: Signal<number>
  maxHpOf(state: GameState): number
  button(label: string, testid: string, onClick: () => void, accelIndex?: number): HTMLButtonElement
  notify(text: string): void
  log(key: GameTextKey): void
  logText(text: string): void
  clearScreen(): void
  showMap(): void
  /** Register a teardown run on the next screen switch (the step interval + the arena unmount). */
  onScreen(dispose: () => void): void
}

export interface QuestScreens {
  startForest(): void
  startClimb(): void
  startMineGate(): void
  startMines(): void
  startMountain(): void
  startCellar(): void
}

/** Wire the Act 0 quest screens over a bootstrap host. */
export function createQuestScreens(ctx: QuestContext): QuestScreens {
  const { doc, screen, session } = ctx

  // --- the generic horizontal auto-march combat quest (forest / mine gate / mines descent) ----

  function runHorizontal(opts: HorizontalQuestOpts): void {
    ctx.clearScreen()
    const startState = session.getState()
    // The quest's HP floor is overridden by the player's eaten-candy-derived max HP, so eating
    // candies before a fight genuinely matters; the equipped weapon + grimoire spells come along.
    const def: QuestDef = { ...opts.def, playerMaxHp: ctx.maxHpOf(startState) }
    const driver = new HorizontalDriver({ gravityY: 30, moveSpeed: 7, jumpVelocity: 14 })
    const host = createQuestHost({
      def,
      driver,
      entityFactory: factory,
      playerAbilities: spellAbilities(GRIMOIRE_SPELLS, startState),
      playerWeapons: playerQuestWeapons(startState),
    })

    const hud = doc.createElement('p')
    hud.setAttribute('data-testid', `${opts.idPrefix}-status`)
    hud.className = 'climb-hud'
    hud.textContent = opts.hudEnter
    screen.appendChild(hud)

    const arena = createArenaRenderer(screen, { metrics: ctx.metrics })

    const controls = doc.createElement('div')
    controls.className = 'climb-controls'
    screen.appendChild(controls)

    // The march is hands-free (auto-advance + auto-swing); holding ▶ hurry doubles the pace.
    let boost = false
    let boostTicks = 0
    const hurry = ctx.button('▶ hurry', `${opts.idPrefix}-hurry`, () => {
      boostTicks = TAP_BOOST_TICKS
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
    controls.appendChild(ctx.button(opts.leaveLabel ?? 'retreat', `${opts.idPrefix}-leave`, () => ctx.showMap()))

    let finished = false

    const paint = (): void => {
      const scene = host.scene()
      arena.render({ ...toArenaModel(scene, TEMPLATE_MAP), background: opts.backdrop })
      if (scene.phase === 'won') {
        if (!finished) {
          finished = true
          hud.textContent = opts.hudWon
          stop()
          opts.onWon(controls)
        }
        return
      }
      const player = scene.player
      if (player) {
        ctx.hp.set(player.hp)
        ctx.maxHp.set(player.maxHp)
      }
      const curHp = player ? Math.max(0, Math.round(player.hp)) : 0
      const maxV = player ? player.maxHp : 0
      hud.textContent = `${opts.hudPrefix} — ${Math.min(opts.goal, Math.round(scene.scroll))} / ${opts.goal}   hp ${curHp}/${maxV}`
      // A death raises lastDeath for one frame. One-life quests eject; farmable ones log + fight on.
      if (scene.lastDeath) {
        if (opts.death === 'eject') {
          if (!finished) {
            finished = true
            stop()
            opts.onEject?.()
          }
          return
        }
        ctx.log(scene.lastDeath.message as GameTextKey)
      }
    }

    const interval = setInterval(() => {
      if (finished) return
      const scene = host.scene()
      const player = scene.player
      const reach = player ? player.weapons.reduce((m, w) => Math.max(m, w.range), 0) : 0
      const dist = player ? nearestHostileDistance(player, scene.entities) : Infinity
      // Advance east, but HOLD to fight when a foe is within weapon reach (then resume). This is
      // also the gate: you cannot walk past a living blocker, so a too-strong foe stops you cold.
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
    ctx.onScreen(() => {
      clearInterval(interval)
      arena.unmount()
    })
    paint()
  }

  // --- the forest (Quest 1) -----------------------------------------------------------------

  function startForest(): void {
    runHorizontal({
      def: FOREST_QUEST,
      backdrop: FOREST_BACKDROP,
      goal: FOREST_GOAL,
      idPrefix: 'forest',
      hudEnter: 'into the forest…',
      hudPrefix: 'into the forest',
      hudWon: 'the forest is clear',
      death: 'respawn',
      onWon: (controls) => {
        session.dispatch((s) => applyQuestWin(s, FOREST_QUEST))
        ctx.notify('The forest is clear. The village lies to the east.')
        controls.replaceChildren(ctx.button('back to the map', 'forest-done', () => ctx.showMap()))
      },
    })
  }

  // --- the mine gate (the access fight) + the sugar-mines descent ----------------------------

  function startMineGate(): void {
    runHorizontal({
      def: MINE_GATE,
      backdrop: MINES_BACKDROP,
      goal: MINE_GATE_GOAL,
      idPrefix: 'mineGate',
      hudEnter: 'a rock-candy sentinel blocks the way…',
      hudPrefix: 'breaking through',
      hudWon: 'the sentinel shatters',
      death: 'eject',
      leaveLabel: 'back away',
      onEject: () => {
        ctx.notify('The sentinel knocks you flat — it out-reaches your swing. Come back with something longer.')
        ctx.showMap()
      },
      onWon: (controls) => {
        session.dispatch((s) => applyQuestWin(s, MINE_GATE))
        ctx.notify('The sentinel shatters into rock candy. The mines are open.')
        controls.replaceChildren(ctx.button('back to the map', 'mineGate-done', () => ctx.showMap()))
      },
    })
  }

  function startMines(): void {
    // First visit is the GATE fight; once cleared, the mines region runs the descent proper.
    if (session.getState().flags[MINE_GATE_CLEARED_FLAG] !== true) return startMineGate()
    runHorizontal({
      def: SUGAR_MINES,
      backdrop: MINES_BACKDROP,
      goal: SUGAR_MINES_GOAL,
      idPrefix: 'mines',
      hudEnter: 'into the mines…',
      hudPrefix: 'descending the mines',
      hudWon: 'you reach the fossil chamber',
      death: 'respawn',
      onWon: () => {
        session.dispatch((s) => applyQuestWin(s, SUGAR_MINES))
        showFossilChamber()
      },
    })
  }

  // --- the mountain (the climb to the observatory) ------------------------------------------

  function startMountain(): void {
    runHorizontal({
      def: MOUNTAIN,
      backdrop: MOUNTAIN_BACKDROP,
      goal: MOUNTAIN_GOAL,
      idPrefix: 'mountain',
      hudEnter: 'up the mountain…',
      hudPrefix: 'up the mountain',
      hudWon: 'you top out at the observatory',
      death: 'respawn',
      onWon: (controls) => {
        session.dispatch((s) => applyQuestWin(s, MOUNTAIN))
        ctx.notify('You top out. An observatory dome catches the last of the light.')
        controls.replaceChildren(ctx.button('back to the map', 'mountain-done', () => ctx.showMap()))
      },
    })
  }

  // --- the gummy-worm cellar (a village-house mini-quest; the CB2 rat-cellar homage) ----------

  function startCellar(): void {
    runHorizontal({
      def: GUMMY_WORM_CELLAR,
      backdrop: CELLAR_BACKDROP,
      goal: GUMMY_WORM_CELLAR_GOAL,
      idPrefix: 'cellar',
      hudEnter: 'down into the cellar…',
      hudPrefix: 'through the cellar',
      hudWon: 'the cellar is clear',
      death: 'respawn',
      onWon: (controls) => {
        session.dispatch((s) => applyQuestWin(s, GUMMY_WORM_CELLAR))
        ctx.notify('The cellar is clear. You pocket a lollipop from the shelf.')
        controls.replaceChildren(ctx.button('back to the map', 'cellar-done', () => ctx.showMap()))
      },
    })
  }

  // --- the fossil chamber (the bottom of the mines; the feed-exactly-1-candy secret) ----------

  function showFossilChamber(): void {
    ctx.clearScreen()
    const title = doc.createElement('h2')
    title.textContent = 'the fossil chamber'
    title.setAttribute('data-testid', 'fossil-chamber')
    screen.appendChild(title)

    const art = doc.createElement('pre')
    art.textContent = '   ___\n  /<>\\\n  \\___/'
    screen.appendChild(art)

    const blurb = doc.createElement('p')
    blurb.className = 'blurb'
    blurb.textContent = 'A fossil the size of a cart, half-buried in rock candy. It is very still.'
    screen.appendChild(blurb)

    screen.appendChild(ctx.button('feed it one candy', 'feed-fossil', () => feedFossil(), 0))
    screen.appendChild(ctx.button('back to the map', 'fossil-to-map', () => ctx.showMap(), 0))
  }

  function feedFossil(): void {
    const before = session.getState()
    if (before.candies.current < 1) {
      ctx.notify('you have no candy to feed it.')
      return
    }
    // Fire the secret on the live state, spend the one candy you fed it, then dispatch the result
    // (the codebase idiom: compute from getState, dispatch the precomputed state).
    const result = fireAny(before, ACT0_SECRETS, { kind: 'feed', resource: 'candies', count: 1 })
    const spent = spendResource(result.state.candies, 1)
    const next = spent ? { ...result.state, candies: spent } : result.state
    session.dispatch(() => next)
    if (result.fired && result.revealKey) ctx.logText(tk(result.revealKey))
    else ctx.notify('The fossil accepts the candy and does nothing. As fossils do.')
  }

  // --- the beanstalk climb (Quest 2, the vertical quest) -------------------------------------

  function startClimb(): void {
    ctx.clearScreen()
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
      entityFactory: factory,
      playerAbilities: spellAbilities(GRIMOIRE_SPELLS, session.getState()),
    })

    const hud = doc.createElement('p')
    hud.setAttribute('data-testid', 'climb-status')
    hud.className = 'climb-hud'
    hud.textContent = 'climbing the beanstalk…'
    screen.appendChild(hud)

    const arena = createArenaRenderer(screen, { metrics: ctx.metrics })

    const controls = doc.createElement('div')
    controls.className = 'climb-controls'
    screen.appendChild(controls)

    let boost = false
    let boostTicks = 0
    const climbBtn = ctx.button('▲ climb', 'climb-up', () => {
      boostTicks = TAP_BOOST_TICKS
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
    controls.appendChild(ctx.button('leave', 'climb-leave', () => ctx.showMap()))

    const GOAL = CLIMB_HEIGHT
    let finished = false

    const paint = (): void => {
      const scene = host.scene()
      arena.render({ ...toArenaModel(scene, TEMPLATE_MAP), background: BEANSTALK_BACKDROP })
      if (scene.phase === 'won') {
        if (!finished) {
          finished = true
          hud.textContent = 'reached the top'
          session.dispatch((s) => applyQuestWin(s, BEANSTALK_CLIMB))
          ctx.log('beanstalk.elevatorReady')
          controls.replaceChildren(ctx.button('back to the map', 'climb-done', () => ctx.showMap()))
          stop()
        }
        return
      }
      hud.textContent = `climbing the beanstalk — ${Math.min(GOAL, Math.round(scene.scroll))} / ${GOAL}`
    }

    const interval = setInterval(() => {
      if (finished) return
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
    ctx.onScreen(() => {
      clearInterval(interval)
      arena.unmount()
    })
    paint()
  }

  return { startForest, startClimb, startMineGate, startMines, startMountain, startCellar }
}

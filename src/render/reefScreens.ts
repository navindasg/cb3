import type { GameSession } from '@/engine/session/gameSession'
import type { GameState } from '@/engine/types/GameState'
import { formatCount } from '@/engine/number/format'
import { setNumber, setFlag } from '@/engine/state/reducers'
import { grantItem } from '@/engine/shop/purchase'
import { addResource, spendResource } from '@/engine/types/Resource'
import {
  plotWaypoint,
  reefReached,
  currentLeg,
  voyageLeg,
  voyageWaypoint,
} from '@/engine/content/reefVoyage'
import {
  createDrift,
  driftStep,
  fireDrift,
  driftCleared,
  respawnPlayer,
  bestFireDir,
  type DriftState,
} from '@/engine/content/driftReef'
import { answerRiddle, currentRiddle } from '@/engine/content/squirrel'
import { WAYPOINTS, VOYAGE_LEGS } from '@/content/reef/voyage'
import { SQUIRREL_RIDDLES } from '@/content/reef/squirrel'
import { ACORN_OF_KNOWLEDGE } from '@/content/items/items'
import {
  DRIFT_SEEDS,
  FIRE_DIRS,
  ASTEROID_SIZES,
  ARENA_W,
  ARENA_H,
  DRIFT_BURST_STEPS,
  DRIFT_DT,
  GUMBALLS_KEY,
  GUMBALL_CRAFT_CANDY_COST,
  GUMBALL_CRAFT_BATCH,
  type Coord,
} from '@/content/reef/driftField'
import { REEF_DRIFT_CLEARED_FLAG } from '@/content/flags'

// The rock candy reef (Act 2 — the first voyage, DESIGN §125/§178). A wiring sub-module of the DOM
// bootstrap, sibling to skyPortScreens/moonScreens: it owns NO game logic. The crossing (plot-a-
// course) and the zero-G drift combat are pure, tested engine (engine/content/reefVoyage + driftReef)
// over content config (content/reef/*); this only composes them into DOM, draws the ASCII arena, and
// routes clicks. Coverage-excluded, Playwright-verified. Two phases: plot the course out (the brass
// sextant, applied), then break the asteroid field in drift combat. Routed back through showSkyPort.
//
// The drift sim is TRANSIENT (it never persists — a run that is abandoned is forfeit, like a quest).
// Only the gumball ammo, the rock candy, and the cleared flag are persisted (in GameState). To stay
// farm-proof, the run's rock-candy haul is committed ONLY when the field is fully cleared — leaving
// mid-run banks nothing, so you cannot partial-clear / leave / re-enter to mint rock candy.

/** Display name of a waypoint by id (the field is small; a lookup is fine). */
const waypointName = (id: string): string => WAYPOINTS.find((w) => w.id === id)?.name ?? id

/** Current gumball ammo (a numbers counter; crafted from candies). */
const gumballs = (state: GameState): number => Math.max(0, Math.floor(state.numbers[GUMBALLS_KEY] ?? 0))

const driftClearedFlag = (state: GameState): boolean => state.flags[REEF_DRIFT_CLEARED_FLAG] === true

export interface ReefContext {
  readonly doc: Document
  readonly screen: HTMLElement
  readonly session: GameSession
  clearScreen(): void
  button(label: string, testid: string, onClick: () => void, accelIndex?: number): HTMLButtonElement
  notify(text: string): void
  logText(text: string): void
  /** Return to the overworld map. */
  showMap(): void
  /** Return to the sky port (the galleon's home berth). */
  showSkyPort(): void
}

export interface ReefScreens {
  showReef(): void
}

/** Wire the rock-candy-reef screen over a bootstrap host. */
export function createReefScreens(ctx: ReefContext): ReefScreens {
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

  /** Draw the toroidal arena as an ASCII grid: asteroids by size glyph, the pod as '@'. */
  function arenaText(sim: DriftState): string {
    const rows: string[][] = Array.from({ length: ARENA_H }, () => Array<string>(ARENA_W).fill(' '))
    const put = (x: number, y: number, ch: string): void => {
      const cx = ((Math.round(x) % ARENA_W) + ARENA_W) % ARENA_W
      const cy = ((Math.round(y) % ARENA_H) + ARENA_H) % ARENA_H
      rows[cy]![cx] = ch
    }
    for (const a of sim.asteroids) put(a.pos.x, a.pos.y, ASTEROID_SIZES[a.size]!.glyph)
    put(sim.player.pos.x, sim.player.pos.y, '@')
    return rows.map((r) => r.join('')).join('\n')
  }

  function showReef(): void {
    // The drift sim is transient to this visit; the haul is held until a full clear commits it.
    let sim: DriftState | null = null
    let haul = 0

    function render(): void {
      ctx.clearScreen()
      const s = session.getState()
      if (reefReached(s)) renderDrift(s)
      else renderCrossing(s)

      screen.appendChild(ctx.button('back to the sky port', 'reef-to-skyport', () => ctx.showSkyPort(), 0))
      screen.appendChild(ctx.button('back to the map', 'reef-to-map', () => ctx.showMap()))
    }

    // --- phase 1: the crossing (plot a course with the brass sextant) ---------------------------

    function renderCrossing(s: GameState): void {
      heading('the crossing', 'reef-crossing-screen')
      paragraph(
        'The candied galleon clears the moon\'s shadow and the dark opens out. You brace the brass sextant against the rail and read your bearings — you can plot this course now. Pick the leg markers in order.',
        'blurb',
        'reef-crossing-blurb',
      )

      const leg = currentLeg(s, VOYAGE_LEGS) ?? []
      const plotted = voyageWaypoint(s)
      paragraph(
        `the leg:        ${leg.map(waypointName).join(' -> ')}    (leg ${voyageLeg(s) + 1} of ${VOYAGE_LEGS.length})`,
        'blurb',
        'reef-leg',
      )
      paragraph(
        `you have plotted:  ${leg.map((id, i) => (i < plotted ? waypointName(id) : '?')).join(' -> ')}`,
        'blurb',
        'reef-plot',
      )

      for (const waypoint of WAYPOINTS) {
        screen.appendChild(ctx.button(waypoint.name, `reef-waypoint-${waypoint.id}`, () => doPlot(waypoint.id)))
      }
    }

    function doPlot(waypointId: string): void {
      const result = plotWaypoint(session.getState(), waypointId, VOYAGE_LEGS)
      if (!result.ok) return
      session.dispatch(() => result.state)
      if (!result.correct) {
        ctx.notify('The bearing drifts wide. The leg is lost — read it again from the top.')
      } else if (result.reached) {
        ctx.logText('The last marker falls into line. The reef-edge resolves out of the dark — banded, glittering, vast. You have arrived.')
      } else if (result.legComplete) {
        ctx.logText('The leg closes, marker to marker. You re-sight the sextant and lay in the next.')
      }
      render()
    }

    // --- phase 2: zero-G drift combat (the gumball cannon as weapon AND engine) ------------------

    function renderDrift(s: GameState): void {
      heading('the rock candy reef', 'reef-screen')

      if (driftClearedFlag(s)) {
        paragraph(
          'The reef drifts on, picked clean for now, its rock candy secured in the hold. With the rocks cleared, the acorn-shaped capsule that was turning out past them is finally within reach.',
          'blurb',
          'reef-harvested',
        )
        renderSquirrel(s)
        return
      }

      if (!sim) sim = createDrift(DRIFT_SEEDS)

      paragraph(
        'Zero gravity. The gumball cannon is your only engine — every shot you fire shoves the pod the opposite way. Break the asteroids; mind your drift, and mind your ammo.',
        'blurb',
        'reef-drift-blurb',
      )
      paragraph(
        `gumballs: ${gumballs(s)}    rock candy in the hold (banked when clear): ${haul}    rocks left: ${sim.asteroids.length}`,
        'blurb',
        'reef-hud',
      )

      const pre = doc.createElement('pre')
      pre.className = 'arena'
      pre.setAttribute('data-testid', 'reef-arena')
      pre.textContent = arenaText(sim)
      screen.appendChild(pre)

      // The aim hint: prose for the player, plus a machine-readable data-aim (the dir id) so the e2e
      // can follow it without parsing prose.
      const hint = bestFireDir(sim, FIRE_DIRS)
      const hintP = doc.createElement('p')
      hintP.className = 'blurb'
      hintP.setAttribute('data-testid', 'reef-hint')
      hintP.setAttribute('data-aim', hint?.id ?? '')
      hintP.textContent = hint
        ? `a rock lines up — ${hint.label}.`
        : 'no rock lined up — drift to bring one into your sights.'
      screen.appendChild(hintP)

      for (const dir of FIRE_DIRS) {
        screen.appendChild(ctx.button(dir.label, `reef-fire-${dir.id}`, () => doFire(dir.vec)))
      }
      screen.appendChild(
        ctx.button(`roll ${GUMBALL_CRAFT_BATCH} gumballs (${GUMBALL_CRAFT_CANDY_COST} candies)`, 'reef-craft', () => doCraft()),
      )
    }

    function doFire(dir: Coord): void {
      if (!sim) return
      if (gumballs(session.getState()) <= 0) {
        ctx.notify('You drift forever. A gummy alien waves politely. (You are out of gumballs — roll some more.)')
        sim = respawnPlayer(sim)
        render()
        return
      }
      session.dispatch((s) => setNumber(s, GUMBALLS_KEY, gumballs(s) - 1))

      const fired = fireDrift(sim, dir)
      sim = fired.state
      if (fired.hit) haul += fired.gained
      for (let k = 0; k < DRIFT_BURST_STEPS; k++) sim = driftStep(sim, DRIFT_DT)

      if (driftCleared(sim)) {
        session.dispatch((s) => setFlag({ ...s, rockCandy: addResource(s.rockCandy, haul) }, REEF_DRIFT_CLEARED_FLAG))
        ctx.logText(`The last asteroid breaks apart. ${formatCount(haul)} rock candy, secured in the hold.`)
      }
      render()
    }

    function doCraft(): void {
      const s = session.getState()
      if (s.candies.current < GUMBALL_CRAFT_CANDY_COST) {
        ctx.notify(`You need ${GUMBALL_CRAFT_CANDY_COST} candies to roll a batch of gumballs.`)
        return
      }
      session.dispatch((st) => {
        const spent = spendResource(st.candies, GUMBALL_CRAFT_CANDY_COST)
        if (!spent) return st
        return setNumber({ ...st, candies: spent }, GUMBALLS_KEY, gumballs(st) + GUMBALL_CRAFT_BATCH)
      })
      ctx.logText(`You roll ${GUMBALL_CRAFT_BATCH} gumballs from ${GUMBALL_CRAFT_CANDY_COST} candies.`)
      render()
    }

    // --- the space squirrel (reachable once the reef is cleared, DESIGN §178/§339) --------------

    function renderSquirrel(s: GameState): void {
      if (s.flags[ACORN_OF_KNOWLEDGE.saveFlag] === true) {
        paragraph(
          'The squirrel has gone back to watching the dark, the acorn of knowledge already yours. It does not say goodbye. You get the sense it never really says hello.',
          'blurb',
          'reef-squirrel-done',
        )
        return
      }

      paragraph(
        'A squirrel watches from inside the acorn-shaped capsule. It is not surprised to see you — only mildly let down that it took this long. "You again. Or you for the first time; hard to tell, with your kind. Riddles, then. I have nothing out here but time."',
        'blurb',
        'reef-squirrel-blurb',
      )

      const riddle = currentRiddle(s, SQUIRREL_RIDDLES)
      if (!riddle) return // guarded by the acorn flag above; the squirrel is done with you
      paragraph(riddle.prompt, 'blurb', 'reef-riddle')
      for (const opt of riddle.options) {
        screen.appendChild(ctx.button(opt.text, `reef-riddle-${opt.id}`, () => doAnswer(opt.id)))
      }
    }

    function doAnswer(choiceId: string): void {
      const result = answerRiddle(session.getState(), choiceId, SQUIRREL_RIDDLES)
      if (!result.ok) return
      if (!result.correct) {
        ctx.notify('The squirrel blinks, slowly. "No." Try another.')
        return
      }
      session.dispatch(() => result.state) // advance the riddle march
      if (result.solved) {
        const reward = result.solved.chocolateReward
        session.dispatch((st) => ({ ...st, chocolate: addResource(st.chocolate, reward) }))
        ctx.logText(`The squirrel flicks you ${formatCount(reward)} chocolate. "Hm."`)
      }
      if (result.allSolved) {
        session.dispatch((st) => grantItem(st, ACORN_OF_KNOWLEDGE))
        ctx.logText('The squirrel presses the acorn of knowledge into your hand, and is already looking past you.')
      }
      render()
    }

    render()
  }

  return { showReef }
}

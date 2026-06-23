import type { GameSession } from '@/engine/session/gameSession'
import type { GameState } from '@/engine/types/GameState'
import { formatCount } from '@/engine/number/format'
import {
  plotWaypoint,
  reefReached,
  currentLeg,
  voyageLeg,
  voyageWaypoint,
} from '@/engine/content/reefVoyage'
import {
  breakAsteroid,
  currentAsteroid,
  asteroidProgress,
  reefHarvested,
} from '@/engine/content/reef'
import { WAYPOINTS, VOYAGE_LEGS } from '@/content/reef/voyage'
import { ASTEROID_FIELD } from '@/content/reef/asteroids'

// The rock candy reef (Act 2 — the first voyage, DESIGN §178). A wiring sub-module of the DOM
// bootstrap, sibling to skyPortScreens/moonScreens: it owns NO game logic. The crossing (plot-a-
// course) and the asteroid harvest are pure, tested engine (engine/content/reefVoyage + reef) over
// content config (content/reef/*); this only composes them into DOM and routes clicks. Coverage-
// excluded, Playwright-verified. Two phases: plot the course out (the brass sextant, applied), then
// break the asteroid field for rock candy. Routed back through showSkyPort / showMap.

/** Display name of a waypoint by id (the field is small; a lookup is fine). */
const waypointName = (id: string): string => WAYPOINTS.find((w) => w.id === id)?.name ?? id

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

  function showReef(): void {
    function render(): void {
      ctx.clearScreen()
      const s = session.getState()
      if (reefReached(s)) renderHarvest(s)
      else renderCrossing(s)

      screen.appendChild(ctx.button('back to the sky port', 'reef-to-skyport', () => ctx.showSkyPort(), 0))
      screen.appendChild(ctx.button('back to the map', 'reef-to-map', () => ctx.showMap()))
    }

    /** Phase 1 — the crossing: plot the leg waypoints in order with the brass sextant (DESIGN §178). */
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

    /** Phase 2 — the harvest: break the asteroid field for rock candy (DESIGN §178/§90). */
    function renderHarvest(s: GameState): void {
      heading('the rock candy reef', 'reef-screen')
      paragraph(`rock candy: ${formatCount(s.rockCandy.current)}`, 'blurb', 'reef-resources')

      if (reefHarvested(s, ASTEROID_FIELD)) {
        paragraph(
          'The last asteroid breaks apart into drifting rock candy and the galleon\'s hold is full. The reef drifts on, picked clean for now. Further out, an acorn-shaped capsule turns slowly against the stars — something small is inside it, watching, and plainly unimpressed it took you this long. You cannot reach it yet.',
          'blurb',
          'reef-harvested',
        )
        return
      }

      paragraph(
        'The reef is a slow storm of candied rock. You bring the galleon alongside and start breaking the nearest asteroids — each one shatters into rock candy you scoop from the dark.',
        'blurb',
        'reef-harvest-blurb',
      )

      const asteroid = currentAsteroid(s, ASTEROID_FIELD)
      if (!asteroid) return // guarded by reefHarvested above; mirror the moon screen's guard-not-assert
      paragraph(
        `ahead:  ${asteroid.name}  (${asteroidProgress(s)}/${asteroid.hitsToBreak} broken, +${asteroid.yieldPerHit} rock candy a hit)`,
        'blurb',
        'reef-asteroid',
      )
      screen.appendChild(ctx.button('break it', 'reef-break', () => doBreak(), 0))
    }

    function doBreak(): void {
      const result = breakAsteroid(session.getState(), ASTEROID_FIELD)
      if (!result.ok) return
      session.dispatch(() => result.state)
      if (result.broke) {
        ctx.logText(`The asteroid cracks open — ${formatCount(result.gained)} rock candy into the hold.`)
      }
      render()
    }

    render()
  }

  return { showReef }
}

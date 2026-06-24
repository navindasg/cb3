import type { GameSession } from '@/engine/session/gameSession'
import type { GameState } from '@/engine/types/GameState'
import { formatCount } from '@/engine/number/format'
import { setNumber } from '@/engine/state/reducers'
import { addResource } from '@/engine/types/Resource'
import {
  createDuel,
  resolveManeuver,
  duelOutcome,
  sourbeardDefeats,
  sourbeardRetired,
  type DuelState,
  type Maneuver,
} from '@/engine/content/shipDuel'
import {
  RANGE_NAMES,
  MAX_DEFEATS,
  MAX_ROUNDS,
  DEFEAT_CANDY,
  DEFEAT_CHOCOLATE,
  SOURBEARD_DEFEATS_KEY,
} from '@/content/ship/shipDuel'
import {
  GALLEON_TRACKS,
  GALLEON_HULL_KEY,
  GALLEON_SAILS_KEY,
  GALLEON_CANNON_KEY,
} from '@/content/ship/galleonUpgrade'
import { trackTier } from '@/engine/content/galleonUpgrade'

// Captain Sourbeard & the Black Lollipop (Act 2 — quest 8, DESIGN §127/§179). A wiring sub-module of the
// DOM bootstrap, sibling to cometScreens/reefScreens: it owns NO game logic. The broadside duel
// (createDuel / resolveManeuver / duelOutcome) and the recurring-rival escalation live in the tested
// engine (engine/content/shipDuel) over content config (content/ship/shipDuel); this only draws the two
// ships + HP bars, routes the maneuver clicks, and commits the defeat + loot. Coverage-excluded,
// Playwright-verified. Routed back through showSkyPort.
//
// The duel is TRANSIENT (it never persists — an abandoned or lost fight is forfeit). Only the defeat
// counter (numbers.sourbeardDefeats) and the loot are persisted. Farm-proof BY ESCALATION: a win advances
// the counter and the NEXT rematch is harder (and scaled loot is granted once per new defeat), capped at
// MAX_DEFEATS — so re-fighting cannot mint the same loot twice. Beating him the full arc retires him (the
// §17 consequence, plus the boarding melee + the parrot pickpocket + his tricorn, are deferred beats).

/** The display name of a yard track's current tier (e.g. "jawbreaker-plated hull"). */
function tierName(state: GameState, key: string): string {
  const track = GALLEON_TRACKS.find((t) => t.key === key)
  const tier = track?.tiers.find((t) => t.tier === trackTier(state, key))
  return tier?.name ?? `tier ${trackTier(state, key)}`
}

/** A pure-ASCII HP bar, e.g. [#######---]. */
function hpBar(cur: number, max: number, width = 10): string {
  const filled = Math.max(0, Math.min(width, Math.round((cur / max) * width)))
  return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}]`
}

export interface SourbeardContext {
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

export interface SourbeardScreens {
  showSourbeard(): void
}

/** Wire the Sourbeard duel screen over a bootstrap host. */
export function createSourbeardScreens(ctx: SourbeardContext): SourbeardScreens {
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

  /** The two ships, spaced by the current range band — yours to port, the Black Lollipop to starboard. */
  function sceneText(duel: DuelState): string {
    const gap = ['~~~~~~~~~~~~~~~~~~~~', '~~~~~~~~~~', '~~'][duel.range] ?? '~~~~~'
    return `   \\######/ ${gap} \\@@@@@@/\n    you      ${' '.repeat(gap.length)}  Black Lollipop`
  }

  function showSourbeard(): void {
    // The duel is transient to this visit; a win commits the defeat + loot exactly once.
    let duel: DuelState | null = null
    let committed = false

    function render(): void {
      ctx.clearScreen()
      const s = session.getState()
      heading('Captain Sourbeard', 'sourbeard-screen')

      if (sourbeardRetired(s)) {
        renderRetired()
      } else {
        if (!duel) duel = createDuel(s)
        renderDuel(s, duel)
      }

      screen.appendChild(ctx.button('back to the sky port', 'sourbeard-to-skyport', () => ctx.showSkyPort(), 0))
      screen.appendChild(ctx.button('back to the map', 'sourbeard-to-map', () => ctx.showMap()))
    }

    function renderRetired(): void {
      // Beaten the full arc — the §17 "three times" consequence is a later beat; for now, he is gone.
      paragraph(
        'No black sails on the horizon. Three times you have sent the Black Lollipop running, and the third time Sourbeard did not laugh. The dark keeps him now; whatever that costs is a reckoning for another day.',
        'blurb',
        'sourbeard-retired',
      )
    }

    function renderDuel(s: GameState, d: DuelState): void {
      const outcome = duelOutcome(d)
      const encounter = sourbeardDefeats(s) + 1

      if (outcome === 'won') {
        if (!committed) commitVictory()
        paragraph(
          'The Black Lollipop heels hard over, smoke pouring from her gun-deck, and strikes her colors. Sourbeard sweeps off his tricorn in a furious little bow as she limps into the dark. "Well SAILED. This is not over, confectioner."',
          'blurb',
          'sourbeard-won',
        )
        if (!sourbeardRetired(session.getState())) {
          paragraph('He will be back, and angrier. (His tricorn, his parrot, and a closer fight are for another day.)', 'blurb', 'sourbeard-won-note')
        }
        return
      }
      if (outcome === 'lost') {
        paragraph(
          d.round >= MAX_ROUNDS
            ? 'Grappling lines whip across the gap and the Black Lollipop\'s crew swarm your rail — you took too long, and boarding is a fight for another day. You break off and limp home to refit.'
            : 'A broadside catches you below the waterline and the candied hull buckles. You strike your colors and run for port, sugar streaming in your wake. Refit, and try him again.',
          'blurb',
          'sourbeard-lost',
        )
        screen.appendChild(ctx.button('refit and hunt him again', 'sourbeard-retry', () => doRetry()))
        return
      }

      // --- the duel in progress ---
      paragraph(
        encounter === 1
          ? 'Black sails run up out of nowhere — the Black Lollipop, and Captain Sourbeard grinning across the gap. "A candied galleon! I MUST have her." His broadside is murder up close — hold him at range, slip his shots, and close only to finish. Sink him before his crew can board.'
          : encounter === 2
            ? 'The Black Lollipop comes about, gun-ports already run out. "Back for seconds, confectioner? I have been PRACTISING." Heavier-gunned than last time — out-shoot her or be boarded.'
            : 'The Black Lollipop bears down a third time, low and fast and silent. Sourbeard does not grin now. "Last dance." Sink her.',
        'blurb',
        'sourbeard-blurb',
      )

      paragraph(`the Black Lollipop  ${hpBar(d.foeHp, d.foeMaxHp)}  ${Math.max(0, Math.ceil(d.foeHp))}/${d.foeMaxHp}`, 'blurb', 'sourbeard-foe-hp')

      const rangeP = doc.createElement('p')
      rangeP.className = 'blurb'
      rangeP.setAttribute('data-testid', 'sourbeard-range')
      rangeP.setAttribute('data-range', String(d.range)) // machine-readable band for the e2e
      rangeP.textContent = `           range:  <~~ ${RANGE_NAMES[d.range]} ~~>   (round ${d.round + 1} of ${MAX_ROUNDS} — boarded if not sunk)`
      screen.appendChild(rangeP)

      paragraph(`your galleon        ${hpBar(d.yourHp, d.yourMaxHp)}  ${Math.max(0, Math.ceil(d.yourHp))}/${d.yourMaxHp}`, 'blurb', 'sourbeard-your-hp')

      const pre = doc.createElement('pre')
      pre.className = 'arena'
      pre.setAttribute('data-testid', 'sourbeard-scene')
      pre.textContent = sceneText(d)
      screen.appendChild(pre)

      screen.appendChild(ctx.button('press the attack (close in)', 'sourbeard-press', () => doManeuver('press')))
      screen.appendChild(ctx.button('hold steady (broadside)', 'sourbeard-hold', () => doManeuver('hold')))
      screen.appendChild(
        ctx.button(d.stats.fullSlip ? 'veer off (storm-silk slips her shot)' : 'veer off (give ground)', 'sourbeard-veer', () => doManeuver('veer')),
      )
      paragraph(
        `hull: ${tierName(s, GALLEON_HULL_KEY)}   cannons: ${tierName(s, GALLEON_CANNON_KEY)}   sails: ${tierName(s, GALLEON_SAILS_KEY)}`,
        'blurb',
        'sourbeard-stats',
      )
    }

    function doManeuver(maneuver: Maneuver): void {
      if (!duel) return
      duel = resolveManeuver(duel, maneuver)
      render()
    }

    function commitVictory(): void {
      committed = true
      session.dispatch((s) => {
        const prev = sourbeardDefeats(s)
        if (prev >= MAX_DEFEATS) return s // already at the arc cap — no more loot
        const n = prev + 1
        const looted = {
          ...s,
          candies: addResource(s.candies, DEFEAT_CANDY[n] ?? 0),
          chocolate: addResource(s.chocolate, DEFEAT_CHOCOLATE[n] ?? 0),
        }
        return setNumber(looted, SOURBEARD_DEFEATS_KEY, n)
      })
      const n = sourbeardDefeats(session.getState())
      ctx.logText(
        `Sourbeard struck (${n}/${MAX_DEFEATS}). His crew flings ${formatCount(DEFEAT_CANDY[n] ?? 0)} candies and ${formatCount(DEFEAT_CHOCOLATE[n] ?? 0)} chocolate over the rail to cover his retreat. Sourbeard apologizes for the cannonball. He does not mean it.`,
      )
    }

    function doRetry(): void {
      duel = createDuel(session.getState())
      committed = false
      render()
    }

    render()
  }

  return { showSourbeard }
}

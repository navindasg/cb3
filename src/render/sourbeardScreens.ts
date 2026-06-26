import type { GameSession } from '@/engine/session/gameSession'
import type { GameState } from '@/engine/types/GameState'
import { formatCount } from '@/engine/number/format'
import { setNumber, setFlag } from '@/engine/state/reducers'
import { addResource } from '@/engine/types/Resource'
import { grantItem } from '@/engine/shop/purchase'
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
  createBoarding,
  resolveExchange,
  boardingOutcome,
  cutFor,
  sourbeardBoarded,
  boardingAvailable,
  type BoardingState,
  type BoardingAction,
} from '@/engine/content/boardingDuel'
import {
  RANGE_NAMES,
  MAX_DEFEATS,
  MAX_ROUNDS,
  DEFEAT_CANDY,
  DEFEAT_CHOCOLATE,
  SOURBEARD_DEFEATS_KEY,
} from '@/content/ship/shipDuel'
import { MAX_TURNS as BOARDING_MAX_TURNS } from '@/content/ship/boardingDuel'
import { SOURBEARD_TRICORN, GUMMY_PARROT } from '@/content/items/items'
import { SOURBEARD_BOARDED_FLAG } from '@/content/flags'
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
    // Two transient sims, both forfeit on leaving: the BROADSIDE duel and then the on-foot BOARDING melee.
    // A win commits its loot exactly once (the defeat counter / the boarded flag own persistence).
    let duel: DuelState | null = null
    let committed = false
    let boarding: BoardingState | null = null
    let boardingCommitted = false

    function render(): void {
      ctx.clearScreen()
      const s = session.getState()
      heading('Captain Sourbeard', 'sourbeard-screen')

      if (sourbeardBoarded(s)) {
        renderRetired() // bested on the deck — gone for good (the §17 end)
      } else if (boardingAvailable(s)) {
        // The third broadside is won; he has boarded you. Fight him man to man (re-entry lands here too).
        if (!boarding) boarding = createBoarding(s)
        renderBoarding(boarding)
      } else {
        if (!duel) duel = createDuel(s)
        renderDuel(s, duel)
      }

      screen.appendChild(ctx.button('back to the sky port', 'sourbeard-to-skyport', () => ctx.showSkyPort(), 0))
      screen.appendChild(ctx.button('back to the map', 'sourbeard-to-map', () => ctx.showMap()))
    }

    function renderRetired(): void {
      // The §17 three-defeats consequence: bested at sea AND on the deck, the rival is gone. You wear his
      // hat and his parrot has switched sides; the dark keeps the rest.
      paragraph(
        'No black sails on the horizon. You beat Sourbeard at sea, and then on your own deck, and the last time he did not laugh. His tricorn is yours; his parrot rides your shoulder, loyal to whoever last won. The dark keeps the rest of him now — and whatever that costs is a reckoning for another day.',
        'blurb',
        'sourbeard-retired',
      )
    }

    function renderDuel(s: GameState, d: DuelState): void {
      const outcome = duelOutcome(d)
      const encounter = sourbeardDefeats(s) + 1

      if (outcome === 'won') {
        if (!committed) commitVictory()
        if (sourbeardRetired(session.getState())) {
          // The third broadside: she is sinking under him, so he does not flee — he boards YOU.
          paragraph(
            'The Black Lollipop goes down by the bow, smoke and sugar pouring off her — and Sourbeard does not strike his colors. He swings ACROSS instead, cutlass drawn, boots thudding onto your rail. "If she sinks, confectioner, we finish this on YOUR deck. Draw."',
            'blurb',
            'sourbeard-boarding-intro',
          )
          screen.appendChild(ctx.button('draw your blade', 'sourbeard-draw', () => render()))
        } else {
          paragraph(
            'The Black Lollipop heels hard over, smoke pouring from her gun-deck, and strikes her colors. Sourbeard sweeps off his tricorn in a furious little bow as she limps into the dark. "Well SAILED. This is not over, confectioner."',
            'blurb',
            'sourbeard-won',
          )
          paragraph('He will be back, and angrier.', 'blurb', 'sourbeard-won-note')
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
        n >= MAX_DEFEATS
          ? `Sourbeard struck (${n}/${MAX_DEFEATS}) — but there is no retreat this time. The Black Lollipop goes down under him and he comes over your rail with a cutlass and ${formatCount(DEFEAT_CANDY[n] ?? 0)} candies and ${formatCount(DEFEAT_CHOCOLATE[n] ?? 0)} chocolate scattering off the deck behind him.`
          : `Sourbeard struck (${n}/${MAX_DEFEATS}). His crew flings ${formatCount(DEFEAT_CANDY[n] ?? 0)} candies and ${formatCount(DEFEAT_CHOCOLATE[n] ?? 0)} chocolate over the rail to cover his retreat. Sourbeard apologizes for the cannonball. He does not mean it.`,
      )
    }

    function doRetry(): void {
      duel = createDuel(session.getState())
      committed = false
      render()
    }

    // --- the boarding melee (on-foot guard/lunge fencing, the §17 climax) ------------------------------

    /** Sourbeard squared up, his cutlass wound for the telegraphed cut (his STANCE — which can feint). */
    function boardingScene(tell: 'high' | 'low'): string {
      return tell === 'high'
        ? "   \\o   <- cutlass HIGH\n    |\\\n   Sourbeard"
        : "    o/\n    |\\   <- cutlass LOW\n   Sourbeard"
    }

    function renderBoarding(b: BoardingState): void {
      const outcome = boardingOutcome(b)

      if (outcome === 'won') {
        if (!boardingCommitted) commitBoardingVictory()
        paragraph(
          'Your blade gets inside his guard and Sourbeard sits down hard on the deck, astonished, hat gone. For a moment the bluster drains out of him and he just looks tired. "...Huh," he says. Then his crew drag him back over the rail into the dark, and the Black Lollipop is gone, and so, three times over, is he.',
          'blurb',
          'sourbeard-board-won',
        )
        return
      }
      if (outcome === 'lost') {
        paragraph(
          b.turn >= BOARDING_MAX_TURNS
            ? "Sourbeard's crew come boiling over the rail behind him and there are simply too many cutlasses; you are driven back to the mast, winded but alive. He tips his hat and withdraws. \"Catch your breath, confectioner. I will wait.\""
            : 'Sourbeard reads your blade like a book and the flat of his cutlass takes you off your feet. He could finish it. He does not. "Up you get. I want you AWAKE for this." Catch your breath and square up again.',
          'blurb',
          'sourbeard-board-lost',
        )
        screen.appendChild(ctx.button('back to your feet', 'sourbeard-board-retry', () => doBoardRetry()))
        return
      }

      // --- the melee in progress ---
      paragraph(
        'No cannons now — just the two of you on a heaving deck. His stance tells you where the cut is coming — but the man FEINTS on a rhythm, and the first time through he WILL catch you; learn his cadence. GUARD the true line for a blocked riposte; LUNGE to hit hard, but a lunge leaves you open and the cut always lands. Guard the heavy cuts, punish the light ones.',
        'blurb',
        'sourbeard-board-blurb',
      )

      paragraph(`you         ${hpBar(b.yourHp, b.yourMaxHp)}  ${Math.max(0, Math.ceil(b.yourHp))}/${b.yourMaxHp}`, 'blurb', 'sourbeard-board-your-hp')
      paragraph(`Sourbeard   ${hpBar(b.foeHp, b.foeMaxHp)}  ${Math.max(0, Math.ceil(b.foeHp))}/${b.foeMaxHp}`, 'blurb', 'sourbeard-board-foe-hp')

      const cut = cutFor(b.turn)
      const pre = doc.createElement('pre')
      pre.className = 'arena'
      pre.setAttribute('data-testid', 'sourbeard-board-scene')
      pre.setAttribute('data-tell', cut.tell) // the stance he SHOWS (the player reads this by eye)
      pre.setAttribute('data-line', cut.line) // the TRUE line (a feint when != tell) — for the e2e only
      pre.textContent = boardingScene(cut.tell)
      screen.appendChild(pre)

      screen.appendChild(ctx.button('guard high (block + riposte)', 'sourbeard-board-guard-high', () => doExchange('guard-high')))
      screen.appendChild(ctx.button('guard low (block + riposte)', 'sourbeard-board-guard-low', () => doExchange('guard-low')))
      screen.appendChild(ctx.button('lunge (hard hit — but you eat the cut)', 'sourbeard-board-lunge', () => doExchange('lunge')))
      paragraph(
        `your blade: damage ${b.weapon.damage}${b.weapon.strikes > 1 ? ` x${b.weapon.strikes}` : ''}   (exchange ${b.turn + 1} of ${BOARDING_MAX_TURNS} — his crew swarm you after)`,
        'blurb',
        'sourbeard-board-weapon',
      )
    }

    function doExchange(action: BoardingAction): void {
      if (!boarding) return
      boarding = resolveExchange(boarding, action)
      render()
    }

    function commitBoardingVictory(): void {
      // NOTE: the gummy parrot (DESIGN secret §18.10 "pickpocket Sourbeard's parrot") is folded into this
      // boarding drop for now — there is no standalone pickpocket interaction. If that secret is built
      // later, it must check gummyParrotOwned so it is never double-granted.
      boardingCommitted = true
      session.dispatch((s) => {
        if (sourbeardBoarded(s)) return s // already retired — never loot twice
        return grantItem(grantItem(setFlag(s, SOURBEARD_BOARDED_FLAG), SOURBEARD_TRICORN), GUMMY_PARROT)
      })
      ctx.logText(
        "Sourbeard is beaten on his own boarding planks. You take his tricorn (now worn) and his gummy parrot defects on the spot — both await a crew to lift the spirits of, one day. The rival is retired.",
      )
    }

    function doBoardRetry(): void {
      boarding = createBoarding(session.getState())
      boardingCommitted = false
      render()
    }

    render()
  }

  return { showSourbeard }
}

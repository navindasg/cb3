import type { GameSession } from '@/engine/session/gameSession'
import type { GameState } from '@/engine/types/GameState'
import { formatCount } from '@/engine/number/format'
import { setFlag } from '@/engine/state/reducers'
import { addResource } from '@/engine/types/Resource'
import { grantItem } from '@/engine/shop/purchase'
import {
  createFight,
  resolveTurn,
  fightOutcome,
  telegraphedArm,
  strikeTarget,
  type KrakenState,
  type KrakenAction,
} from '@/engine/content/krakenFight'
import { TENTACLE_HP, MAX_TURNS, KRAKEN_CANDY, KRAKEN_CHOCOLATE } from '@/content/planet/krakenFight'
import { KRAKEN_CROWN } from '@/content/items/items'
import { KRAKEN_DEFEATED_FLAG } from '@/content/flags'

// The sour kraken (Act 2 — an optional tail, DESIGN §10/§181). A wiring sub-module of the DOM bootstrap,
// sibling to sourbeardScreens/cometScreens: it owns NO game logic. The telegraph-and-sever fight
// (createFight / resolveTurn / fightOutcome) reading the equipped hand weapon lives in the tested engine
// (engine/content/krakenFight) over content config (content/planet/krakenFight); this only draws the arms +
// HP bars, routes the strike/brace clicks, and commits the crown + loot ONCE. Coverage-excluded,
// Playwright-verified. Routed back to the sour planet (you descended from it).
//
// The fight is TRANSIENT (an abandoned or lost descent is forfeit — it never persists). Only the cleared
// flag (krakenDefeated) and the one-off drop (the kraken crown + a candy/chocolate hoard) are persisted,
// granted exactly once and gated by the flag — farm-proof, like the squirrel's acorn.

/** A pure-ASCII HP bar, e.g. [#####] / [##---]. */
function hpBar(cur: number, max: number, width = 5): string {
  const filled = Math.max(0, Math.min(width, Math.round((cur / max) * width)))
  return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}]`
}

export interface KrakenContext {
  readonly doc: Document
  readonly screen: HTMLElement
  readonly session: GameSession
  clearScreen(): void
  button(label: string, testid: string, onClick: () => void, accelIndex?: number): HTMLButtonElement
  notify(text: string): void
  logText(text: string): void
  /** Back up to the sour planet's platforms (you descended into the gas from there). */
  showSourPlanet(): void
}

export interface KrakenScreens {
  showKraken(): void
}

/** Wire the sour-kraken screen over a bootstrap host. */
export function createKrakenScreens(ctx: KrakenContext): KrakenScreens {
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

  /** The kraken rising out of the gas, its arms ranged by band — the telegraphed one winding up (>>). */
  function sceneText(fight: KrakenState): string {
    const tel = telegraphedArm(fight)
    const lines = fight.tentacles
      .slice()
      .sort((a, b) => a.dist - b.dist || a.id - b.id)
      .map((t) => {
        const lead = t.id === tel?.id ? '>>' : '  '
        const gap = '~'.repeat(t.dist) // farther arms drawn farther out in the gas
        return `${lead} arm  ${gap}<8  ${hpBar(t.hp, TENTACLE_HP)}`
      })
    return ['        ___', '     .-(   )-.   the kraken', "      `-.,_,.-'", ...lines].join('\n')
  }

  function showKraken(): void {
    // The fight is transient to this descent; a win commits the crown + hoard exactly once.
    let fight: KrakenState | null = null
    let committed = false

    function render(): void {
      ctx.clearScreen()
      const s = session.getState()
      heading('the sour kraken', 'kraken-screen')

      if (s.flags[KRAKEN_DEFEATED_FLAG] === true) {
        renderCalm()
      } else {
        if (!fight) fight = createFight(s)
        renderFight(fight)
      }

      screen.appendChild(ctx.button('climb back to the platforms', 'kraken-to-sour', () => ctx.showSourPlanet(), 0))
    }

    function renderCalm(): void {
      paragraph(
        'The deep is still. Far below, the great shape turns over once in its sleep and settles — no longer winding up at you, but, you could almost believe, turning to keep you in view. You wear its crown out of the gas. It is too big, and very slightly damp, and yours.',
        'blurb',
        'kraken-calm',
      )
    }

    function renderFight(f: KrakenState): void {
      const outcome = fightOutcome(f)

      if (outcome === 'won') {
        if (!committed) commitVictory()
        paragraph(
          'The last arm goes limp and slides back into the murk. For a long moment nothing — then the whole vast bulk of it heaves up out of the gas, regards you with one slow, unbothered eye, and bows. A circlet of cold coral floats free. You take it. You are, it seems, family now.',
          'blurb',
          'kraken-won',
        )
        return
      }
      if (outcome === 'lost') {
        paragraph(
          f.turn >= MAX_TURNS
            ? 'The sour gas finally finds the seams of your gear and you are driven coughing back up the shell — not beaten, exactly, but not welcome. Refit and come down again.'
            : 'An arm the size of a mainmast catches you square and folds you off the platform — the far one, the one you could never quite reach. You catch a lower shelf, gasping, gear streaming. Climb back up, breathe, and bring more reach — or learn to brace.',
          'blurb',
          'kraken-lost',
        )
        screen.appendChild(ctx.button('catch your breath and descend again', 'kraken-retry', () => doRetry()))
        return
      }

      // --- the fight in progress ---
      paragraph(
        'Down through the corrosive haze, on a drifting shell no wider than a deck, the kraken unfolds arm after arm around you. It cannot reach with all of them at once — watch which one winds up (>>), and meet it if your weapon can reach, or set your feet and brace. Let them close and they hit like falling masts.',
        'blurb',
        'kraken-blurb',
      )

      paragraph(`you        ${hpBar(f.yourHp, f.yourMaxHp, 12)}  ${Math.max(0, Math.ceil(f.yourHp))}/${f.yourMaxHp}`, 'blurb', 'kraken-your-hp')

      const tel = telegraphedArm(f)
      const target = strikeTarget(f)
      const canIntercept = target !== null && tel !== null && target.id === tel.id

      const pre = doc.createElement('pre')
      pre.className = 'arena'
      pre.setAttribute('data-testid', 'kraken-scene')
      // machine-readable hints for the e2e (the player reads the scene by eye): the telegraphed arm's band,
      // and whether a strike this turn would intercept it.
      pre.setAttribute('data-telegraph', String(tel?.dist ?? 0))
      pre.setAttribute('data-intercept', canIntercept ? '1' : '0')
      pre.setAttribute('data-arms', String(f.tentacles.length))
      pre.setAttribute('data-turn', String(f.turn))
      pre.textContent = sceneText(f)
      screen.appendChild(pre)

      const strikeLabel = canIntercept
        ? 'strike the winding arm (intercept its blow)'
        : target
          ? 'strike the nearest arm (you cannot reach the winding one — it will hit)'
          : 'strike (nothing in reach — the swing whiffs)'
      screen.appendChild(ctx.button(strikeLabel, 'kraken-strike', () => doAction('strike')))
      screen.appendChild(ctx.button('brace (halve the blow, make no progress)', 'kraken-brace', () => doAction('brace')))

      const w = f.weapon
      paragraph(
        `your hand: reach ${w.reach}   damage ${w.damage}${w.strikes > 1 ? ` x${w.strikes}` : ''}   (turn ${f.turn + 1} of ${MAX_TURNS} — the gas etches through after)`,
        'blurb',
        'kraken-weapon',
      )
    }

    function doAction(action: KrakenAction): void {
      if (!fight) return
      fight = resolveTurn(fight, action)
      render()
    }

    function commitVictory(): void {
      committed = true
      session.dispatch((s) => {
        if (s.flags[KRAKEN_DEFEATED_FLAG] === true) return s // already looted — never twice
        const looted: GameState = {
          ...s,
          candies: addResource(s.candies, KRAKEN_CANDY),
          chocolate: addResource(s.chocolate, KRAKEN_CHOCOLATE),
        }
        return grantItem(setFlag(looted, KRAKEN_DEFEATED_FLAG), KRAKEN_CROWN)
      })
      ctx.logText(
        `The sour kraken yields. ${formatCount(KRAKEN_CANDY)} candies and ${formatCount(KRAKEN_CHOCOLATE)} chocolate spill from the shelf, and the kraken crown is yours — now worn (re-don the fishbowl helm at your inventory if you need its air).`,
      )
    }

    function doRetry(): void {
      fight = createFight(session.getState())
      committed = false
      render()
    }

    render()
  }

  return { showKraken }
}

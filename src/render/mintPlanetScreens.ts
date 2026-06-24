import type { GameSession } from '@/engine/session/gameSession'
import type { GameState } from '@/engine/types/GameState'
import { formatCount } from '@/engine/number/format'
import {
  createLabyrinth,
  labyrinthSolved,
  takePassage,
  coldestPassage,
  frostWyrmFreed,
  freeFrostWyrm,
  condenserCount,
  peppermintRate,
  canBuildCondenser,
  buildCondenser,
  type LabyrinthState,
} from '@/engine/content/mintPlanet'
import { act2GateCleared } from '@/engine/content/actGate'
import { hullAtGate } from '@/engine/content/galleonUpgrade'
import {
  LABYRINTH_ROOMS,
  CONDENSER_ROCK_CANDY_COST,
  CONDENSER_CANDY_COST,
  PEPPERMINT_GATE_AMOUNT,
  type LabyrinthRoom,
} from '@/content/planet/mintPlanet'

// The mint planet (Act 2 — quest 10, the act capstone, DESIGN §182/§184). A wiring sub-module of the DOM
// bootstrap, sibling to the other Act-2 screens: it owns NO game logic. The ice labyrinth ("follow the
// cold"), the frost-wyrm freeing, the condensers, and the §184 act gate are pure, tested engine
// (engine/content/mintPlanet + actGate); this only draws the rooms / the wyrm / the mining + routes the
// clicks. Coverage-excluded, Playwright-verified. Routed back through showSkyPort.
//
// The labyrinth is TRANSIENT (it never persists — leaving mid-descent forfeits it, like a quest). Only
// the frost-wyrm flag, the condenser count, and the peppermint resource persist. The larval-star reveal
// (§285) is left entirely to the room prose; the game never says it.

const roomById = (id: string): LabyrinthRoom | undefined => LABYRINTH_ROOMS.find((r) => r.id === id)

export interface MintPlanetContext {
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

export interface MintPlanetScreens {
  showMintPlanet(): void
}

/** Wire the mint-planet screen over a bootstrap host. */
export function createMintPlanetScreens(ctx: MintPlanetContext): MintPlanetScreens {
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

  function showMintPlanet(): void {
    // The labyrinth descent is transient to this visit, until the wyrm is freed (then the planet is the
    // peppermint fields forever after).
    let lab: LabyrinthState | null = null

    function render(): void {
      ctx.clearScreen()
      const s = session.getState()
      heading('the mint planet', 'mint-screen')

      if (frostWyrmFreed(s)) {
        lab = null
        renderFields(s)
      } else {
        if (!lab) lab = createLabyrinth()
        if (labyrinthSolved(lab)) renderFrostWyrm()
        else renderLabyrinth(lab)
      }

      screen.appendChild(ctx.button('back to the sky port', 'mint-to-skyport', () => ctx.showSkyPort(), 0))
      screen.appendChild(ctx.button('back to the map', 'mint-to-map', () => ctx.showMap()))
    }

    // --- the ice labyrinth (follow the cold) -------------------------------------------------------

    function renderLabyrinth(state: LabyrinthState): void {
      const room = roomById(state.room)
      if (!room) return
      paragraph(room.text, 'blurb', 'mint-room')

      // The temperatures are on the passages themselves; the hint only names the rule (the cold deepens
      // toward the heart), and carries the coldest index as data for the e2e — never spells out the answer.
      const cold = coldestPassage(room.id)
      const hint = doc.createElement('p')
      hint.className = 'blurb'
      hint.setAttribute('data-testid', 'mint-hint')
      hint.setAttribute('data-coldest', String(cold))
      hint.textContent = 'The cold is not even here. It deepens toward the heart of the place — read the air, and go down into it.'
      screen.appendChild(hint)

      room.passages.forEach((p, i) => {
        screen.appendChild(ctx.button(`${p.label}  (${p.temp} deg)`, `mint-passage-${i}`, () => doTake(i)))
      })
    }

    function doTake(passageIndex: number): void {
      if (!lab) return
      const wasColdest = passageIndex === coldestPassage(lab.room)
      const before = lab.room
      lab = takePassage(lab, passageIndex)
      if (lab.room === before) return // no-op (bad index)
      // Any turn away from the deepening cold folds you back — "the labyrinth keeps you" (§356).
      if (!wasColdest) {
        ctx.notify('The passage warms and doubles back on itself, and lets you out somewhere you have already been. The labyrinth keeps you. It was lonely.')
      }
      render()
    }

    // --- the frost wyrm (the frozen heart, a light lore beat) --------------------------------------

    function renderFrostWyrm(): void {
      paragraph(
        'The frost wyrm. Vast, coiled, mid-roar — and frozen solid in the act of it, rimed in peppermint a foot thick. It did not breathe fire. It tried to, once, and the cold won; you can see where the first heat guttered out behind its teeth. Something about the shape of it sits wrong and familiar, like a word you almost know.',
        'blurb',
        'mint-wyrm',
      )
      paragraph(
        'It will not wake. You stand with it a while, in the total cold, and it does not wake. Then you break the peppermint-frost away from its flank in long bright sheets.',
        'blurb',
        'mint-wyrm-2',
      )
      screen.appendChild(ctx.button('break the peppermint-frost', 'mint-free-wyrm', () => doFree()))
    }

    function doFree(): void {
      const result = freeFrostWyrm(session.getState())
      if (!result.ok) return
      session.dispatch(() => result.state)
      ctx.logText('The peppermint fields open around the frozen wyrm. It keeps the cold; you take the peppermint.')
      render()
    }

    // --- the peppermint fields (mining + the §184 act gate) ----------------------------------------

    function renderFields(s: GameState): void {
      paragraph(
        'The wyrm stays as it is, mid-roar, keeping its own weather; you get the sense it would have been something to see. Around it the peppermint fields stretch out in bright drifts, sublimating slowly into the thin air. Set condensers to catch it. This is the long haul — the galleon\'s last gate before the sun.',
        'blurb',
        'mint-fields',
      )
      paragraph(
        `condensers: ${condenserCount(s)} — sublimating ${peppermintRate(s).toFixed(2)} peppermint/sec    (peppermint on hand: ${formatCount(s.peppermint.current)})`,
        'blurb',
        'mint-mining',
      )

      const build = ctx.button(
        `build a condenser (${CONDENSER_ROCK_CANDY_COST} rock candy + ${formatCount(CONDENSER_CANDY_COST)} candies)`,
        'mint-build-condenser',
        () => doBuild(),
        0,
      )
      if (!canBuildCondenser(s)) {
        build.disabled = true
        build.classList.add('shop-unaffordable')
      }
      screen.appendChild(build)

      renderActGate(s)
    }

    function renderActGate(s: GameState): void {
      const hull = hullAtGate(s)
      const mint = s.peppermint.current
      paragraph(
        `the Act-2 gate (DESIGN §184):  jawbreaker hull ${hull ? '[done]' : '[not yet]'}  ·  peppermint ${formatCount(Math.floor(mint))} / ${formatCount(PEPPERMINT_GATE_AMOUNT)}`,
        'blurb',
        'mint-gate',
      )
      if (act2GateCleared(s)) {
        paragraph(
          'The galleon rides heavy with peppermint and plated to the teeth. She can take the heat now. Beyond the planets the sun burns at the centre of everything, and something is waiting in it. Act 2 is done; the descent is another story. (Act 3 — the dyson scaffold — is not built yet.)',
          'blurb',
          'mint-act-complete',
        )
      }
    }

    function doBuild(): void {
      const result = buildCondenser(session.getState())
      if (!result.ok) {
        ctx.notify(
          result.reason === 'locked'
            ? 'The fields are still frozen shut.'
            : `You need ${CONDENSER_ROCK_CANDY_COST} rock candy and ${formatCount(CONDENSER_CANDY_COST)} candies to build a condenser.`,
        )
        return
      }
      session.dispatch(() => result.state)
      ctx.logText('A condenser unfolds its fins and begins to breathe peppermint out of the cold.')
      render()
    }

    render()
  }

  return { showMintPlanet }
}

import type { GameSession } from '@/engine/session/gameSession'
import type { GameState, ResourceKey } from '@/engine/types/GameState'
import { formatCount } from '@/engine/number/format'
import {
  scaffoldReachable,
  currentStage,
  scaffoldComplete,
  nextStage,
  canBuildStage,
  buildStage,
  sunArt,
} from '@/engine/content/dysonScaffold'
import {
  solarWorksOpen,
  collectorCount,
  caramelCollectorCount,
  solarCandyRate,
  solarCaramelRate,
  canBuildCollector,
  canBuildCaramelCollector,
  buildCollector,
  buildCaramelCollector,
} from '@/engine/content/solarWorks'
import {
  workCrewsUnlocked,
  workCrewCount,
  canHireCrew,
  hireCrew,
} from '@/engine/content/gummyWorkCrew'
import { DYSON_STAGES, DYSON_STAGE_COUNT } from '@/content/sun/dysonScaffold'
import {
  SOLAR_COLLECTOR_CANDY_COST,
  SOLAR_COLLECTOR_ROCK_CANDY_COST,
  CARAMEL_COLLECTOR_CANDY_COST,
} from '@/content/sun/solarWorks'
import {
  WORK_CREW_CANDY_COST,
  WORK_CREW_LICORICE_COST,
  WORK_CREW_BOOST,
} from '@/content/gummy/molds'
import { ROCK_CANDY_PRODUCERS } from '@/content/producers/rockCandy'
import { PEPPERMINT_PRODUCERS } from '@/content/producers/peppermint'
import { productionRate } from '@/engine/loop/production'
import { SUN_REACHED_FLAG } from '@/content/flags'

// The dyson scaffold (Act 3 — reach the sun, DESIGN §186/§188). A wiring sub-module of the DOM bootstrap,
// sibling to skyPortScreens/cometScreens: it owns NO game logic. The 5-stage build machine (currentStage /
// nextStage / canBuildStage / buildStage), the reach gate (scaffoldReachable = act2GateCleared), and the
// pure sun-art assembler all live in the tested engine (engine/content/dysonScaffold) over content config
// (content/sun/dysonScaffold); this only draws the glowing sun, the stage ledger, and routes the raise
// clicks. Coverage-excluded, Playwright-verified — the same thin-wiring contract as the sky port. Routed
// back through showSkyPort / showMap. First arrival here (via either path) sets sunReached (reveal-only).
//
// The sun is built from pure ASCII (engine/content/dysonScaffold.SUN_ART_BASE + the scaffold overlays);
// the amber glow is the CSS .glow-sun class on the <pre> (NEVER the unicode sun glyph). The voice here is
// terse and tired — the shipwright's bravado is gone; this is the §186 idle wall, with dread.

const RESOURCE_LABEL: Record<ResourceKey, string> = {
  candies: 'candies',
  lollipops: 'lollipops',
  chocolate: 'chocolate',
  caramel: 'caramel',
  rockCandy: 'rock candy',
  cottonCandy: 'cotton candy',
  licorice: 'licorice',
  popRocks: 'pop rocks',
  sour: 'sour essence',
  peppermint: 'peppermint',
  mint: 'mint essence',
  stardust: 'stardust',
}

export interface ScaffoldContext {
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

export interface ScaffoldScreens {
  showScaffold(): void
}

/** Wire the dyson-scaffold screen over a bootstrap host. */
export function createScaffoldScreens(ctx: ScaffoldContext): ScaffoldScreens {
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

  function showScaffold(): void {
    // First arrival reveals the sun on the overworld forever after — reveal-only, no other effect.
    if (session.getState().flags[SUN_REACHED_FLAG] !== true) {
      session.dispatch((s) => ({ ...s, flags: { ...s.flags, [SUN_REACHED_FLAG]: true } }))
    }

    function render(): void {
      ctx.clearScreen()
      const s = session.getState()
      heading('the dyson scaffold', 'scaffold-screen')

      // Defensive: a stray route here before the Act-2 gate answers in voice, not a blank screen.
      if (!scaffoldReachable(s)) {
        paragraph(
          'The sun hangs immense and silent ahead, and you are nowhere near ready for it. Seal the galleon and bank what the mint planet owes you first.',
          'blurb',
          'scaffold-shut',
        )
        screen.appendChild(ctx.button('back to the sky port', 'scaffold-to-skyport', () => ctx.showSkyPort(), 0))
        return
      }

      renderSun(s)
      renderLedger(s)
      renderNextStage(s)
      renderSolarWorks(s)
      renderWorkCrews(s)

      screen.appendChild(ctx.button('back to the sky port', 'scaffold-to-skyport', () => ctx.showSkyPort(), 0))
      screen.appendChild(ctx.button('back to the map', 'scaffold-to-map', () => ctx.showMap()))
    }

    /** The sun, drawn from completed stage overlays, glowing amber (CSS .glow-sun, never the unicode sun). */
    function renderSun(s: GameState): void {
      paragraph(
        currentStage(s) === 0
          ? 'It fills the sky. A star, close enough now that it has no edges — only light, and the cold thought of how far you still are. A lone strut floats out from the galleon toward it. Whoever runs the works here barely looks up. "So. You want to cage a star."'
          : 'The scaffold throws its thin black struts across the face of the sun, and the star burns on behind them as if it has not noticed. The works-master nods at the next gap. "More. Always more."',
        'blurb',
        'scaffold-blurb',
      )

      const art = doc.createElement('pre')
      art.className = 'arena glow-sun'
      art.setAttribute('data-testid', 'scaffold-sun')
      art.textContent = sunArt(currentStage(s))
      screen.appendChild(art)
    }

    /** The stage ledger — one line per stage, marking what is raised, what is next, what is far off. */
    function renderLedger(s: GameState): void {
      heading('the scaffold', 'scaffold-ledger')
      const done = currentStage(s)
      paragraph(
        `${formatCount(done)} / ${DYSON_STAGE_COUNT} stages raised${scaffoldComplete(s) ? '   (the cage is closed)' : ''}`,
        'blurb',
        'scaffold-progress',
      )
      for (const stage of DYSON_STAGES) {
        const state = stage.stage <= done ? 'raised' : stage.stage === done + 1 ? 'next' : stage.deferred ? 'locked' : 'ahead'
        paragraph(`  stage ${stage.stage}: ${stage.name} — ${state}`, 'blurb', `scaffold-stage-${stage.stage}`)
      }
    }

    /** The raise button for the next stage — its cost lines, gated on canBuildStage; deferred stages say why. */
    function renderNextStage(s: GameState): void {
      const next = nextStage(s)
      if (!next) {
        paragraph('There is nothing left to raise. The star is caged.', 'blurb', 'scaffold-max')
        return
      }
      if (next.deferred) {
        paragraph(`next: ${next.name} — not yet (${next.note}).`, 'blurb', 'scaffold-locked')
        return
      }

      const priceText = next.price
        .map((l) => `${formatCount(l.amount)} ${RESOURCE_LABEL[l.resource]}`)
        .join(' + ')
      const raise = ctx.button(`raise ${next.name} (${priceText})`, 'scaffold-raise', () => doRaise())
      if (!canBuildStage(s)) {
        raise.disabled = true
        raise.classList.add('shop-unaffordable')
      }
      screen.appendChild(raise)
    }

    /**
     * The solar works (the stage-1 reward): two count-scaled collectors hung on the scaffold once the first
     * strut is raised. Shown only when solarWorksOpen — before that, nothing here. Surfaces each collector's
     * count and the LIVE candy/s and caramel/s the fleet pours, so the §5 ~x100 jump is legible. The whole
     * machine (counts, rates, affordability, the atomic spend) lives in engine/content/solarWorks.
     */
    function renderSolarWorks(s: GameState): void {
      if (!solarWorksOpen(s)) return

      heading('the solar works', 'scaffold-works')
      paragraph(
        'The first strut holds, and the works-master finally cracks something like a smile. "Now we make it pay. Hang the collectors. Each one drinks a little of the star." A crucible the size of a county. It boils.',
        'blurb',
        'scaffold-works-blurb',
      )

      // --- solar candy collectors (the income jump) ---
      paragraph(
        `solar candy collectors: ${formatCount(collectorCount(s))}  (+${formatCount(solarCandyRate(s))} candies/s)`,
        'blurb',
        'scaffold-collectors',
      )
      const collectorPrice = `${formatCount(SOLAR_COLLECTOR_CANDY_COST)} candies + ${formatCount(SOLAR_COLLECTOR_ROCK_CANDY_COST)} rock candy`
      const buyCollector = ctx.button(
        `hang a solar candy collector (${collectorPrice})`,
        'scaffold-buy-collector',
        () => doBuildCollector(),
      )
      if (!canBuildCollector(s)) {
        buyCollector.disabled = true
        buyCollector.classList.add('shop-unaffordable')
      }
      screen.appendChild(buyCollector)

      // --- the solar-caramel collector (the scaling faucet) ---
      paragraph(
        `solar-caramel collectors: ${formatCount(caramelCollectorCount(s))}  (+${solarCaramelRate(s).toFixed(2)} caramel/s)`,
        'blurb',
        'scaffold-caramel-collectors',
      )
      const caramelPrice = `${formatCount(CARAMEL_COLLECTOR_CANDY_COST)} candies`
      const buyCaramel = ctx.button(
        `hang a solar-caramel collector (${caramelPrice})`,
        'scaffold-buy-caramel-collector',
        () => doBuildCaramelCollector(),
      )
      if (!canBuildCaramelCollector(s)) {
        buyCaramel.disabled = true
        buyCaramel.classList.add('shop-unaffordable')
      }
      screen.appendChild(buyCaramel)
    }

    /**
     * The gummy work-crews (the stage-2 reward, §188/§261): a count-driven multiplier on the WHOLE gummy
     * army's mining output, hired once the lower ring is raised. Shown only when workCrewsUnlocked — before
     * that, nothing here. Surfaces the crew count + the LIVE boosted rock-candy/s and peppermint/s, so the
     * automation is legible. The whole machine (count, affordability, the atomic spend, the multiplier) lives
     * in engine/content/gummyWorkCrew + content/gummy/molds; this only draws it. The gummy folk send the
     * crews; they do not speak.
     */
    function renderWorkCrews(s: GameState): void {
      if (!workCrewsUnlocked(s)) return

      heading('the gummy work-crews', 'scaffold-crews')
      paragraph(
        'A column of gummy folk files up from the galleon and sets to work on the struts without a word. The works-master watches them a moment, then looks back at the sun. "They are faster than us. They do not get cold." The same little folk who burrowed your moon, set against a sun.',
        'blurb',
        'scaffold-crews-blurb',
      )

      const rockRate = productionRate(s, ROCK_CANDY_PRODUCERS, 'rockCandy')
      const peppermintRate = productionRate(s, PEPPERMINT_PRODUCERS, 'peppermint')
      paragraph(
        `gummy work-crews: ${formatCount(workCrewCount(s))}  (+${Math.round(WORK_CREW_BOOST * 100)}% army mining each)`,
        'blurb',
        'scaffold-crew-count',
      )
      paragraph(
        `the army now mines +${rockRate.toFixed(2)} rock candy/s and +${peppermintRate.toFixed(2)} peppermint/s`,
        'blurb',
        'scaffold-crew-rates',
      )

      const crewPrice = `${formatCount(WORK_CREW_CANDY_COST)} candies + ${formatCount(WORK_CREW_LICORICE_COST)} licorice`
      const hire = ctx.button(`hire a gummy work-crew (${crewPrice})`, 'scaffold-hire-crew', () => doHireCrew())
      if (!canHireCrew(s)) {
        hire.disabled = true
        hire.classList.add('shop-unaffordable')
      }
      screen.appendChild(hire)
    }

    function doHireCrew(): void {
      const result = hireCrew(session.getState())
      if (!result.ok) {
        ctx.notify(
          result.reason === 'locked'
            ? 'the work-crews are not here yet — raise the lower ring.'
            : "you can't afford another work-crew yet.",
        )
        return
      }
      session.dispatch(() => result.state)
      ctx.logText('Another work-crew files up and joins the burrowers. The mining quickens. They do not look up.')
      render()
    }

    function doBuildCollector(): void {
      const result = buildCollector(session.getState())
      if (!result.ok) {
        ctx.notify(
          result.reason === 'locked'
            ? 'the works are not open yet — raise the first strut.'
            : "you can't afford another collector yet.",
        )
        return
      }
      session.dispatch(() => result.state)
      ctx.logText('Another collector unfolds against the sun and begins to drink. The candy comes faster now.')
      render()
    }

    function doBuildCaramelCollector(): void {
      const result = buildCaramelCollector(session.getState())
      if (!result.ok) {
        ctx.notify(
          result.reason === 'locked'
            ? 'the works are not open yet — raise the first strut.'
            : "you can't afford a caramel collector yet.",
        )
        return
      }
      session.dispatch(() => result.state)
      ctx.logText('A caramel collector catches the star and renders it slow and dark. A thin stream of caramel begins.')
      render()
    }

    function doRaise(): void {
      const before = session.getState()
      const next = nextStage(before)
      const result = buildStage(before)
      if (!result.ok) {
        ctx.notify(
          result.reason === 'unaffordable'
            ? "you can't afford to raise that stage yet."
            : result.reason === 'deferred'
              ? 'that stage cannot be raised yet — its materials are not in the game.'
              : 'there is nothing left to raise.',
        )
        return
      }
      session.dispatch(() => result.state)
      ctx.logText(
        `The works swings ${next?.name ?? 'the next stage'} into place against the sun. The star burns on, uncaring, a little more caged.`,
      )
      render()
    }

    render()
  }

  return { showScaffold }
}

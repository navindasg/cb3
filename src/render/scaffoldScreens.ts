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
import {
  starSeaOpen,
  trawlerCount,
  stardustRate,
  canBuildTrawler,
  buildTrawler,
} from '@/engine/content/starSea'
import {
  deckOpen,
  starEaterSighted,
  witnessStarDie,
} from '@/engine/content/observationDeck'
import {
  descentPortOpen,
  bathysphereBuilt,
  canBuildBathysphere,
  buildBathysphere,
} from '@/engine/content/bathysphere'
import { act3GateCleared } from '@/engine/content/actGate'
import { projectedStars, starDescentMultiplier } from '@/engine/content/starCounter'
import {
  STAR_DEATH_FRAMES,
  EATER_FAR,
  EATER_CLOSE,
  EATER_CLOSE_AT_STAGE,
} from '@/content/sun/observationDeck'
import { selectVariant } from '@/engine/content/dialogue'
import { ASTRONOMER_DIALOGUE } from '@/content/dialogue/astronomer'
import { t } from '@/content/i18n/en'
import type { GameTextKey } from '@/content/i18n/schema'
import { DYSON_STAGES, DYSON_STAGE_COUNT } from '@/content/sun/dysonScaffold'
import {
  SOLAR_COLLECTOR_CANDY_COST,
  SOLAR_COLLECTOR_ROCK_CANDY_COST,
  CARAMEL_COLLECTOR_CANDY_COST,
} from '@/content/sun/solarWorks'
import { STAR_TRAWLER_CANDY_COST, STAR_TRAWLER_CARAMEL_COST } from '@/content/sun/starSea'
import {
  BATHYSPHERE_PEPPERMINT_COST,
  BATHYSPHERE_MINT_COST,
  BATHYSPHERE_CARAMEL_COST,
  DESCENT_PORT_BLURB,
  BATHYSPHERE_PLAN_BLURB,
  BATHYSPHERE_BLURB,
  ACT3_COMPLETE_BLURB,
  DESCENT_HATCH_ART,
} from '@/content/sun/bathysphere'
import {
  WORK_CREW_CANDY_COST,
  WORK_CREW_LICORICE_COST,
  WORK_CREW_BOOST,
} from '@/content/gummy/molds'
import { ROCK_CANDY_PRODUCERS } from '@/content/producers/rockCandy'
import { PEPPERMINT_PRODUCERS } from '@/content/producers/peppermint'
import { productionRate } from '@/engine/loop/production'
import { SUN_REACHED_FLAG } from '@/content/flags'
import { fireAny } from '@/engine/content/secrets'
import { BATCH_A_SECRETS, SUN_POKES_KEY } from '@/content/secrets'
import { setNumber } from '@/engine/state/reducers'

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

/** Resolve an i18n key to its English string (the thin-wiring cast used by every render module). */
const tk = (key: string): string => t(key as GameTextKey)

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
  /** Cross to the photosphere descent port (Act 4 — the finale) — wired by the bootstrap. */
  showDescentPort(): void
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

    // Whether we are looking through the deck's glass rather than at the scaffold itself. A transient view
    // toggle (never persisted) — the deck's one persistent effect (the witnessed star death) lives in the
    // engine's commit-once witnessStarDie. Reset on each entry so the scaffold is always the landing view.
    let viewingDeck = false

    function render(): void {
      ctx.clearScreen()
      const s = session.getState()

      if (viewingDeck) {
        renderDeck(s)
        return
      }

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
      renderStarSea(s)
      renderDeckEntry(s)
      renderDescentPort(s)

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

      // The §18 sun-poke gag: a running-gag button with a hard stop. Once the secret fires, sunPokerFound
      // latches and the button is gone (render runs right after the flag is set) — no farm, the reveal is a
      // one-shot flag, and the deadpan "please stop poking the sun" is the last word.
      if (s.flags['sunPokerFound'] !== true) {
        screen.appendChild(ctx.button('poke the sun', 'scaffold-poke-sun', () => doPokeSun()))
      }
    }

    /** Poke the sun: bump the poke tally and let the countAtLeast secret fire (once) at the tenth poke. */
    function doPokeSun(): void {
      const before = session.getState()
      const pokes = (before.numbers[SUN_POKES_KEY] ?? 0) + 1
      const bumped = setNumber(before, SUN_POKES_KEY, pokes)
      const result = fireAny(bumped, BATCH_A_SECRETS, { kind: 'count', counterKey: SUN_POKES_KEY, count: pokes })
      session.dispatch(() => result.state)
      if (result.fired && result.revealKey) {
        ctx.logText(tk(result.revealKey))
        render()
      }
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

    /**
     * The star sea (the stage-3 reward, §3/§188): the comet's wake made into a harvest. Once the outer
     * bracing is raised (starSeaOpen) you launch count-scaled STAR-TRAWLERS that sweep the field for STARDUST
     * — stardust's first passive source (it came only from catching the comet until now). Shown only when
     * starSeaOpen — before that, nothing here. Surfaces the trawler count + the LIVE stardust/s the fleet
     * sweeps, so the new faucet is legible. The whole machine (count, rate, affordability, the atomic spend)
     * lives in engine/content/starSea + content/sun/starSea; this only draws it.
     */
    function renderStarSea(s: GameState): void {
      if (!starSeaOpen(s)) return

      heading('the star sea', 'scaffold-star-sea')
      paragraph(
        'Out past the bracing the dark is not empty after all. It shimmers — a vast, still field of star-stuff, the wake of the comet you once chased, spread thin across half the sky. Nothing moves in it. The works-master watches it a while. "We sweep it up. It does not seem to mind." You are gathering the last of something dead, to plate the thing you mean to dive in.',
        'blurb',
        'scaffold-star-sea-blurb',
      )

      paragraph(
        `star-trawlers: ${formatCount(trawlerCount(s))}  (+${stardustRate(s).toFixed(2)} stardust/s)`,
        'blurb',
        'scaffold-trawlers',
      )
      const trawlerPrice = `${formatCount(STAR_TRAWLER_CANDY_COST)} candies + ${formatCount(STAR_TRAWLER_CARAMEL_COST)} caramel`
      const buyTrawler = ctx.button(
        `launch a star-sea trawler (${trawlerPrice})`,
        'scaffold-buy-trawler',
        () => doBuildTrawler(),
      )
      if (!canBuildTrawler(s)) {
        buyTrawler.disabled = true
        buyTrawler.classList.add('shop-unaffordable')
      }
      screen.appendChild(buyTrawler)
    }

    /**
     * The entry to the observation deck (the stage-4 reward, §15/§189). Shown only once the observation
     * gantry is raised (deckOpen). One button into the deck's own sub-view; the heavy beat (the scripted
     * star death, the astronomer's turn, the silhouette) lives in renderDeck. Nothing here before stage 4.
     */
    function renderDeckEntry(s: GameState): void {
      if (!deckOpen(s)) return
      heading('the observation deck', 'scaffold-deck-entry')
      paragraph(
        'A long glass runs out from the gantry into the dark past the sun. The astronomer is up here now, the one who sold you the telescope a lifetime ago. He is not talking.',
        'blurb',
        'scaffold-deck-entry-blurb',
      )
      screen.appendChild(
        ctx.button(
          starEaterSighted(s) ? 'the observation deck' : 'look through the glass',
          'scaffold-to-deck',
          () => {
            viewingDeck = true
            render()
          },
        ),
      )
    }

    /**
     * The descent port (the stage-5 reward, §5/§190/§196) — the final section. Shown only once the descent
     * port is raised (descentPortOpen). The cage is closed; the works turns to the one-off peppermint
     * bathysphere (peppermint plating + mint coolant + a caramel hull-seal, all live-sourced by now). Before
     * it is built, a priced build button (canBuildBathysphere); after, the Act-3-complete beat — the Act-4
     * descent hook (act3GateCleared), a ready hatch and a racing counter. The build machine lives in the
     * tested engine (engine/content/bathysphere); this only draws it. The §194 audio cue is NOT fired here.
     */
    function renderDescentPort(s: GameState): void {
      if (!descentPortOpen(s)) return

      heading('the descent port', 'scaffold-descent-port')
      paragraph(DESCENT_PORT_BLURB, 'blurb', 'scaffold-descent-blurb')

      const hatch = doc.createElement('pre')
      hatch.className = 'arena glow-sun'
      hatch.setAttribute('data-testid', 'scaffold-hatch')
      hatch.textContent = DESCENT_HATCH_ART.join('\n')
      screen.appendChild(hatch)

      if (!bathysphereBuilt(s)) {
        paragraph(BATHYSPHERE_PLAN_BLURB, 'blurb', 'scaffold-bathysphere-blurb')
        const price =
          `${formatCount(BATHYSPHERE_PEPPERMINT_COST)} peppermint plating + ` +
          `${formatCount(BATHYSPHERE_MINT_COST)} mint coolant + ` +
          `${formatCount(BATHYSPHERE_CARAMEL_COST)} caramel hull-seal`
        const build = ctx.button(
          `build the peppermint bathysphere (${price})`,
          'scaffold-build-bathysphere',
          () => doBuildBathysphere(),
        )
        if (!canBuildBathysphere(s)) {
          build.disabled = true
          build.classList.add('shop-unaffordable')
        }
        screen.appendChild(build)
        return
      }

      // Built. The Act-3-complete beat — quiet triumph undercut by the racing counter and the thing below.
      paragraph(BATHYSPHERE_BLURB, 'blurb', 'scaffold-bathysphere-built-blurb')
      if (act3GateCleared(s)) {
        heading('Act 3 complete — the descent waits', 'scaffold-act3-complete')
        paragraph(ACT3_COMPLETE_BLURB, 'blurb', 'scaffold-act3-complete-blurb')
        // The crossing into Act 4: down through the hatch to the photosphere descent port (its own screen).
        screen.appendChild(
          ctx.button('out onto the gantry, to the hatch', 'scaffold-to-descent', () => ctx.showDescentPort()),
        )
      }
    }

    /**
     * The observation deck sub-view (§15/§189 — THE emotional core). The live star counter (projectedStars,
     * which now falls faster — the dyson acceleration made visible). The FIRST time the player looks, the
     * scripted star-death plays and witnessStarDie commits ONE star + the sighted flag (commit-once,
     * farm-proof — a second visit shows the static aftermath, never re-fires). The astronomer's grim line is
     * the one place the game states the §15 truth. The eater silhouette resolves nearer the further the cage
     * has come. Pure ASCII; the glow is CSS. Silence here — the only music is saved for Act 4.
     */
    function renderDeck(s: GameState): void {
      heading('the observation deck', 'deck-screen')

      // The one-shot: the first look removes exactly one star and stamps the flag, atomically (the engine
      // refuses to re-fire). We branch the copy on whether THIS render is the first view.
      const firstView = !starEaterSighted(s)
      if (firstView) {
        session.dispatch((st) => witnessStarDie(st))
        ctx.logText('A star you were looking straight at went out. Not dimmed. Gone, the way a candle is gone.')
      }
      const now = session.getState()

      // The live counter — the number that has fallen all game, here where you finally watch it move (and,
      // post-acceleration, move faster). projectedStars reads the accelerated rate automatically.
      paragraph(
        `stars in the sky: ${formatCount(projectedStars(now))}`,
        'blurb',
        'deck-counter',
      )

      // The scripted star-death frames, only on the first view; afterward the glass shows the aftermath.
      const glass = doc.createElement('pre')
      glass.className = 'arena glow-sun'
      glass.setAttribute('data-testid', 'deck-glass')
      glass.textContent = firstView
        ? STAR_DEATH_FRAMES.join('\n')
        : eaterArt(currentStage(now)).join('\n')
      screen.appendChild(glass)

      if (firstView) {
        paragraph(
          'You watched it die. Where it was, there is a shape in the glass now — far off, small, the wrong kind of dark. It was not there a moment ago. You have the cold, certain sense that it is closer than it was.',
          'blurb',
          'deck-first-view',
        )
      } else {
        paragraph(
          'The shape is still there in the glass, out past the sun. It is closer now. It does not seem to be in a hurry. It does not need to be.',
          'blurb',
          'deck-silhouette',
        )
      }

      // The astronomer's turn — the one place the game says it. His grim variant is gated on dysonStage4Done,
      // so on the deck (which only opens at stage 4) it is always the selected line.
      renderAstronomer(now)

      // The dread made plain — but the number stays the only tell, as everywhere else. We name that the
      // counter is falling faster without ever printing the multiplier; the moving number does the rest.
      if (starDescentMultiplier(now) > 1) {
        paragraph(
          'The counter is falling faster than it used to. Something about the scaffold.',
          'blurb',
          'deck-acceleration',
        )
      }

      screen.appendChild(
        ctx.button('back to the scaffold', 'deck-to-scaffold', () => {
          viewingDeck = false
          render()
        }, 0),
      )
    }

    /** The astronomer, speaking on the deck — his highest-priority (grim) variant, resolved by the engine. */
    function renderAstronomer(s: GameState): void {
      const variant = selectVariant(ASTRONOMER_DIALOGUE, s)
      if (!variant) return
      const who = doc.createElement('p')
      who.className = 'speaker'
      who.textContent = `${tk(ASTRONOMER_DIALOGUE.nameKey)}:`
      screen.appendChild(who)
      const speech = doc.createElement('div')
      speech.className = 'dialogue'
      speech.setAttribute('data-testid', 'deck-astronomer')
      for (const lineKey of variant.lines) {
        const line = doc.createElement('p')
        line.className = 'dialogue-line'
        line.textContent = tk(lineKey)
        speech.appendChild(line)
      }
      screen.appendChild(speech)
    }

    /** Pick the eater silhouette for how far the cage has come (a fleck at stage 4, close/edges by 5). */
    function eaterArt(stage: number): readonly string[] {
      return stage >= EATER_CLOSE_AT_STAGE ? EATER_CLOSE : EATER_FAR
    }

    function doBuildTrawler(): void {
      const result = buildTrawler(session.getState())
      if (!result.ok) {
        ctx.notify(
          result.reason === 'locked'
            ? 'the star sea is not open yet — raise the outer bracing.'
            : "you can't afford another trawler yet.",
        )
        return
      }
      session.dispatch(() => result.state)
      ctx.logText('Another trawler drifts out into the shimmer and begins to sweep. A thin glitter of stardust comes home.')
      render()
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

    function doBuildBathysphere(): void {
      const result = buildBathysphere(session.getState())
      if (!result.ok) {
        ctx.notify(
          result.reason === 'locked'
            ? 'the descent port is not open yet — close the cage first.'
            : result.reason === 'alreadyBuilt'
              ? 'the bathysphere is already sealed and waiting.'
              : "you can't seal the bathysphere yet — you are short on plating, coolant, or hull-seal.",
        )
        return
      }
      session.dispatch(() => result.state)
      ctx.logText(
        'The bathysphere is sealed: cold, dark, and ready over the open hatch. The scaffold is finished. The descent waits.',
      )
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

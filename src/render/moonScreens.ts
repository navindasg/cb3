import type { GameSession } from '@/engine/session/gameSession'
import type { GameState } from '@/engine/types/GameState'
import type { EchoCall } from '@/engine/types/defs'
import { formatCount } from '@/engine/number/format'
import { setNumber } from '@/engine/state/reducers'
import { grantItem } from '@/engine/shop/purchase'
import {
  mineStratum,
  upgradePick,
  currentStratum,
  nextPick,
  moonPickTier,
  stratumProgress,
  canMine,
  canUpgradePick,
  wormTunnelsOpen,
} from '@/engine/content/moonStrata'
import {
  echoCall,
  hollowCoreAccessible,
  hollowCoreReached,
  roundSequence,
  hollowRound,
  hollowInput,
} from '@/engine/content/hollowCore'
import {
  plotStar,
  navigationLearned,
  currentCourse,
  lighthouseCourse,
  lighthousePlot,
} from '@/engine/content/lighthouse'
import {
  growGummy,
  gummyVatOpen,
  gummyWormCount,
  gummyMiningRate,
  canGrowGummy,
  fusionUnlocked,
  gummyFusedCount,
  canGrowFused,
  growFusedGummy,
} from '@/engine/content/gummyVat'
import { skyPortOpen } from '@/engine/content/galleonCommission'
import {
  MOON_STRATA,
  MOON_PICKS,
  STARTER_PICK_TIER,
  MOON_PICK_TIER_KEY,
} from '@/content/moon/strata'
import { TARGET_ROUNDS } from '@/content/moon/hollowCore'
import { STAR_FIELD, NAV_COURSES } from '@/content/moon/lighthouse'
import {
  MOLDS,
  FLAVORS,
  GUMMY_CANDY_COST,
  GUMMY_LICORICE_COST,
  GUMMY_FUSED_CANDY_COST,
  GUMMY_FUSED_LICORICE_COST,
  GUMMY_FUSED_SOUR_COST,
} from '@/content/gummy/molds'
import { SHED_SHELL, BRASS_SEXTANT } from '@/content/items/items'
import { MOON_WORM_DEFEATED_FLAG } from '@/content/flags'
import { t } from '@/content/i18n/en'
import type { GameTextKey } from '@/content/i18n/schema'

// The moon screens (Act 1 — the jawbreaker moon, reached by the cotton-candy balloon). A wiring
// sub-module of the DOM bootstrap, sibling to skyScreens/townScreens: it owns NO game logic. The
// strata mining + pick upgrades are pure, tested engine (engine/content/moonStrata) over content
// config (content/moon/strata); this only composes them into DOM and routes clicks. Coverage-
// excluded, Playwright-verified. On arrival the lunar outfitter hands you the starter candy pick.

const tk = (key: string): string => t(key as GameTextKey)

const RESOURCE_LABEL: Record<string, string> = {
  candies: 'candies',
  rockCandy: 'rock candy',
  cottonCandy: 'cotton candy',
  licorice: 'licorice',
}

/** The four hollow-core echo calls and their pure-ASCII glyphs (the directions you call into). */
const ECHO_CALLS: readonly EchoCall[] = ['up', 'down', 'left', 'right']
const ECHO_GLYPH: Record<EchoCall, string> = { up: '^', down: 'v', left: '<', right: '>' }
const echoGlyph = (call: EchoCall): string => ECHO_GLYPH[call]

/** Display name of a lighthouse star by id (the field is small; a lookup is fine). */
const starName = (id: string): string => STAR_FIELD.find((s) => s.id === id)?.name ?? id

/** Render a molds/flavors catalog as one line: available entries described, locked ones listed after.
 * Teaches the molds x flavors shape without claiming the locked half is usable yet. */
function catalogLine<T extends { name: string; available: boolean }>(
  entries: readonly T[],
  describe: (entry: T) => string,
): string {
  const have = entries.filter((e) => e.available).map(describe)
  const locked = entries.filter((e) => !e.available).map((e) => e.name)
  const lockedNote = locked.length > 0 ? `   ${locked.join(', ')} (not yet)` : ''
  return `${have.join(', ')}${lockedNote}`
}

/** The display name of a pick tier (the free starter, then the buyable ladder). */
function pickName(tier: number): string {
  if (tier <= 0) return 'bare hands'
  if (tier === STARTER_PICK_TIER) return tk('moon.pick.candyPick')
  const pick = MOON_PICKS.find((p) => p.tier === tier)
  return pick ? tk(pick.displayKey) : `pick tier ${tier}`
}

function priceText(price: readonly { resource: string; amount: number }[]): string {
  return price.map((l) => `${formatCount(l.amount)} ${RESOURCE_LABEL[l.resource] ?? l.resource}`).join(' + ')
}

export interface MoonContext {
  readonly doc: Document
  readonly screen: HTMLElement
  readonly session: GameSession
  clearScreen(): void
  button(label: string, testid: string, onClick: () => void, accelIndex?: number): HTMLButtonElement
  notify(text: string): void
  logText(text: string): void
  showMap(): void
  /** Launch the moon-worm quest (Quest 4) — wired by the bootstrap to the quest screens. */
  startMoonWorm(): void
  /** Cross to the sky port on the moon's far side (Act 2) — wired by the bootstrap. */
  showSkyPort(): void
}

export interface MoonScreens {
  showMoon(): void
}

/** Wire the jawbreaker-moon screen over a bootstrap host. */
export function createMoonScreens(ctx: MoonContext): MoonScreens {
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

  function showMoon(): void {
    // The lunar outfitter hands every arrival the starter candy pick (one-time, free).
    session.dispatch((s: GameState) =>
      moonPickTier(s) >= STARTER_PICK_TIER ? s : setNumber(s, MOON_PICK_TIER_KEY, STARTER_PICK_TIER),
    )

    function render(): void {
      ctx.clearScreen()
      const s = session.getState()
      heading('the jawbreaker moon', 'moon-screen')
      paragraph(
        'Everyone in the village swore it was cheese. It is a jawbreaker — vast, banded, and very hard. A lunar outfitter has lent you a pick.',
        'blurb',
      )

      paragraph(
        `rock candy: ${formatCount(s.rockCandy.current)}    candies: ${formatCount(s.candies.current)}`,
        'blurb',
        'moon-resources',
      )
      paragraph(`your pick: ${pickName(moonPickTier(s))}`, 'blurb', 'moon-pick')

      renderStratum(s)
      renderOutfitter(s)
      renderLighthouse(s)
      renderWormTunnels(s)
      renderGummyVat(s)
      renderHollowCore(s)
      renderSkyPortEntry(s)

      screen.appendChild(ctx.button('back to the map', 'moon-to-map', () => ctx.showMap(), 0))
    }

    /** The sky port (Act 2, DESIGN §13) — opens on the moon's far side once the Act-1 gate is cleared
     * (celestial navigation + the fishbowl helm). The dedicated sky-port screen owns the commission;
     * this only signposts the crossing and routes the click. */
    function renderSkyPortEntry(s: GameState): void {
      if (!skyPortOpen(s)) return
      heading('the far side', 'moon-skyport-section')
      paragraph(
        'On the moon\'s dark far side, where the lighthouse beam never reaches, scaffolding has gone up against the stars. A shipwright is taking commissions. You can read the sky now, and breathe up here — there is a ship to build.',
        'blurb',
        'moon-skyport-blurb',
      )
      screen.appendChild(ctx.button('cross to the sky port', 'moon-to-skyport', () => ctx.showSkyPort(), 0))
    }

    /** The gummy vat (the gummy army v1, DESIGN §12) — opens once you hold the worm mold. You press
     * worm gummies (mold x licorice flavor) that burrow the moon for a passive rock-candy trickle.
     * The rest of the molds x flavors catalog is shown locked, to teach the shape. Engine owns the
     * growing + the rate; this only draws + routes (the producer feeds rock candy on the tick). */
    function renderGummyVat(s: GameState): void {
      if (!gummyVatOpen(s)) return
      heading('the gummy vat', 'moon-vat-section')
      paragraph(
        'You press gummy into the worm mold. Worked through with a flavor, it takes shape, twitches once, and burrows into the moon — and comes back up with rock candy.',
        'blurb',
        'moon-vat-blurb',
      )
      paragraph(`molds:    ${catalogLine(MOLDS, (m) => `${m.name} (${m.role})`)}`, 'blurb', 'moon-vat-molds')
      paragraph(`flavors:  ${catalogLine(FLAVORS, (f) => `${f.name} (${f.stat})`)}`, 'blurb', 'moon-vat-flavors')

      const count = gummyWormCount(s)
      const fused = gummyFusedCount(s)
      const noun = count === 1 ? 'gummy' : 'gummies'
      paragraph(
        `your burrowers: ${count} licorice worm ${noun}${fused > 0 ? ` + ${fused} sour-fused` : ''} — mining ${gummyMiningRate(s).toFixed(2)} rock candy/sec`,
        'blurb',
        'moon-vat-roster',
      )

      const grow = ctx.button(
        `grow a worm gummy (${GUMMY_CANDY_COST} candies + ${GUMMY_LICORICE_COST} licorice)`,
        'moon-vat-grow',
        () => doGrow(),
        0,
      )
      if (!canGrowGummy(s)) {
        grow.disabled = true
        grow.classList.add('shop-unaffordable')
      }
      screen.appendChild(grow)

      // Flavor fusion (the gummy folk's gift, DESIGN §260) — a two-flavor burrower that mines harder.
      if (fusionUnlocked(s)) {
        const fuse = ctx.button(
          `fuse a sour burrower (${GUMMY_FUSED_CANDY_COST} candies + ${GUMMY_FUSED_LICORICE_COST} licorice + ${GUMMY_FUSED_SOUR_COST} sour)`,
          'moon-vat-fuse',
          () => doGrowFused(),
        )
        if (!canGrowFused(s)) {
          fuse.disabled = true
          fuse.classList.add('shop-unaffordable')
        }
        screen.appendChild(fuse)
      }
    }

    function doGrow(): void {
      const result = growGummy(session.getState())
      if (!result.ok) {
        ctx.notify(
          result.reason === 'noMold'
            ? 'You have no mold to press.'
            : `You need ${GUMMY_CANDY_COST} candies and ${GUMMY_LICORICE_COST} licorice to grow one.`,
        )
        return
      }
      session.dispatch(() => result.state)
      ctx.logText('A licorice worm gummy wriggles free of the mold and burrows into the moon.')
      render()
    }

    function doGrowFused(): void {
      const result = growFusedGummy(session.getState())
      if (!result.ok) {
        ctx.notify(
          result.reason === 'locked'
            ? 'You have not learned flavor fusion yet — the gummy folk teach it, out on the sour planet.'
            : `You need ${GUMMY_FUSED_CANDY_COST} candies, ${GUMMY_FUSED_LICORICE_COST} licorice and ${GUMMY_FUSED_SOUR_COST} sour to fuse one.`,
        )
        return
      }
      session.dispatch(() => result.state)
      ctx.logText('Two flavors fold into one gummy — a sour-fused worm, all teeth. It burrows in hungry.')
      render()
    }

    /** The lunar lighthouse (DESIGN §167) — a landmark visible from the moment you land. The cyclops
     * teaches celestial navigation (the Act-2 galleon prereq) by having you plot courses of stars.
     * The engine owns the puzzle; this only draws + routes. */
    function renderLighthouse(s: GameState): void {
      heading('the lunar lighthouse', 'moon-lighthouse-section')

      if (navigationLearned(s)) {
        paragraph(
          'The cyclops nods you back toward the dark. "You can read the sky now — you will not sail off the edge of it. My grandfather would have liked you." The brass sextant is yours.',
          'blurb',
          'moon-lighthouse-learned',
        )
        return
      }

      paragraph(
        'A lighthouse stands on the grey plain, its beam sweeping across nothing. A cyclops keeps it. "My grandfather kept one by the sea," he says. "Plot me a course off this rock, and I will teach you to read the sky."',
        'blurb',
        'moon-lighthouse-blurb',
      )

      const course = currentCourse(s, NAV_COURSES) ?? []
      const plotted = lighthousePlot(s)
      paragraph(
        `the course:  ${course.map(starName).join(' -> ')}    (course ${lighthouseCourse(s) + 1} of ${NAV_COURSES.length})`,
        'blurb',
        'moon-lighthouse-course',
      )
      paragraph(
        `you have plotted:  ${course.map((id, i) => (i < plotted ? starName(id) : '?')).join(' -> ')}`,
        'blurb',
        'moon-lighthouse-plot',
      )

      for (const star of STAR_FIELD) {
        screen.appendChild(ctx.button(star.name, `moon-lighthouse-${star.id}`, () => doPlot(star.id)))
      }
    }

    function doPlot(starId: string): void {
      const result = plotStar(session.getState(), starId, NAV_COURSES)
      if (!result.ok) return
      session.dispatch(() => result.state)
      if (!result.correct) {
        ctx.notify('The beam wanders off the star. The course is lost — start it again.')
      } else if (result.learned) {
        session.dispatch((st) => grantItem(st, BRASS_SEXTANT))
        ctx.logText('The last star falls into line. The cyclops presses a brass sextant into your hands — you can read the sky now.')
      } else if (result.courseComplete) {
        ctx.logText('The course closes, star to star. The cyclops swings the beam to a fresh set.')
      }
      render()
    }

    /** The hollow core (Quest 5) — surfaces once the moon is mined clean. An echo puzzle: the
     * chamber speaks a growing sequence and you click it back. Solving it opens the warm, empty
     * centre and leaves you a keepsake. The engine owns the puzzle; this only draws + routes. */
    function renderHollowCore(s: GameState): void {
      if (!hollowCoreAccessible(s, MOON_STRATA)) return
      heading('the hollow core', 'moon-hollow-section')

      if (hollowCoreReached(s)) {
        paragraph(
          'You step into the dead centre. The chamber is empty. Spherical. Still, faintly, warm. Something lay coiled here once, and is gone. A curl of shed shell is yours.',
          'blurb',
          'moon-hollow-reached',
        )
        return
      }

      paragraph(
        'The mined-out shaft drops to the moon’s exact centre, into a sphere of perfect dark. You cannot see it. You can hear it. The chamber calls; echo it back.',
        'blurb',
        'moon-hollow-blurb',
      )

      const seq = roundSequence(s)
      const got = hollowInput(s)
      paragraph(
        `the chamber calls:  ${seq.map(echoGlyph).join('  ')}    (round ${hollowRound(s) + 1} of ${TARGET_ROUNDS})`,
        'blurb',
        'moon-hollow-call',
      )
      paragraph(
        `your echo:          ${seq.map((c, i) => (i < got ? echoGlyph(c) : '_')).join('  ')}`,
        'blurb',
        'moon-hollow-echo',
      )

      for (const call of ECHO_CALLS) {
        screen.appendChild(ctx.button(echoGlyph(call), `moon-hollow-${call}`, () => doEcho(call)))
      }
    }

    function doEcho(call: EchoCall): void {
      const result = echoCall(session.getState(), call)
      if (!result.ok) return
      session.dispatch(() => result.state)
      if (!result.correct) {
        ctx.notify('The echo scatters and dies. Start the call again.')
      } else if (result.solved) {
        session.dispatch((st) => grantItem(st, SHED_SHELL))
        ctx.logText('The echoes line up and the dark opens. The chamber is empty, and warm.')
      } else if (result.roundComplete) {
        ctx.logText('The chamber answers, and the echo runs deeper.')
      }
      render()
    }

    /** The moon worm (Quest 4) surfaces once your digging breaks into its tunnels; gone once it's
     * dead, with a note that its mold now doubles your haul. The engine owns both predicates. */
    function renderWormTunnels(s: GameState): void {
      if (!wormTunnelsOpen(s)) return
      heading('the worm tunnels', 'moon-worm-section')
      if (s.flags[MOON_WORM_DEFEATED_FLAG] === true) {
        paragraph(
          'The colossal worm is dead. Its mold is yours — gummy pressed into it digs alongside you, and every dig comes up doubled.',
          'blurb',
          'moon-worm-cleared',
        )
        return
      }
      paragraph(
        'Your digging has broken into a glistening bore-hole, chewed clean through the candy. Something colossal is still in there, eating.',
        'blurb',
        'moon-worm-blurb',
      )
      screen.appendChild(ctx.button('into the worm tunnels', 'moon-worm-enter', () => ctx.startMoonWorm(), 0))
    }

    function renderStratum(s: GameState): void {
      const stratum = currentStratum(s, MOON_STRATA)
      heading('strata mining', 'moon-mining-section')

      if (!stratum) {
        paragraph('You have mined clean through to the hollow core. There is nothing left to break here — for now.', 'blurb', 'moon-depleted')
        return
      }

      paragraph(
        `${tk(stratum.displayKey)} — dug ${stratumProgress(s)} / ${stratum.digsToClear}`,
        'blurb',
        'moon-stratum',
      )

      const canBreak = canMine(s, MOON_STRATA)
      if (!canBreak) {
        paragraph(`Your ${pickName(moonPickTier(s))} just skitters off it. You need a stronger pick.`, 'blurb', 'moon-too-hard')
      }
      const mine = ctx.button('mine', 'moon-mine', () => doMine(), 0)
      if (!canBreak) {
        mine.disabled = true
        mine.classList.add('shop-unaffordable')
      }
      screen.appendChild(mine)
    }

    function doMine(): void {
      const result = mineStratum(session.getState(), MOON_STRATA)
      if (!result.ok) {
        ctx.notify(
          result.reason === 'pickTooWeak'
            ? 'The stratum is too hard for your pick. Upgrade it at the outfitter.'
            : 'There is nothing left to mine here.',
        )
        return
      }
      session.dispatch(() => result.state)
      if (result.advanced) ctx.logText('The stratum gives way — you break through to the layer below.')
      render()
    }

    function renderOutfitter(s: GameState): void {
      const pick = nextPick(s, MOON_PICKS)
      if (!pick) return // already at the top of the pick ladder
      heading('the lunar outfitter', 'moon-outfitter-section')
      paragraph(`next pick: ${tk(pick.displayKey)} — ${priceText(pick.price)}`, 'blurb', 'moon-next-pick')

      const buy = ctx.button('upgrade your pick', 'moon-upgrade-pick', () => doUpgrade())
      if (!canUpgradePick(s, MOON_PICKS)) {
        buy.disabled = true
        buy.classList.add('shop-unaffordable')
      }
      screen.appendChild(buy)
    }

    function doUpgrade(): void {
      const result = upgradePick(session.getState(), MOON_PICKS)
      if (!result.ok) {
        ctx.notify(result.reason === 'maxTier' ? 'You already wield the best pick there is.' : "you can't afford that pick yet.")
        return
      }
      session.dispatch(() => result.state)
      ctx.logText(`The outfitter fits you with a ${pickName(moonPickTier(result.state))}.`)
      render()
    }

    render()
  }

  return { showMoon }
}

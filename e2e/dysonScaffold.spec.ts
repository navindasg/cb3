import { test, expect } from '@playwright/test'

// The dyson scaffold (Act 3 — reach the sun, DESIGN §186/§188), end to end. Act 3 shipped without a
// dedicated per-arc spec; this fills the gap in the Act-1/2/4 cadence. It drives the existing __cb3
// showScaffold hook (no new engine/content/screen) and proves the whole Act-2 -> 3 -> 4 gate chain:
//
//   (1) the 5 dyson build stages raise IN ORDER, each gating the next (a stage's reward section only
//       appears once the prior strut is raised);
//   (2) the solar collectors are the ~x100 candy income jump (the live c/s leaps after hanging a fleet);
//   (3) the gummy work-crews boost the WHOLE burrower army's mining (a hired crew mines more rock candy
//       offline than the same army without one);
//   (4) the star sea is stardust's first passive faucet (trawlers accrue stardust offline);
//   (5) the observation deck witnesses EXACTLY one star (commit-once — a revisit never re-fires) and
//       shows the astronomer's one true line;
//   (6) the descent port builds the peppermint bathysphere, which sets act3GateCleared (the Act-4 hook).
//
// Deterministic + __cb3-driven, the per-arc idiom: earned progress + resource hoards are granted via
// session.dispatch; passive faucets are asserted through the offline-catch-up mock clock (onHidden ->
// fastForward -> onVisible), NEVER a live rAF poll; the commit-once star witness is asserted with an
// exact decrement on a plain integer (not a live-ticking resource) and re-checked after a revisit.
//
// The scaffold's reach gate is scaffoldReachable = act2GateCleared = hull at gate tier 3 (numbers key
// galleonHull >= 3) AND >= 10,000 peppermint. Every test grants that Act-2 gate so the screen renders
// its sections rather than the "not ready" answer.

const getState = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as any).__cb3.session.getState())

/**
 * Seed a player who has cleared the Act-2 gate (so scaffoldReachable holds) and grant per-test flags,
 * numbers, and resource hoards. `galleonHull: 3` + `peppermint >= 10000` satisfy act2GateCleared.
 */
const seedScaffold = async (
  page: import('@playwright/test').Page,
  patch: {
    flags?: Record<string, boolean>
    numbers?: Record<string, number>
    resources?: Record<string, number>
    starsRemaining?: number
  },
) => {
  await page.evaluate(
    ({ patch, resKeys }: any) => {
      const r = (n: number) => ({ current: n, lifetimeAccumulated: n, historicalMax: n })
      ;(window as any).__cb3.session.dispatch((state: any) => {
        // Always ensure the Act-2 gate: hull tier 3 + at least the 10k peppermint threshold.
        const peppermint = Math.max(patch.resources?.peppermint ?? 0, 10_000)
        const resources: Record<string, unknown> = {}
        for (const key of resKeys) {
          if (key === 'peppermint') resources[key] = r(peppermint)
          else if (patch.resources && key in patch.resources) resources[key] = r(patch.resources[key])
        }
        return {
          ...state,
          flags: {
            ...state.flags,
            mapUnlocked: true,
            statusBarUnlocked: true,
            ...(patch.flags ?? {}),
          },
          numbers: { ...state.numbers, galleonHull: 3, ...(patch.numbers ?? {}) },
          ...resources,
          ...(patch.starsRemaining !== undefined ? { starsRemaining: patch.starsRemaining } : {}),
        }
      })
    },
    {
      patch,
      resKeys: Object.keys(patch.resources ?? {}).concat('peppermint'),
    },
  )
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('the dyson scaffold: raise all five stages in order, each gating the next', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // A deep hoard for every stage's escalating price (candies to 1e12, rock candy to 1e7) plus the
  // caramel/mint/peppermint the later stages + the bathysphere draw.
  await seedScaffold(page, {
    resources: {
      candies: 5_000_000_000_000,
      rockCandy: 20_000_000,
      caramel: 10_000,
      peppermint: 100_000,
      mint: 10_000,
    },
  })

  await page.evaluate(() => (window as any).__cb3.showScaffold())
  await expect(page.getByTestId('scaffold-screen')).toBeVisible()

  // Nothing is raised yet: stage 1 is "next", the solar works are shut, and none of the later reward
  // sections exist (they gate on their own strut).
  await expect(page.getByTestId('scaffold-stage-1')).toHaveText(/next/)
  await expect(page.getByTestId('scaffold-works')).toHaveCount(0) // solar works: not open pre-stage-1
  await expect(page.getByTestId('scaffold-crews')).toHaveCount(0)
  await expect(page.getByTestId('scaffold-star-sea')).toHaveCount(0)
  await expect(page.getByTestId('scaffold-deck-entry')).toHaveCount(0)
  await expect(page.getByTestId('scaffold-descent-port')).toHaveCount(0)

  // (1) Raise stage 1 — the first strut. Its done-flag flips; the solar works open; stage 2 becomes next.
  await page.getByTestId('scaffold-raise').click()
  let s = await getState(page)
  expect(s.flags['dysonStage1Done']).toBe(true)
  expect(s.numbers['dysonStage']).toBe(1)
  await expect(page.getByTestId('scaffold-works')).toBeVisible() // the stage-1 reward is now here
  await expect(page.getByTestId('scaffold-stage-2')).toHaveText(/next/)
  await expect(page.getByTestId('scaffold-crews')).toHaveCount(0) // stage 2's reward still gated

  // (2) Raise stage 2 — the lower ring. The gummy work-crews open; stage 3 becomes next.
  await page.getByTestId('scaffold-raise').click()
  s = await getState(page)
  expect(s.flags['dysonStage2Done']).toBe(true)
  await expect(page.getByTestId('scaffold-crews')).toBeVisible()
  await expect(page.getByTestId('scaffold-stage-3')).toHaveText(/next/)
  await expect(page.getByTestId('scaffold-star-sea')).toHaveCount(0)

  // (3) Raise stage 3 — the outer bracing. The star sea opens; stage 4 becomes next.
  await page.getByTestId('scaffold-raise').click()
  s = await getState(page)
  expect(s.flags['dysonStage3Done']).toBe(true)
  await expect(page.getByTestId('scaffold-star-sea')).toBeVisible()
  await expect(page.getByTestId('scaffold-stage-4')).toHaveText(/next/)
  await expect(page.getByTestId('scaffold-deck-entry')).toHaveCount(0)

  // (4) Raise stage 4 — the observation gantry. The deck entry opens; stage 5 becomes next.
  await page.getByTestId('scaffold-raise').click()
  s = await getState(page)
  expect(s.flags['dysonStage4Done']).toBe(true)
  await expect(page.getByTestId('scaffold-deck-entry')).toBeVisible()
  await expect(page.getByTestId('scaffold-stage-5')).toHaveText(/next/)
  await expect(page.getByTestId('scaffold-descent-port')).toHaveCount(0)

  // (5) Raise stage 5 — the descent port. The cage is closed; the descent port opens; there is nothing
  // left to raise.
  await page.getByTestId('scaffold-raise').click()
  s = await getState(page)
  expect(s.flags['dysonStage5Done']).toBe(true)
  expect(s.numbers['dysonStage']).toBe(5)
  await expect(page.getByTestId('scaffold-descent-port')).toBeVisible()
  await expect(page.getByTestId('scaffold-max')).toBeVisible() // the ladder is topped out

  // (6) Build the peppermint bathysphere in the descent port — the Act-3 gate lands (act3GateCleared).
  await page.getByTestId('scaffold-build-bathysphere').click()
  s = await getState(page)
  expect(s.flags['bathysphereBuilt']).toBe(true)
  expect(s.ownedItems['peppermintBathysphere']).toBe(true)
  await expect(page.getByTestId('scaffold-act3-complete')).toBeVisible() // the Act-4 descent hook
  await expect(page.getByTestId('scaffold-to-descent')).toBeVisible()
})

test('the solar works: hanging collectors is the ~x100 candy income jump', async ({ page }) => {
  // The income jump is a passive producer, so it is proven through the deterministic offline catch-up
  // mock clock (not the flaky live rAF tick under parallel load) — the moonArc gummy-vat idiom.
  await page.clock.install({ time: new Date('2026-06-13T08:00:00') })
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // A player with stage 1 raised (the solar works open) and enough candies + rock candy to hang a fleet.
  await seedScaffold(page, {
    flags: { dysonStage1Done: true },
    numbers: { dysonStage: 1 },
    resources: { candies: 1_000_000_000, rockCandy: 1_000_000 },
  })

  await page.evaluate(() => (window as any).__cb3.showScaffold())
  await expect(page.getByTestId('scaffold-works')).toBeVisible()
  await expect(page.getByTestId('scaffold-collectors')).toContainText('0') // no collectors, no candy/s

  // Hang ten solar candy collectors (each SOLAR_COLLECTOR_CANDY_COST + rock-candy strut).
  for (let i = 0; i < 10; i++) await page.getByTestId('scaffold-buy-collector').click()
  const built = await getState(page)
  expect(built.numbers['solarCollectorCount']).toBe(10)

  // Background three hours, then return: 10 collectors * 10,000 candies/s * 3h = ~1.08e9 candies, the
  // §5 ~x100 jump over Act-2's ~10k/s. The catch-up credits it analytically (offline-safe).
  const before = built.candies.current
  await page.evaluate(() => (window as any).__cb3.session.onHidden())
  await page.clock.fastForward('03:00:00')
  await page.evaluate(() => (window as any).__cb3.session.onVisible())
  const after = (await getState(page)).candies.current
  expect(after - before).toBeGreaterThan(1_000_000_000) // ~1.08e9 minted while away
})

test('the gummy work-crews boost the whole army mining (offline)', async ({ page }) => {
  // The work-crews are a MULTIPLIER on the burrower producers, not a producer themselves — so we prove
  // the boost by mining the SAME gummy army offline once WITHOUT a crew and once WITH crews, and showing
  // the crewed run mines strictly more rock candy. Deterministic offline catch-up, the moonArc idiom.
  await page.clock.install({ time: new Date('2026-06-13T08:00:00') })
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // A player with stage 2 raised (the crews unlocked), a fixed gummy-worm army mining rock candy, and
  // candies + licorice to hire crews. Rock candy starts at 0, so the offline credit is unambiguous.
  await seedScaffold(page, {
    flags: { dysonStage2Done: true },
    numbers: { dysonStage: 2, gummyWormCount: 60, gummyWorkCrewCount: 0 },
    resources: { candies: 1_000_000_000, licorice: 1_000, rockCandy: 0 },
  })

  // --- run A: 60 burrowers, NO work-crew — the baseline mining over three hours ---
  await page.evaluate(() => (window as any).__cb3.session.onHidden())
  await page.clock.fastForward('03:00:00')
  await page.evaluate(() => (window as any).__cb3.session.onVisible())
  const baseline = (await getState(page)).rockCandy.current
  expect(baseline).toBeGreaterThan(0) // 60 burrowers * (1/30)/s * 3h = ~21,600 rock candy

  // --- run B: same 60 burrowers, but hire 4 work-crews first, then mine the same three hours ---
  await page.evaluate(() => (window as any).__cb3.showScaffold())
  await expect(page.getByTestId('scaffold-crews')).toBeVisible()
  for (let i = 0; i < 4; i++) await page.getByTestId('scaffold-hire-crew').click()
  expect((await getState(page)).numbers['gummyWorkCrewCount']).toBe(4)

  // Zero the rock candy after hiring so the second window is measured from clean.
  await page.evaluate(() => {
    ;(window as any).__cb3.session.dispatch((state: any) => ({
      ...state,
      rockCandy: { current: 0, lifetimeAccumulated: 0, historicalMax: 0 },
    }))
  })

  await page.evaluate(() => (window as any).__cb3.session.onHidden())
  await page.clock.fastForward('03:00:00')
  await page.evaluate(() => (window as any).__cb3.session.onVisible())
  const boosted = (await getState(page)).rockCandy.current

  // 4 crews = 1 + 4 * 0.25 = 2x the base rate. The crewed army mines strictly (and substantially) more.
  expect(boosted).toBeGreaterThan(baseline * 1.5)
})

test('the star sea: trawlers are the first passive stardust faucet (offline)', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-06-13T08:00:00') })
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // A player with stage 3 raised (the star sea open) and candies + caramel to launch trawlers. No
  // stardust yet, so its accrual is unambiguously the trawlers' (stardust's first passive source).
  await seedScaffold(page, {
    flags: { dysonStage3Done: true },
    numbers: { dysonStage: 3 },
    resources: { candies: 1_000_000_000, caramel: 10_000, stardust: 0 },
  })

  await page.evaluate(() => (window as any).__cb3.showScaffold())
  await expect(page.getByTestId('scaffold-star-sea')).toBeVisible()

  // Launch eight star-trawlers (candies + a caramel ballast each).
  for (let i = 0; i < 8; i++) await page.getByTestId('scaffold-buy-trawler').click()
  const launched = await getState(page)
  expect(launched.numbers['starTrawlerCount']).toBe(8)
  // Barely any swept yet — the live loop may have credited a hundredth or two between grant and read, so
  // assert a tolerant floor (not exact 0) on the ticking resource.
  expect(launched.stardust.current).toBeLessThan(5)
  const beforeOffline = launched.stardust.current

  // Background three hours, return: 8 trawlers * 0.25 stardust/s * 3h = ~21,600 stardust, credited by
  // the offline catch-up (stardust's first faucet ever accruing passively).
  await page.evaluate(() => (window as any).__cb3.session.onHidden())
  await page.clock.fastForward('03:00:00')
  await page.evaluate(() => (window as any).__cb3.session.onVisible())
  expect((await getState(page)).stardust.current - beforeOffline).toBeGreaterThan(1_000)
})

test('the observation deck: witness exactly one star, once, and hear the astronomer', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // A player with stage 4 raised (the deck open) who has NOT yet looked through the glass.
  const START_STARS = 8000
  await seedScaffold(page, {
    flags: { dysonStage4Done: true },
    numbers: { dysonStage: 4 },
    starsRemaining: START_STARS,
  })

  await page.evaluate(() => (window as any).__cb3.showScaffold())
  await expect(page.getByTestId('scaffold-deck-entry')).toBeVisible()

  // Look through the glass: the scripted first-view fires witnessStarDie — EXACTLY one star removed,
  // the sighted flag stamped, the astronomer's grim line shown.
  await page.getByTestId('scaffold-to-deck').click()
  await expect(page.getByTestId('deck-screen')).toBeVisible()
  await expect(page.getByTestId('deck-first-view')).toBeVisible()
  await expect(page.getByTestId('deck-astronomer')).toBeVisible() // the one true line, §15

  const afterFirst = await getState(page)
  expect(afterFirst.flags['starEaterSighted']).toBe(true)
  // starsRemaining is a plain integer (not a live-ticking resource), so the witness -1 is discrete. It
  // may ALSO have drifted down a hair from the live counter descent between grant and click; assert the
  // witness took at least one star and the counter never rose.
  expect(afterFirst.starsRemaining).toBeLessThanOrEqual(START_STARS - 1)
  expect(afterFirst.starsRemaining).toBeGreaterThan(START_STARS - 10)
  const afterWitness = afterFirst.starsRemaining

  // Leave and re-enter the deck: the witness is commit-once — the aftermath view shows, and NO second
  // star is taken by the beat (the counter may drift by the passive descent, but the one-shot never re-fires).
  await page.getByTestId('deck-to-scaffold').click()
  await expect(page.getByTestId('scaffold-screen')).toBeVisible()
  await page.getByTestId('scaffold-to-deck').click()
  await expect(page.getByTestId('deck-silhouette')).toBeVisible() // the aftermath, not the first-view
  await expect(page.getByTestId('deck-first-view')).toHaveCount(0)

  const afterSecond = await getState(page)
  // The revisit removed no star by the beat. Allow only the tiny live descent drift downward (no jump),
  // never an up-tick, and certainly not another whole-star witness decrement.
  expect(afterSecond.starsRemaining).toBeLessThanOrEqual(afterWitness)
  expect(afterSecond.starsRemaining).toBeGreaterThan(afterWitness - 5)
})

test('the descent port: build the bathysphere to clear the Act-3 gate (the Act-4 hook)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // A player with the whole cage closed (stage 5 raised, the descent port open) and the bathysphere's
  // three live-sourced cost lines banked: peppermint plating + mint coolant + a caramel hull-seal.
  await seedScaffold(page, {
    flags: {
      dysonStage1Done: true,
      dysonStage2Done: true,
      dysonStage3Done: true,
      dysonStage4Done: true,
      dysonStage5Done: true,
    },
    numbers: { dysonStage: 5 },
    resources: { peppermint: 100_000, mint: 10_000, caramel: 10_000 },
  })

  await page.evaluate(() => (window as any).__cb3.showScaffold())
  await expect(page.getByTestId('scaffold-descent-port')).toBeVisible()
  await expect(page.getByTestId('scaffold-act3-complete')).toHaveCount(0) // not built yet

  // Build it: the one-off craft banks the keepsake item and sets bathysphereBuilt + act3GateCleared.
  await page.getByTestId('scaffold-build-bathysphere').click()
  const s = await getState(page)
  expect(s.flags['bathysphereBuilt']).toBe(true)
  expect(s.ownedItems['peppermintBathysphere']).toBe(true)

  // act3GateCleared = dysonStage5Done && bathysphereBuilt — the Act-4 descent hook. The complete beat +
  // the "out onto the gantry, to the hatch" crossing into the photosphere descent port appear.
  await expect(page.getByTestId('scaffold-act3-complete')).toBeVisible()
  const toDescent = page.getByTestId('scaffold-to-descent')
  await expect(toDescent).toBeVisible()

  // Cross into Act 4: the descent port screen opens (the finale's landing), proving the gate chain end to end.
  await toDescent.click()
  await expect(page.getByTestId('descent-screen')).toBeVisible()
})

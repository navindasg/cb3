import { test, expect } from '@playwright/test'

// The moon arc (Act 1, Increment 3) — licorice + the cotton-candy balloon + the jawbreaker moon,
// end to end. It proves: (1) the cloud-sheep cotton-candy AND thickened-beanstalk licorice
// producers accrue in the LIVE session (run at ?speed=1000 so the idle trickles are observable in
// seconds — the integration unit tests can't cover); (2) the balloon BUILDS by spending both (the
// cotton-candy sink); (3) the moon's tool-gated strata mining: the candy pick clears the soft
// crust but skitters off the cobalt stratum until the iron pick is bought with the rock candy the
// crust yielded. Progress a real session earns (the elevator, a stocked paddock, a thick stalk) is
// granted via the hook.

const getState = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as any).__cb3.session.getState())

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('the moon arc: cotton candy + licorice flow, build the balloon, mine the moon', async ({ page }) => {
  await page.goto('/?speed=1000')
  await page.getByTestId('ack-opener').click()

  // A player at the top of the sky: elevator unlocked, chrome unlocked, a STOCKED cloud-sheep
  // paddock (50 sheep) and a THICKENED beanstalk (fed past the thicken threshold), plus a deep
  // candy hoard for the moon's pick upgrades.
  await page.evaluate(() => {
    const s = (window as any).__cb3.session
    s.dispatch((state: any) => ({
      ...state,
      flags: {
        ...state.flags,
        beanstalkElevator: true,
        statusBarUnlocked: true,
        mapUnlocked: true,
        beanstalkThickened: true, // the stalk has thickened → licorice cuttings shed
      },
      numbers: { ...state.numbers, cloudSheep: 50, beanstalkCandiesFed: 10_000 },
      candies: { current: 10_000_000, lifetimeAccumulated: 10_000_000, historicalMax: 10_000_000 },
    }))
  })

  // (1) Both new idle resources accrue in the live session (producers wired into the tick).
  await expect
    .poll(() => getState(page).then((s: any) => s.cottonCandy.current >= 500 && s.licorice.current >= 50), {
      timeout: 30_000,
    })
    .toBe(true)

  // (2) Build the balloon in the cumulus commons — it spends cotton candy + licorice.
  await page.evaluate(() => (window as any).__cb3.showCloudCommons())
  await page.getByTestId('build-balloon').click()
  await expect(page.getByTestId('balloon-built')).toBeVisible()
  expect((await getState(page)).flags['balloonBuilt']).toBe(true)

  // (3) Fly to the moon: the lunar outfitter hands you the starter candy pick.
  await page.evaluate(() => (window as any).__cb3.showMoon())
  await expect(page.getByTestId('moon-screen')).toBeVisible()
  await expect(page.getByTestId('moon-pick')).toHaveText('your pick: candy pick')

  // Mine the sugar crust clean (6 digs) — rock candy accrues; then it breaks through to the
  // cobalt stratum, which the candy pick cannot crack.
  for (let i = 0; i < 6; i++) await page.getByTestId('moon-mine').click()
  const afterCrust = await getState(page)
  expect(afterCrust.rockCandy.current).toBe(18) // 3 per dig * 6 digs
  await expect(page.getByTestId('moon-too-hard')).toBeVisible()

  // Upgrade to the iron pick with the rock candy the crust yielded (15 < 18), then the cobalt
  // stratum yields to it.
  await page.getByTestId('moon-upgrade-pick').click()
  await expect(page.getByTestId('moon-pick')).toHaveText('your pick: iron pick')
  await page.getByTestId('moon-mine').click()
  const afterCobalt = await getState(page)
  expect(afterCobalt.numbers['moonPickTier']).toBe(2)
  expect(afterCobalt.rockCandy.current).toBe(18 - 15 + 8) // spent 15 on the pick, +8 from a cobalt dig
})

// The fixed echo the chamber speaks (content/moon/hollowCore.ECHO_SEQUENCE). Rounds 0..3 ask for a
// growing prefix: lengths 2,3,4,5 → 14 correct calls clear the puzzle.
const ECHO_SEQUENCE = ['up', 'right', 'right', 'down', 'left', 'up', 'down', 'left']
const ROUND_LENGTHS = [2, 3, 4, 5]

test('the hollow core: mine clean, echo the chamber, reach the warm centre', async ({ page }) => {
  await page.goto('/?speed=1000')
  await page.getByTestId('ack-opener').click()

  // A player who has mined the moon clean (every stratum cleared, holding the top pick).
  await page.evaluate(() => {
    const s = (window as any).__cb3.session
    s.dispatch((state: any) => ({
      ...state,
      flags: { ...state.flags, balloonBuilt: true, mapUnlocked: true },
      numbers: { ...state.numbers, moonPickTier: 3, moonStratum: 3 }, // 3 strata, all cleared
    }))
  })

  await page.evaluate(() => (window as any).__cb3.showMoon())
  await expect(page.getByTestId('moon-screen')).toBeVisible()
  await expect(page.getByTestId('moon-depleted')).toBeVisible() // mined clean
  await expect(page.getByTestId('moon-hollow-section')).toBeVisible()

  // A wrong call scatters the echo: one correct call then a wrong one resets the round's progress.
  await page.getByTestId(`moon-hollow-${ECHO_SEQUENCE[0]}`).click()
  expect((await getState(page)).numbers['hollowInput']).toBe(1)
  const wrong = ECHO_SEQUENCE[1] === 'up' ? 'down' : 'up'
  await page.getByTestId(`moon-hollow-${wrong}`).click()
  expect((await getState(page)).numbers['hollowInput']).toBe(0) // scattered back to the start

  // Echo every round correctly (lengths 2,3,4,5) — the chamber answers deeper each time.
  for (const len of ROUND_LENGTHS) {
    for (let i = 0; i < len; i++) await page.getByTestId(`moon-hollow-${ECHO_SEQUENCE[i]}`).click()
  }

  // The dead centre opens: the warm empty chamber, the keepsake, the flag.
  await expect(page.getByTestId('moon-hollow-reached')).toBeVisible()
  const solved = await getState(page)
  expect(solved.flags['hollowCoreReached']).toBe(true)
  expect(solved.ownedItems['shedShell']).toBe(true)
})

// The cyclops's courses (content/moon/lighthouse.NAV_COURSES) — plot all three to learn navigation.
const NAV_COURSES = [
  ['lantern', 'anchor'],
  ['wreck', 'lantern', 'hook'],
  ['anchor', 'kettle', 'spoon', 'wreck'],
]

test('the lunar lighthouse: plot the cyclops courses and learn celestial navigation', async ({ page }) => {
  await page.goto('/?speed=1000')
  await page.getByTestId('ack-opener').click()

  // The lighthouse is a landmark visible the moment you land on the moon — no mining prereq.
  await page.evaluate(() => {
    const s = (window as any).__cb3.session
    s.dispatch((state: any) => ({ ...state, flags: { ...state.flags, balloonBuilt: true, mapUnlocked: true } }))
  })
  await page.evaluate(() => (window as any).__cb3.showMoon())
  await expect(page.getByTestId('moon-screen')).toBeVisible()
  await expect(page.getByTestId('moon-lighthouse-section')).toBeVisible()
  await expect(page.getByTestId('moon-lighthouse-blurb')).toBeVisible()

  // A wrong pick loses the course: one correct star, then a wrong one resets the run.
  await page.getByTestId(`moon-lighthouse-${NAV_COURSES[0][0]}`).click()
  expect((await getState(page)).numbers['lighthousePlot']).toBe(1)
  await page.getByTestId('moon-lighthouse-spoon').click() // not next in course 0 → scatter
  expect((await getState(page)).numbers['lighthousePlot']).toBe(0)

  // Plot every course in order — the cyclops swings the beam to a fresh set each time.
  for (const course of NAV_COURSES) {
    for (const starId of course) await page.getByTestId(`moon-lighthouse-${starId}`).click()
  }

  // Navigation learned: the parting line, the sextant keepsake, the galleon-prereq flag.
  await expect(page.getByTestId('moon-lighthouse-learned')).toBeVisible()
  const learned = await getState(page)
  expect(learned.flags['celestialNavigationLearned']).toBe(true)
  expect(learned.ownedItems['brassSextant']).toBe(true)
})

test('the gummy vat: press a worm gummy that mines rock candy (incl. offline)', async ({ page }) => {
  // The passive trickle is driven by the resource-agnostic offline catch-up — a deterministic mock-
  // clock check (not the rAF tick, which throttles flakily when many pages run in parallel).
  await page.clock.install({ time: new Date('2026-06-13T08:00:00') })
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // A player holding the worm mold (the Quest-4 drop opens the vat), with candies + licorice to press
  // gummies and no rock candy yet — so the burrower's credit is unambiguous.
  await page.evaluate(() => {
    const s = (window as any).__cb3.session
    s.dispatch((state: any) => ({
      ...state,
      flags: { ...state.flags, balloonBuilt: true, mapUnlocked: true, wormMoldOwned: true },
      ownedItems: { ...state.ownedItems, wormMold: true },
      candies: { current: 1000, lifetimeAccumulated: 1000, historicalMax: 1000 },
      licorice: { current: 50, lifetimeAccumulated: 50, historicalMax: 50 },
      rockCandy: { current: 0, lifetimeAccumulated: 0, historicalMax: 0 },
    }))
  })

  await page.evaluate(() => (window as any).__cb3.showMoon())
  await expect(page.getByTestId('moon-screen')).toBeVisible()
  await expect(page.getByTestId('moon-vat-section')).toBeVisible()

  // Press a worm gummy — the count rises and candies + licorice are spent.
  await page.getByTestId('moon-vat-grow').click()
  const grown = await getState(page)
  expect(grown.numbers['gummyWormCount']).toBe(1)
  // The grow spends 50 candies; the live base candy producer may have ticked a few hundredths on top
  // between the grant and the click, so assert a tolerant floor (not exact equality on a ticking value).
  expect(grown.candies.current).toBeGreaterThanOrEqual(1000 - 50)
  expect(grown.candies.current).toBeLessThan(1000 - 50 + 5)
  expect(grown.licorice.current).toBe(50 - 1) // licorice does not tick here (beanstalk not thickened)
  expect(grown.rockCandy.current).toBe(0) // none yet

  // Background, three hours pass, return: the burrower's rock candy is credited offline (the producer
  // is wired into the resource-agnostic catch-up). 1 gummy * (1/30)/s * 3h = ~360 rock candy.
  await page.evaluate(() => (window as any).__cb3.session.onHidden())
  await page.clock.fastForward('03:00:00')
  await page.evaluate(() => (window as any).__cb3.session.onVisible())
  const after = await getState(page)
  expect(after.rockCandy.current).toBeGreaterThan(100)
})

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

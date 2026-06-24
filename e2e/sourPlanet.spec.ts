import { test, expect } from '@playwright/test'

// The sour planet & the gummy folk (Act 2 — quest 9, DESIGN §181/§260), end to end. It proves the full
// flavor-fusion loop: (1) once the reef has been sailed, the launched sky port offers "sail to the sour
// planet"; (2) the gummy folk elder teaches FLAVOR FUSION (the flag) and (3) trades candies for the new
// SOUR essence; (4) back at the moon's gummy vat, the learned fusion unlocks growing a SOUR-FUSED
// burrower (worm x licorice + sour), which mines rock candy faster. Earned progress + the worm mold (the
// vat) + a candy stock are granted via the test hook.

const getState = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as any).__cb3.session.getState())

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('the gummy folk: learn fusion, trade for sour, and fuse a sour burrower at the vat', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // A player who has commissioned the galleon, sailed the reef, holds the worm mold (the vat), and has a
  // candy stock + a little licorice to fuse with.
  await page.evaluate(() => {
    ;(window as any).__cb3.session.dispatch((state: any) => ({
      ...state,
      flags: {
        ...state.flags,
        mapUnlocked: true,
        statusBarUnlocked: true,
        celestialNavigationLearned: true,
        fishbowlHelmForged: true,
        galleonCommissioned: true,
        reefReached: true,
        wormMoldOwned: true, // the gummy vat is open
      },
      strings: { ...state.strings, galleonName: 'the Sweet Tooth' },
      candies: { current: 50_000, lifetimeAccumulated: 50_000, historicalMax: 50_000 },
      licorice: { current: 20, lifetimeAccumulated: 20, historicalMax: 20 },
    }))
  })

  // (1) From the launched sky port, sail to the sour planet.
  await page.evaluate(() => (window as any).__cb3.showSkyPort())
  await expect(page.getByTestId('skyport-launched')).toBeVisible()
  await page.getByTestId('skyport-to-sour').click()
  await expect(page.getByTestId('sour-screen')).toBeVisible()
  await expect(page.getByTestId('sour-firstcontact')).toBeVisible()

  // (2) Learn flavor fusion from the elder.
  await page.getByTestId('sour-learn-fusion').click()
  expect((await getState(page)).flags['flavorFusionLearned']).toBe(true)
  await expect(page.getByTestId('sour-elder')).toBeVisible() // first-contact -> familiar

  // (3) Trade candies for sour essence.
  await page.getByTestId('sour-trade').click()
  expect((await getState(page)).sour.current).toBeGreaterThan(0)

  // (4) Back at the moon's gummy vat, fuse a sour burrower.
  await page.evaluate(() => (window as any).__cb3.showMoon())
  await expect(page.getByTestId('moon-vat-section')).toBeVisible()
  await page.getByTestId('moon-vat-fuse').click()
  const after = await getState(page)
  expect(after.numbers['gummyFusedCount']).toBe(1)
  expect(after.sour.current).toBeLessThan(5) // a sour essence was spent fusing
})

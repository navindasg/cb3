import { test, expect } from '@playwright/test'

// The mint planet (Act 2 — quest 10, the act capstone, DESIGN §182/§184), end to end. It proves:
// (1) once the reef has been sailed, the launched sky port offers "sail to the mint planet"; (2) the ice
// labyrinth is a "follow the cold" maze — taking the coldest passage in each room reaches the frozen
// heart; (3) the frost wyrm is freed there (a flag), opening the peppermint fields; (4) peppermint is
// mined by condensers built from rock candy + candies; (5) the §184 Act-2 gate readout closes once a
// tier-3 hull + 10k peppermint are in hand. Earned progress is granted via the test hook.

const getState = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as any).__cb3.session.getState())

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('the mint planet: thread the labyrinth, free the wyrm, mine peppermint, close the Act-2 gate', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

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
      },
      strings: { ...state.strings, galleonName: 'the Sweet Tooth' },
      rockCandy: { current: 5_000, lifetimeAccumulated: 5_000, historicalMax: 5_000 },
      candies: { current: 1_000_000, lifetimeAccumulated: 1_000_000, historicalMax: 1_000_000 },
    }))
  })

  // (1) From the launched sky port, sail to the mint planet.
  await page.evaluate(() => (window as any).__cb3.showSkyPort())
  await expect(page.getByTestId('skyport-launched')).toBeVisible()
  await page.getByTestId('skyport-to-mint').click()
  await expect(page.getByTestId('mint-screen')).toBeVisible()
  await expect(page.getByTestId('mint-room')).toBeVisible()

  // (2) Thread the labyrinth: follow the coldest passage (data-coldest) in each room to the heart.
  let reachedWyrm = false
  for (let i = 0; i < 12; i++) {
    if (await page.getByTestId('mint-wyrm').isVisible().catch(() => false)) {
      reachedWyrm = true
      break
    }
    const cold = await page.getByTestId('mint-hint').getAttribute('data-coldest')
    await page.getByTestId(`mint-passage-${cold}`).click()
  }
  expect(reachedWyrm).toBe(true)

  // (3) Free the frost wyrm — opens the peppermint fields.
  await page.getByTestId('mint-free-wyrm').click()
  expect((await getState(page)).flags['frostWyrmFreed']).toBe(true)
  await expect(page.getByTestId('mint-fields')).toBeVisible()

  // (4) Build a condenser (peppermint mining begins).
  await page.getByTestId('mint-build-condenser').click()
  expect((await getState(page)).numbers['peppermintCondensers']).toBe(1)

  // (5) The Act-2 gate readout closes with a tier-3 hull + 10k peppermint banked.
  await expect(page.getByTestId('mint-gate')).toBeVisible()
  await page.evaluate(() => {
    ;(window as any).__cb3.session.dispatch((state: any) => ({
      ...state,
      numbers: { ...state.numbers, galleonHull: 3 },
      peppermint: { current: 10_000, lifetimeAccumulated: 10_000, historicalMax: 10_000 },
    }))
  })
  await page.evaluate(() => (window as any).__cb3.showSkyPort())
  await page.getByTestId('skyport-to-mint').click()
  await expect(page.getByTestId('mint-act-complete')).toBeVisible()
})

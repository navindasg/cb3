import { test, expect } from '@playwright/test'

// The observatory (atop the mountain) + its cauldron basement (Act 0, Step 4b). The astronomer
// sells the telescope (which reveals the never-mentioned star counter) and the beginner's grimoire
// (which makes spells castable). Downstairs, the cauldron brews syrup of health from a precise
// action sequence. We hand the player the candy + a lollipop a real run would have, then drive it.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

const flag = (page: import('@playwright/test').Page, name: string) =>
  page.evaluate((n) => (window as any).__cb3.session.getState().flags[n], name)

test('observatory: buy the telescope + grimoire, then brew syrup in the cauldron', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // Enough candy for the telescope (800) + grimoire (150) + a candy to brew, plus one lollipop.
  await page.evaluate(() => {
    const s = (window as any).__cb3.session
    s.dispatch((st: any) => ({
      ...st,
      candies: { current: 2000, lifetimeAccumulated: 2000, historicalMax: 2000 },
      lollipops: { current: 1, lifetimeAccumulated: 1, historicalMax: 1 },
    }))
    ;(window as any).__cb3.showObservatory()
  })
  await expect(page.getByTestId('observatory-screen')).toBeVisible()

  // Buy the telescope → the star counter unlocks (telescopeOwned).
  await page.getByTestId('buy-telescope').click()
  await expect.poll(() => flag(page, 'telescopeOwned')).toBe(true)

  // Buy the grimoire → spells become castable (beginnerGrimoireOwned).
  await page.getByTestId('buy-beginnerGrimoire').click()
  await expect.poll(() => flag(page, 'beginnerGrimoireOwned')).toBe(true)

  // Down to the cauldron: add candy → stir → heat → add lollipop, then brew the syrup of health.
  await page.getByTestId('obs-cauldron').click()
  await expect(page.getByTestId('cauldron-screen')).toBeVisible()
  await page.getByTestId('cauldron-add-candy').click()
  await page.getByTestId('cauldron-stir').click()
  await page.getByTestId('cauldron-heat').click()
  await page.getByTestId('cauldron-add-lollipop').click()
  await page.getByTestId('cauldron-brew').click()

  await expect.poll(() => flag(page, 'knowsSyrupOfHealth')).toBe(true)
  const chocolate = await page.evaluate(
    () => (window as any).__cb3.session.getState().chocolate.current,
  )
  expect(chocolate).toBeGreaterThanOrEqual(1)
})

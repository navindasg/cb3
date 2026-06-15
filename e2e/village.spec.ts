import { test, expect } from '@playwright/test'

// The village hub + the forge (Act 0 rework, Step 4b). Reaching the village reveals the mines +
// mountain on the overworld (the villageReached flag), and the forge sells a VARIED arsenal — not
// a sword ladder — including a ranged candy-cane bow. We give the player the spoon + candy a real
// session would have earned (grandma's grant + idle income) via the test hook rather than grinding.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('entering the village reveals the mines/mountain and opens the forge', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // A real player owns grandma's spoon and some candy by the time they reach the village; hand
  // those over so the forge unlocks (gated on spoonOwned) and a weapon is affordable.
  await page.evaluate(() => {
    const s = (window as any).__cb3.session
    s.dispatch((state: any) => ({
      ...state,
      flags: { ...state.flags, spoonOwned: true },
      ownedItems: { ...state.ownedItems, woodenSpoon: true },
      candies: { current: 5000, lifetimeAccumulated: 5000, historicalMax: 5000 },
    }))
  })

  // Walk into the village.
  await page.evaluate(() => (window as any).__cb3.showVillage())
  await expect(page.getByTestId('village-screen')).toBeVisible()

  // Reaching it reveals the downstream regions (their overworld revealFlag).
  await expect
    .poll(() => page.evaluate(() => (window as any).__cb3.session.getState().flags['villageReached']))
    .toBe(true)

  // Into the forge: the varied arsenal is on offer, including the ranged bow.
  await page.getByTestId('village-forge').click()
  await expect(page.getByTestId('forge-screen')).toBeVisible()
  await expect(page.getByTestId('buy-candyCaneBow')).toBeVisible()

  // Buy the bow; it becomes owned (and auto-equipped) and the row flips to "owned".
  await page.getByTestId('buy-candyCaneBow').click()
  await expect(page.getByTestId('shop-row-candyCaneBow')).toContainText('owned')

  const owned = await page.evaluate(
    () => (window as any).__cb3.session.getState().ownedItems['candyCaneBow'],
  )
  expect(owned).toBe(true)
})

import { test, expect, type Page } from '@playwright/test'

// Cold start: the very first thing the series ever says, and the bare opening screen. A fresh
// visitor (cleared storage) must see "You have 1 candy." Then the field reveals its controls
// progressively (CB2's ratchet): "eat" from the first candy, "throw" only once you have ever
// held ten. The map and status bar are NOT there yet — they are requested later. And there is
// no secret input in plain sight (secrets are discovered, never shown).

type Win = {
  __cb3: {
    session: {
      getState(): { candies: { current: number } }
      dispatch(fn: (s: unknown) => unknown): void
    }
  }
}

const setHistoricalMax = (page: Page, n: number) =>
  page.evaluate((max) => {
    const s = (window as unknown as Win).__cb3.session
    s.dispatch((st) => ({
      ...(st as object),
      candies: { current: max, lifetimeAccumulated: max, historicalMax: max },
    }))
  }, n)

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('cold start shows the opening line', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('opening-line')).toHaveText('You have 1 candy.')
})

test('the field reveals only the cold-start controls; throw and map are still locked', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()
  await expect(page.getByTestId('eat-candy')).toBeVisible()
  await expect(page.getByTestId('enter-house')).toBeVisible()
  // Throw needs a high-water mark of ten; the map is a requested feature — neither is here yet.
  await expect(page.getByTestId('throw-candy')).toHaveCount(0)
  await expect(page.getByTestId('open-map')).toHaveCount(0)
  // The status bar is hidden until it is requested.
  await expect(page.locator('#status-bar')).toBeHidden()
})

test('throw appears once the candy high-water mark reaches ten', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()
  await setHistoricalMax(page, 10)
  await expect(page.getByTestId('throw-candy')).toBeVisible()
})

test('there is no secret input in plain sight (secrets are hidden)', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('input.secret-input')).toHaveCount(0)
  await expect(page.locator('input')).toHaveCount(0)
})

import { test, expect } from '@playwright/test'

// The DEV-only "reset save" must actually wipe the save. The subtlety it guards: reloading fires
// visibilitychange→hidden, whose handler saves — so a naive clear()+reload re-persists the very
// state it just cleared. Reset must tear the lifecycle listeners down first. There is deliberately
// NO localStorage.clear() init script here (Playwright already gives each test a clean context),
// so the reload genuinely exercises reset's own clearing.

test('reset save wipes progress and returns to the cold open', async ({ page }) => {
  await page.goto('/?speed=1000')

  // Make progress and leave the opener, so a warm state exists in memory (openerSeen=true).
  await page.getByTestId('ack-opener').click()
  await expect(page.getByTestId('eat-candy')).toBeVisible()
  // Unlock the map feature, then navigate to it (the map is a requested feature now).
  await page.evaluate(() => {
    const s = (window as unknown as { __cb3: { session: { dispatch(fn: (s: unknown) => unknown): void } } }).__cb3.session
    s.dispatch((st) => ({ ...(st as object), flags: { ...(st as { flags: object }).flags, mapUnlocked: true } }))
  })
  await page.getByTestId('open-map').click()

  // Reset must land back on the COLD open (not the warm map) with a single candy.
  await page.getByTestId('dev-reset').click()
  await expect(page.getByTestId('opening-line')).toBeVisible()
  await expect(page.getByTestId('ack-opener')).toBeVisible()
  const candies = await page.evaluate(
    () => (window as unknown as { __cb3: { session: { getState(): { candies: { current: number } } } } }).__cb3.session.getState().candies.current,
  )
  expect(candies).toBe(1)
})

import { test, expect } from '@playwright/test'

// Offline catch-up: the single most load-bearing correctness path. The tab backgrounds, hours
// of wall-clock pass (Playwright's mock clock fast-forwards Date.now), the tab returns, and the
// candies that would have been produced are credited analytically. A clock rollback credits
// nothing. We drive the documented background→fast-forward→return cycle.

test('background → advance the clock hours → return credits offline candies', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-06-13T08:00:00') })
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')
  await page.getByTestId('ack-opener').click() // your field already trickles 0.5 candy/s

  const start = await page.evaluate(() => (window as any).__cb3.session.getState().candies.current)

  // Background the tab: persists lastTick at the current (mock) wall clock.
  await page.evaluate(() => (window as any).__cb3.session.onHidden())

  // Three hours pass while away.
  await page.clock.fastForward('03:00:00')

  // Return: credit the gap. 0.5 candy/s * 3h = 5400 candies.
  await page.evaluate(() => (window as any).__cb3.session.onVisible())

  const after = await page.evaluate(() => (window as any).__cb3.session.getState().candies.current)
  expect(after - start).toBeGreaterThanOrEqual(5300) // ~5400, allow for the live loop's trickle
})

test('a clock rollback credits nothing (no minting candies)', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-06-13T08:00:00') })
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // Save at "now", then move the clock BACKWARD before returning.
  const baseline = await page.evaluate(() => {
    const s = (window as any).__cb3.session
    s.onHidden()
    return s.getState().candies.current
  })
  await page.clock.setFixedTime(new Date('2026-06-13T06:00:00')) // two hours earlier
  const after = await page.evaluate(() => {
    const s = (window as any).__cb3.session
    s.onVisible()
    return s.getState().candies.current
  })
  // No catch-up windfall from the rollback (the live trickle may add a hair; assert no jump).
  expect(after).toBeLessThan(baseline + 5)
})

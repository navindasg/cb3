import { test, expect } from '@playwright/test'

// The Schrödinger box ×2 (ADR §5.2): closing the box doubles offline production, and the
// multiplier lives ONLY in the catch-up math — never surfaced in any readout. We verify it
// while the player is questing (the climb is mounted): the box still doubles the away-time
// candies, and the candy counter never spells out the multiplier.

test('a closed box doubles offline candies, even while questing, and never says so', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-06-13T08:00:00') })
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // Close the box and give the player a feeding stock; start the vertical climb quest.
  await page.evaluate(() => {
    const s = (window as any).__cb3.session
    s.dispatch((state: any) => ({ ...state, boxClosed: true }))
    ;(window as any).__cb3.startClimb()
  })
  await expect(page.getByTestId('climb-status')).toBeVisible()

  const start = await page.evaluate(() => (window as any).__cb3.session.getState().candies.current)

  // Background for two hours while the quest is mounted, then return.
  await page.evaluate(() => (window as any).__cb3.session.onHidden())
  await page.clock.fastForward('02:00:00')
  await page.evaluate(() => (window as any).__cb3.session.onVisible())

  const after = await page.evaluate(() => (window as any).__cb3.session.getState().candies.current)
  // 0.5 candy/s * 7200s * 2 (box) = 7200 candies; without the box it would be ~3600.
  expect(after - start).toBeGreaterThanOrEqual(7000)

  // The box ×2 must never be surfaced: no readout text mentions a multiplier.
  const statusText = (await page.locator('#status-bar').textContent()) ?? ''
  expect(statusText).not.toMatch(/x2|×2|box|double/i)
})

import { test, expect } from '@playwright/test'

// The cumulus commons (Act 1, Increment 1) — the cloud village at the top of the beanstalk, and
// the cotton-candy economy. Reaching it (the beanstalk elevator carries you up) surfaces the
// cotton-candy readout in the status bar; the cloud-sheep paddock is the new passive income —
// each sheep grazes a trickle of cotton candy. We run the sim at ?speed=1000 so the trickle is
// observable in seconds (it proves the producer is wired into the live session, not just unit-
// tested in isolation). The player's progress (elevator unlocked, candy banked) is granted via the
// test hook rather than replaying all of Act 0.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('the cumulus commons: stock the paddock and watch cotton candy flow', async ({ page }) => {
  await page.goto('/?speed=1000')
  await page.getByTestId('ack-opener').click()

  // A player reaching the sky has climbed the beanstalk (the elevator flag) and unlocked the
  // chrome (status bar) earlier in Act 0; hand those over, plus a sky-sized candy hoard.
  await page.evaluate(() => {
    const s = (window as any).__cb3.session
    s.dispatch((state: any) => ({
      ...state,
      flags: {
        ...state.flags,
        beanstalkElevator: true,
        statusBarUnlocked: true,
        mapUnlocked: true,
      },
      candies: { current: 1_000_000, lifetimeAccumulated: 1_000_000, historicalMax: 1_000_000 },
    }))
  })

  // Ride up to the cloud village.
  await page.evaluate(() => (window as any).__cb3.showCloudCommons())
  await expect(page.getByTestId('cloud-commons-screen')).toBeVisible()

  // Reaching it surfaces the cotton-candy readout in the status bar (the one-time reach flag).
  await expect
    .poll(() => page.evaluate(() => (window as any).__cb3.session.getState().flags['cloudCommonsReached']))
    .toBe(true)
  await expect(page.locator('[data-region="cottonCandy"]')).toBeVisible()

  // The paddock starts empty.
  await expect(page.getByTestId('sheep-count')).toHaveText('cloud sheep: 0')

  // Buy a cloud sheep: the head-count climbs and the candy is spent.
  const before = await page.evaluate(
    () => (window as any).__cb3.session.getState().candies.current,
  )
  await page.getByTestId('buy-cloud-sheep').click()
  await expect(page.getByTestId('sheep-count')).toHaveText('cloud sheep: 1')
  const after = await page.evaluate(
    () => (window as any).__cb3.session.getState().candies.current,
  )
  expect(after).toBeLessThan(before)

  // The single grazing sheep produces cotton candy in the LIVE session (producer wired into the
  // tick) — at ?speed=1000 the trickle becomes visible within seconds.
  await expect
    .poll(
      () => page.evaluate(() => (window as any).__cb3.session.getState().cottonCandy.current),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0)
})

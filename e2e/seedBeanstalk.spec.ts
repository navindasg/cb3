import { test, expect } from '@playwright/test'

// Act 0 → seed pivot → beanstalk climb, end to end. This is the raison d'être of Phase 1:
// the moment the game becomes itself. We arm the seed gate (telescope + lifetime candies),
// let the lifecycle pass fire the seed event, plant + feed the beanstalk to the clouds, then
// drive the first VerticalDriver quest to the top, which converts it into a fast-travel
// elevator. We give the player the candy a real session would have earned via the test hook,
// rather than idling for the full grind.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('Act 0 → seed event → beanstalk climb completes and unlocks the elevator', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // Arm the seed gate (telescope + lifetime candies) via the test hook; the next lifecycle pass
  // fires the event (seed lands + appears). "scan the sky" is no longer a cold-start button.
  await page.evaluate(() => (window as any).__cb3.armSeed())
  await page.waitForFunction(() => (window as any).__cb3.session.getState().flags['seedPresent'] === true)

  // Hand the player enough candy to feed the beanstalk past the cloud threshold.
  await page.evaluate(() => {
    const s = (window as any).__cb3.session
    s.dispatch((state: any) => ({
      ...state,
      candies: { current: 2000, lifetimeAccumulated: 52000, historicalMax: 52000 },
    }))
  })

  // Walk into the garden, plant, then feed to the clouds.
  await page.evaluate(() => (window as any).__cb3.showGarden())
  await page.getByTestId('plant-seed').click()
  await page.getByTestId('feed-beanstalk').click()
  await page.waitForFunction(
    () => (window as any).__cb3.session.getState().flags['beanstalkReachedClouds'] === true,
  )

  // The vertical climb quest: drive it to the top.
  await page.evaluate(() => (window as any).__cb3.startClimb())
  await expect(page.getByTestId('climb-status')).toHaveText('reached the top', { timeout: 15_000 })

  // Reaching the top permanently sets the beanstalk-elevator fast-travel flag.
  const elevator = await page.evaluate(
    () => (window as any).__cb3.session.getState().flags['beanstalkElevator'],
  )
  expect(elevator).toBe(true)
})

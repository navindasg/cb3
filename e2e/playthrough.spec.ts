import { test, expect, type Page } from '@playwright/test'

// The full Phase 1 playthrough, as a SCRIPT (so a complete run is reproducible without manual
// clicking). It walks the real player journey for the reworked Act 0:
//   cold open → field → enter the house (grandma gives the wooden spoon) → eat candies →
//   request the status bar → a health bar → the map (the progressive GUI unlock) → eat to raise
//   HP → open the map → click a not-yet-built location → arm the seed → the beanstalk garden →
//   feed to the clouds → climb the beanstalk to the top → the elevator unlock.
// Every step asserts the game actually responded, and a numbered screenshot is captured at each
// beat into e2e/screens/, so this doubles as the Phase 1 regression harness + the visual record.
//
// Run: pnpm test:e2e playthrough   (screenshots land in e2e/screens/NN-*.png)

type Win = {
  __cb3: {
    session: {
      getState(): {
        flags: Record<string, boolean>
        candies: { current: number }
        playerHpCurrent: number
      }
      dispatch(fn: (s: unknown) => unknown): void
    }
    armSeed(): void
    showGarden(): void
  }
}

let shot = 0
async function capture(page: Page, name: string): Promise<void> {
  shot += 1
  const n = String(shot).padStart(2, '0')
  await page.screenshot({ path: `e2e/screens/${n}-${name}.png`, fullPage: true })
}

const state = (page: Page) => page.evaluate(() => (window as unknown as Win).__cb3.session.getState())

/** Hand the player a candy stock (and high-water mark), the way an idle run would have earned it. */
const giveCandies = (page: Page, current: number, max = current) =>
  page.evaluate(
    ({ current, max }) => {
      const s = (window as unknown as Win).__cb3.session
      s.dispatch((st) => ({
        ...(st as object),
        candies: { current, lifetimeAccumulated: max, historicalMax: max },
      }))
    },
    { current, max },
  )

test.beforeEach(async ({ page }) => {
  shot = 0
  await page.addInitScript(() => localStorage.clear())
})

test('full Phase 1 playthrough: opener → house → GUI unlock → map → seed → climb', async ({
  page,
}) => {
  test.setTimeout(60_000)

  // --- 1. the cold open ----------------------------------------------------------------------
  await page.goto('/')
  await expect(page.getByTestId('opening-line')).toBeVisible()
  await capture(page, 'opener')

  await page.getByTestId('ack-opener').click()
  await expect(page.getByTestId('eat-candy')).toBeVisible()
  await expect(page.getByTestId('enter-house')).toBeVisible()
  await capture(page, 'field-coldstart')

  // --- 2. the house: grandma presses the wooden spoon into your hands ------------------------
  await page.getByTestId('enter-house').click()
  await expect(page.getByTestId('grandma-dialogue')).toBeVisible()
  await capture(page, 'house-grandma')
  await page.waitForFunction(() => (window as unknown as Win).__cb3.session.getState().flags['spoonOwned'] === true)
  expect((await state(page)).flags['metGrandma']).toBe(true)
  await page.getByTestId('house-to-field').click()
  await expect(page.getByTestId('eat-candy')).toBeVisible()

  // --- 3. the progressive GUI unlock: status bar → health bar → map --------------------------
  await giveCandies(page, 60) // enough for all three requests (30 + 5 + 10)
  // The request button appears once the high-water mark reaches 30.
  await expect(page.getByTestId('request-feature')).toBeVisible()
  await capture(page, 'request-statusbar')

  await page.getByTestId('request-feature').click() // status bar (30)
  await expect(page.locator('#status-bar')).toBeVisible()
  await expect(page.locator('[data-region="candy"]')).toBeVisible()
  await capture(page, 'statusbar-unlocked')

  await page.getByTestId('request-feature').click() // health bar (5)
  await expect(page.locator('[data-region="hp"]')).toBeVisible()

  await page.getByTestId('request-feature').click() // the map (10)
  await expect(page.getByTestId('open-map')).toBeVisible()
  await expect(page.getByTestId('request-feature')).toHaveCount(0) // all features unlocked
  await capture(page, 'all-unlocked')

  // --- 4. eating candies raises HP (visibly, now that the health bar is up) ------------------
  await page.evaluate(() => {
    const s = (window as unknown as Win).__cb3.session
    s.dispatch((st) => ({ ...(st as object), playerHpCurrent: 3 }))
  })
  await giveCandies(page, 4, 60) // keep the high-water mark; 4 to eat
  const hpBefore = (await state(page)).playerHpCurrent
  await page.getByTestId('eat-candy').click()
  await expect.poll(async () => (await state(page)).playerHpCurrent).toBeGreaterThan(hpBefore)
  await expect(page.locator('[data-region="hp"] .status-value')).toContainText('/')
  await capture(page, 'ate-to-heal')

  // --- 5. the map renders and a not-yet-built location responds visibly ----------------------
  await page.getByTestId('open-map').click()
  await expect(page.locator('.map-surface')).toBeVisible()
  await page.locator('.map-zone', { hasText: 'the forest' }).click()
  await expect(page.getByTestId('toast')).toContainText('not open yet')
  await capture(page, 'map-location-notice')

  // --- 6. arm the seed pivot, then plant + feed the beanstalk to the clouds -------------------
  await page.locator('.map-zone', { hasText: 'your field' }).click()
  await expect(page.getByTestId('eat-candy')).toBeVisible()
  await page.evaluate(() => (window as unknown as Win).__cb3.armSeed())
  await page.waitForFunction(() => (window as unknown as Win).__cb3.session.getState().flags['seedPresent'] === true)
  await giveCandies(page, 2000, 52000)

  await page.evaluate(() => (window as unknown as Win).__cb3.showGarden())
  await expect(page.getByTestId('plant-seed')).toBeVisible()
  await page.getByTestId('plant-seed').click()
  await page.getByTestId('feed-beanstalk').click()
  await page.waitForFunction(
    () => (window as unknown as Win).__cb3.session.getState().flags['beanstalkReachedClouds'] === true,
  )
  await capture(page, 'fed-to-clouds')

  // --- 7. climb the beanstalk, from the map (the real location flow) -------------------------
  await page.getByTestId('garden-to-map').click()
  await expect(page.locator('.map-zone', { hasText: 'climb the beanstalk' })).toBeVisible()
  await page.locator('.map-zone', { hasText: 'climb the beanstalk' }).click()
  await expect(page.getByTestId('climb-status')).toBeVisible()
  await expect(page.locator('.arena-surface')).toContainText('@')
  await capture(page, 'climbing')

  await expect(page.getByTestId('climb-status')).toHaveText('reached the top', { timeout: 20_000 })
  await expect(page.getByTestId('climb-done')).toBeVisible()
  expect((await state(page)).flags['beanstalkElevator']).toBe(true)
  await capture(page, 'reached-top')

  await page.getByTestId('climb-done').click()
  await expect(page.locator('.map-surface')).toBeVisible()
  await capture(page, 'back-to-map')
})

import { test, expect } from '@playwright/test'

// The DEV-only time-acceleration panel (how a playtester blitzes the Act 0 → seed → beanstalk
// arc). Playwright runs against the Vite dev server, so the panel is present here; in a
// production build it is tree-shaken out entirely (verified separately by `pnpm build`). We
// check it renders, drives the live speed, accepts an initial ?speed=N from the URL, and — the
// thing that would silently break the other flows — never sits over the existing controls.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('the dev panel changes the live time speed', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('dev-panel')).toBeVisible()
  await expect(page.getByTestId('dev-speed-current')).toHaveText('1×')

  await page.getByTestId('dev-speed-100').click()
  await expect(page.getByTestId('dev-speed-current')).toHaveText('100×')
})

test('an initial ?speed=N is read from the URL and clamped', async ({ page }) => {
  await page.goto('/?speed=99999') // clamped to the 1..1000 range
  await expect(page.getByTestId('dev-speed-current')).toHaveText('1000×')
})

test('the dev panel does not intercept clicks on the game controls', async ({ page }) => {
  await page.goto('/')
  // The opener button sits in the centred content flow; the panel is cornered. A plain click
  // must reach it (Playwright fails the click if another element is on top of the target).
  await page.getByTestId('ack-opener').click()
  await expect(page.getByTestId('eat-candy')).toBeVisible()
})

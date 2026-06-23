import { test, expect } from '@playwright/test'

// The first voyage (Act 2 — DESIGN §178), end to end. It proves: (1) from the launched sky port a
// commissioned galleon can SET SAIL; (2) the crossing is a plot-a-course puzzle (the brass sextant
// applied) — picking the leg waypoints in order reaches the reef and flips the screen to the harvest;
// (3) the reef harvest breaks a finite asteroid field, each hit banking rock candy, until the field
// is picked clean. Click-driven and deterministic — no rAF polling. The player's earned progress (the
// Act-1 gate cleared + the galleon commissioned) is granted via the test hook.

const getState = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as any).__cb3.session.getState())

// The voyage legs, matching content/reef/voyage.ts (the spec plots them in order).
const LEGS: string[][] = [
  ['moonShadow', 'driftLine'],
  ['paleStar', 'gullet', 'reefEdge'],
]

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('the first voyage: set sail, plot the crossing, harvest the reef', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // A player who has commissioned + named the galleon (the Act-1 gate cleared too).
  await page.evaluate(() => {
    ;(window as any).__cb3.session.dispatch((state: any) => ({
      ...state,
      flags: {
        ...state.flags,
        mapUnlocked: true,
        statusBarUnlocked: true,
        celestialNavigationLearned: true,
        fishbowlHelmForged: true,
        galleonCommissioned: true,
      },
      strings: { ...state.strings, galleonName: 'the Sweet Tooth' },
    }))
  })

  // (1) From the launched sky port, set sail.
  await page.evaluate(() => (window as any).__cb3.showSkyPort())
  await expect(page.getByTestId('skyport-launched')).toBeVisible()
  await page.getByTestId('skyport-set-sail').click()
  await expect(page.getByTestId('reef-crossing-screen')).toBeVisible()

  // (2) Plot the crossing — pick each leg's waypoints in order.
  for (const leg of LEGS) {
    for (const waypoint of leg) {
      await page.getByTestId(`reef-waypoint-${waypoint}`).click()
    }
  }
  expect((await getState(page)).flags['reefReached']).toBe(true)
  await expect(page.getByTestId('reef-screen')).toBeVisible() // flipped to the harvest

  // (3) Break the whole asteroid field — rock candy accrues, the reef ends harvested.
  const before = (await getState(page)).rockCandy.current
  for (let i = 0; i < 30 && !(await page.getByTestId('reef-harvested').isVisible()); i++) {
    await page.getByTestId('reef-break').click()
  }
  await expect(page.getByTestId('reef-harvested')).toBeVisible()
  const after = (await getState(page)).rockCandy.current
  expect(after).toBeGreaterThan(before)
})

import { test, expect } from '@playwright/test'

// The first voyage (Act 2 — DESIGN §125/§178), end to end. It proves: (1) from the launched sky port a
// commissioned galleon can SET SAIL; (2) the crossing is a plot-a-course puzzle (the brass sextant
// applied) — picking the leg waypoints in order reaches the reef and flips the screen to drift combat;
// (3) zero-G drift combat: firing the gumball cannon (following the on-screen aim hint) breaks the
// asteroid field; a full clear commits the rock-candy haul and sets the cleared flag. Click-driven and
// synchronous (each shot advances a fixed burst — no rAF). Earned progress (the Act-1 gate cleared, the
// galleon commissioned) + a gumball stockpile are granted via the test hook.

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
      numbers: { ...state.numbers, gumballs: 2000 }, // ammo stockpile so the run never strands
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
  await expect(page.getByTestId('reef-screen')).toBeVisible() // flipped to drift combat
  await expect(page.getByTestId('reef-arena')).toBeVisible()

  // (3) Drift combat: follow the aim hint ("a rock lines up to the <dir>") and fire that way; if no
  // rock is lined up, fire up to drift and re-aim. Clears the field within a bounded shot budget
  // (matches the deterministic unit harness). The full clear commits the haul + sets the flag.
  let cleared = false
  for (let i = 0; i < 400; i++) {
    if (await page.getByTestId('reef-harvested').isVisible()) {
      cleared = true
      break
    }
    const aim = await page.getByTestId('reef-hint').getAttribute('data-aim')
    await page.getByTestId(`reef-fire-${aim || 'n'}`).click()
  }
  expect(cleared).toBe(true)

  const after = await getState(page)
  expect(after.flags['reefDriftCleared']).toBe(true)
  expect(after.rockCandy.current).toBeGreaterThan(0) // the haul, committed on clear
})

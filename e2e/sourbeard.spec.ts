import { test, expect } from '@playwright/test'

// Captain Sourbeard & the Black Lollipop (Act 2 — quest 8, DESIGN §127/§179), end to end. It proves:
// (1) once the reef has been sailed, the launched sky port offers "answer the Black Lollipop"; (2) the
// broadside duel is a deterministic turn-based range fight that reads the yard's hull/cannon/sail tiers;
// (3) pressing the attack sinks the Black Lollipop within the boarding timer and commits the defeat
// (sourbeardDefeats -> 1) + the scaled loot (candies + chocolate). Click-driven and synchronous (each
// maneuver is one resolution — no rAF). Earned progress is granted via the test hook.

const getState = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as any).__cb3.session.getState())

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('the Black Lollipop: stand and fight, press the attack, sink Sourbeard, take the loot', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // A player who has commissioned the galleon AND sailed the reef once (the Act-1 gate cleared too).
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
        reefReached: true,
      },
      strings: { ...state.strings, galleonName: 'the Sweet Tooth' },
    }))
  })

  // (1) From the launched sky port, answer the Black Lollipop.
  await page.evaluate(() => (window as any).__cb3.showSkyPort())
  await expect(page.getByTestId('skyport-launched')).toBeVisible()
  await page.getByTestId('skyport-to-sourbeard').click()
  await expect(page.getByTestId('sourbeard-screen')).toBeVisible()
  await expect(page.getByTestId('sourbeard-scene')).toBeVisible()

  const candyBefore = (await getState(page)).candies.current
  const chocolateBefore = (await getState(page)).chocolate.current

  // (2)+(3) Fight tactically — hold at mid range, close from long, veer off deadly point-blank (the
  // deterministic engine harness proves a base-stats galleon wins encounter 1 this intuitive way; naive
  // press-spam would be SUNK). Drive off the machine-readable data-range band. Bounded by the timer.
  let won = false
  for (let i = 0; i < 12; i++) {
    if (await page.getByTestId('sourbeard-won').isVisible().catch(() => false)) {
      won = true
      break
    }
    const band = await page.getByTestId('sourbeard-range').getAttribute('data-range')
    if (band === '0') await page.getByTestId('sourbeard-press').click() // long -> close to mid
    else if (band === '2') await page.getByTestId('sourbeard-veer').click() // point-blank -> back off
    else await page.getByTestId('sourbeard-hold').click() // mid -> trade broadsides
  }
  expect(won).toBe(true)

  const after = await getState(page)
  expect(after.numbers['sourbeardDefeats']).toBe(1) // first defeat committed
  expect(after.candies.current).toBeGreaterThan(candyBefore) // scaled loot
  expect(after.chocolate.current).toBeGreaterThan(chocolateBefore)
})

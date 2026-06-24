import { test, expect } from '@playwright/test'

// The comet (Act 2 — "the comet passes", DESIGN §175/§180), end to end. It proves: (1) once the reef has
// been sailed, the launched sky port offers "chase the comet"; (2) the lead-the-target harpoon — following
// the on-screen aim advice (raise/lower the battery until the lead is true, then loose) catches the comet;
// (3) a catch harvests pop rocks (a NEW resource) + sets the first-caught flag, and the once-per-pass
// cooldown then shows the comet as stripped; (4) the harvested pop rocks unlock the yard's pop-rock-gun
// cannon tier. Click-driven and synchronous (each shot is one resolution — no rAF). Earned progress is
// granted via the test hook, and accumulatedGameTimeMs is set so a fresh, unharvested pass is in play.

const getState = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as any).__cb3.session.getState())

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('the comet passes: chase it, lead the harpoon, harvest pop rocks, fit the pop rock guns', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // A player who has commissioned the galleon AND sailed the reef once — and ~5 passes of game time in,
  // so the current comet pass is fresh (cometLastPass unset) and therefore catchable.
  await page.evaluate(() => {
    ;(window as any).__cb3.session.dispatch((state: any) => ({
      ...state,
      accumulatedGameTimeMs: 90_000 * 5,
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

  // (1) From the launched sky port, chase the comet.
  await page.evaluate(() => (window as any).__cb3.showSkyPort())
  await expect(page.getByTestId('skyport-launched')).toBeVisible()
  await page.getByTestId('skyport-to-comet').click()
  await expect(page.getByTestId('comet-screen')).toBeVisible()
  await expect(page.getByTestId('comet-sky')).toBeVisible()

  // (2)+(3) Lead-the-target: nudge the battery toward the advised lead, then loose. Repeat across
  // harpoons until the catch lands (the cooldown panel appears). Bounded shot budget.
  let caught = false
  for (let i = 0; i < 60; i++) {
    if (await page.getByTestId('comet-cooldown').isVisible().catch(() => false)) {
      caught = true
      break
    }
    // a fresh volley if the comet outran the previous one
    if (await page.getByTestId('comet-retry').isVisible().catch(() => false)) {
      await page.getByTestId('comet-retry').click()
      continue
    }
    const advice = await page.getByTestId('comet-hint').getAttribute('data-advice')
    if (advice === 'fire') await page.getByTestId('comet-fire').click()
    else if (advice === 'higher') await page.getByTestId('comet-aim-higher').click()
    else await page.getByTestId('comet-aim-lower').click()
  }
  expect(caught).toBe(true)

  const after = await getState(page)
  expect(after.flags['cometFirstCaught']).toBe(true)
  expect(after.popRocks.current).toBeGreaterThan(0) // the haul, committed on catch

  // (4) The harvested pop rocks (topped up, with candies) unlock the yard's pop-rock-gun cannon tier.
  await page.evaluate(() => {
    ;(window as any).__cb3.session.dispatch((state: any) => ({
      ...state,
      popRocks: { ...state.popRocks, current: 500 },
      candies: { ...state.candies, current: 2_000_000 },
    }))
  })
  await page.evaluate(() => (window as any).__cb3.showSkyPort())
  await page.getByTestId('skyport-to-yard').click()
  await expect(page.getByTestId('skyport-yard-screen')).toBeVisible()
  await page.getByTestId('yard-upgrade-cannons').click()
  expect((await getState(page)).numbers['galleonCannon']).toBe(2)
})

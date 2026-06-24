import { test, expect } from '@playwright/test'

// The sky port (Act 2 opening — the shipwright's commission for the candied galleon, DESIGN §13/§177),
// end to end. It proves: (1) the sky port opens on the moon's far side ONLY once the Act-1 gate is
// cleared (celestial navigation + the fishbowl helm); (2) the materials commission is a real sink —
// delivering each line spends the resource and fills the ledger; (3) once every line is funded the
// player names the galleon and she is laid down (the commissioned flag + the name in strings). The
// flow is click-driven and deterministic, so it needs no rAF polling — the player's earned progress
// (the cleared gate, a full hold of every material) is granted via the test hook.

const getState = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as any).__cb3.session.getState())

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('the sky port: open it on the far side, fund the commission, name the galleon', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // A player who has cleared Act 1 (navigation learned + the fishbowl helm forged) and is carrying a
  // full hold of every material the commission needs (scaled v1 costs).
  await page.evaluate(() => {
    const full = (n: number) => ({ current: n, lifetimeAccumulated: n, historicalMax: n })
    ;(window as any).__cb3.session.dispatch((state: any) => ({
      ...state,
      flags: {
        ...state.flags,
        mapUnlocked: true,
        statusBarUnlocked: true,
        celestialNavigationLearned: true,
        fishbowlHelmForged: true,
      },
      candies: full(600_000),
      rockCandy: full(200),
      licorice: full(800),
      cottonCandy: full(400),
    }))
  })

  // (1) From the moon, the far side has opened — cross to the sky port.
  await page.evaluate(() => (window as any).__cb3.showMoon())
  await expect(page.getByTestId('moon-skyport-section')).toBeVisible()
  await page.getByTestId('moon-to-skyport').click()
  await expect(page.getByTestId('skyport-screen')).toBeVisible()
  await expect(page.getByTestId('skyport-commission')).toBeVisible()

  // (2) Fund every line of the commission — each delivery spends the resource into the ledger.
  for (const resource of ['candies', 'rockCandy', 'licorice', 'cottonCandy']) {
    await page.getByTestId(`skyport-deliver-${resource}`).click()
    await expect(page.getByTestId(`skyport-line-${resource}`)).toContainText('done')
  }

  const funded = await getState(page)
  // The ledger records exactly the line amount; the surplus stays with the player (>= the floor —
  // the live candy producer may have trickled a few more candies in since the grant).
  expect(funded.numbers['galleonContrib_candies']).toBe(500_000)
  expect(funded.numbers['galleonContrib_rockCandy']).toBe(100)
  expect(funded.candies.current).toBeGreaterThanOrEqual(600_000 - 500_000)

  // (3) The commission is complete — name her and lay down the keel.
  await expect(page.getByTestId('skyport-naming')).toBeVisible()
  await page.getByTestId('skyport-name-input').fill('the Sweet Tooth')
  await page.getByTestId('skyport-name-submit').click()

  await expect(page.getByTestId('skyport-launched')).toBeVisible()
  await expect(page.getByTestId('skyport-launched')).toContainText('the Sweet Tooth')

  const launched = await getState(page)
  expect(launched.flags['galleonCommissioned']).toBe(true)
  expect(launched.strings['galleonName']).toBe('the Sweet Tooth')
})

test("the shipwright's yard: fit the hull to the gate tier and the storm-silk sails", async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // A captain with a commissioned galleon, the storm-silk keepsake in hand, and deep materials.
  await page.evaluate(() => {
    const full = (n: number) => ({ current: n, lifetimeAccumulated: n, historicalMax: n })
    ;(window as any).__cb3.session.dispatch((state: any) => ({
      ...state,
      flags: {
        ...state.flags,
        mapUnlocked: true,
        statusBarUnlocked: true,
        celestialNavigationLearned: true,
        fishbowlHelmForged: true,
        galleonCommissioned: true,
        stormSilkOwned: true,
      },
      ownedItems: { ...state.ownedItems, stormSilk: true },
      strings: { ...state.strings, galleonName: 'the Sweet Tooth' },
      candies: full(5_000_000),
      rockCandy: full(5_000),
      cottonCandy: full(5_000),
    }))
  })

  await page.evaluate(() => (window as any).__cb3.showSkyPort())
  await page.getByTestId('skyport-to-yard').click()
  await expect(page.getByTestId('skyport-yard-screen')).toBeVisible()
  await expect(page.getByTestId('skyport-galleon-art')).toBeVisible()

  // Hull: hardtack -> ironbark -> jawbreaker-plated (the Act-2 gate tier).
  await page.getByTestId('yard-upgrade-hull').click()
  await page.getByTestId('yard-upgrade-hull').click()
  // Sails: cotton candy -> storm-silk (consumes the keepsake).
  await page.getByTestId('yard-upgrade-sails').click()

  const fitted = await getState(page)
  expect(fitted.numbers['galleonHull']).toBe(3)
  expect(fitted.numbers['galleonSails']).toBe(2)
  expect(fitted.flags['stormSilkOwned']).toBe(false) // the storm-silk became the sail
  expect(fitted.ownedItems['stormSilk']).toBe(false)

  // The hull track is now maxed; the sail track's next tier (solar) is deferred (no buy button).
  await expect(page.getByTestId('yard-hull-max')).toBeVisible()
  await expect(page.getByTestId('yard-sails-locked')).toBeVisible()
})

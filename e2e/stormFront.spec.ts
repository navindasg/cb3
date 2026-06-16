import { test, expect } from '@playwright/test'

// The storm front (Act 1, Increment 2) — Quest 3, end to end. It exercises every new mechanic in
// the running app: the fizzy-lifting-soda cauldron brew (the recipe + the flag it sets), the
// fizzy-soda GATE on the quest (no soda, no climb), the toll giant's 100k candy sink (opens the
// bridge), and the thunderhead djinn boss (a reach weapon out-ranges its lightning). Progress that
// a real session would have earned (the elevator, a forge whip, an HP-building candy habit) is
// granted via the test hook rather than replayed.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('the storm front: brew the soda, pay the toll, and break the thunderhead djinn', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // A player at the sky: the elevator unlocked, the chrome unlocked, a long-reach forge weapon
  // (the licorice whip out-pokes the djinn), a deep candy habit (high max HP), and a sky-sized
  // candy hoard (the 100k toll + the cauldron's two candies).
  await page.evaluate(() => {
    const s = (window as any).__cb3.session
    s.dispatch((state: any) => ({
      ...state,
      flags: {
        ...state.flags,
        beanstalkElevator: true,
        statusBarUnlocked: true,
        mapUnlocked: true,
        licoriceWhipOwned: true,
      },
      ownedItems: { ...state.ownedItems, licoriceWhip: true },
      equipped: { ...state.equipped, weapon: 'licoriceWhip' },
      lifetimeCandiesEaten: 10000, // derived max HP ~210 — survives the fight
      candies: { current: 300_000, lifetimeAccumulated: 300_000, historicalMax: 300_000 },
    }))
  })

  // Gate check: without the fizzy lifting soda, the storm front refuses entry (no climb HUD).
  await page.evaluate(() => (window as any).__cb3.startStormFront())
  await expect(page.getByTestId('storm-status')).toHaveCount(0)
  await expect(page.getByTestId('toast')).toContainText('fizzy lifting soda')

  // Brew the fizzy lifting soda at the cauldron: two candies, heat, then stir.
  await page.evaluate(() => (window as any).__cb3.showCauldron())
  await page.getByTestId('cauldron-add-candy').click()
  await page.getByTestId('cauldron-add-candy').click()
  await page.getByTestId('cauldron-heat').click()
  await page.getByTestId('cauldron-stir').click()
  await page.getByTestId('cauldron-brew').click()
  await expect
    .poll(() => page.evaluate(() => (window as any).__cb3.session.getState().flags['fizzyLiftingSodaKnown']))
    .toBe(true)

  // Pay the toll giant (the 100k candy sink) to open the bridge upward.
  await page.evaluate(() => (window as any).__cb3.showCloudCommons())
  await page.getByTestId('pay-toll').click()
  await expect(page.getByTestId('toll-giant-paid')).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => (window as any).__cb3.session.getState().flags['tollGiantPaid']))
    .toBe(true)

  // Now the climb is allowed. Enter and hold the boost to drive the ascent + the djinn fight.
  await page.evaluate(() => (window as any).__cb3.startStormFront())
  await expect(page.getByTestId('storm-status')).toBeVisible()
  await page.getByTestId('storm-up').dispatchEvent('pointerdown') // sustain the climb/fight boost

  // The thunderhead breaks: the storm front is cleared and its loot is in hand.
  await expect(page.getByTestId('storm-status')).toHaveText('the thunderhead breaks', { timeout: 40_000 })
  const state = await page.evaluate(() => (window as any).__cb3.session.getState())
  expect(state.flags['stormFrontCleared']).toBe(true)
  expect(state.ownedItems['bottledTempest']).toBe(true)
  expect(state.ownedItems['stormSilk']).toBe(true)
})

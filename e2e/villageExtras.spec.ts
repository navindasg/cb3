import { test, expect } from '@playwright/test'

// The last of the Act 0 village: the tavern (one free rumor per accumulated game hour) and the
// gummy-worm cellar mini-quest (the CB2 rat-cellar homage; drops a lollipop, which feeds the
// cauldron syrup + the great-leaf secret). Both are reached from the village hub.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('the tavern hands out one free rumor, then goes quiet', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()
  await page.evaluate(() => (window as any).__cb3.showVillage())

  await page.getByTestId('village-tavern').click()
  await expect(page.getByTestId('tavern-screen')).toBeVisible()
  await page.getByTestId('tavern-rumor').click()

  // A rumor was told: the cooldown timestamp is stamped and the offer is gone (one per game hour).
  await expect
    .poll(() => page.evaluate(() => (window as any).__cb3.session.getState().numbers['lastRumorAtMs']))
    .not.toBeUndefined()
  await expect(page.getByTestId('tavern-rumor')).toHaveCount(0)
})

test('the gummy-worm cellar is clearable and drops a lollipop', async ({ page }) => {
  test.setTimeout(45_000)
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // Equip grandma's spoon + a little HP, then drop into the cellar from the village.
  await page.evaluate(() => {
    const s = (window as any).__cb3.session
    s.dispatch((st: any) => ({
      ...st,
      equipped: { ...st.equipped, weapon: 'woodenSpoon' },
      ownedItems: { ...st.ownedItems, woodenSpoon: true },
      flags: { ...st.flags, spoonOwned: true },
      playerHpCurrent: 20,
      numbers: { ...st.numbers, playerMaxHp: 20 },
    }))
    ;(window as any).__cb3.showVillage()
  })

  await page.getByTestId('village-cellar').click()
  await expect(page.getByTestId('cellar-status')).toBeVisible()
  await expect(page.getByTestId('cellar-done')).toBeVisible({ timeout: 35_000 })

  const state = await page.evaluate(() => (window as any).__cb3.session.getState())
  expect(state.flags['gummyWormCellarCleared']).toBe(true)
  expect(state.lollipops.current).toBeGreaterThanOrEqual(1)
})

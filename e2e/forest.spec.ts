import { test, expect } from '@playwright/test'

// The forest — the first real combat. You march east, your equipped weapon auto-swings at the
// gummy critters in reach, they bite back, and clearing it reveals the village on the map. We
// arm the player (grandma's spoon + a little HP), drive the hands-free march to victory, and
// assert the win flag + the village appearing. The fight resolves in real wall-clock (the quest
// loop runs at a fixed step, not the dev time-scale), so the timeout is generous.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('the forest fight is winnable and reveals the village', async ({ page }) => {
  test.setTimeout(45_000)
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // Equip grandma's spoon and a comfortable HP pool, then drop straight into the forest.
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
    ;(window as any).__cb3.startForest()
  })

  await expect(page.getByTestId('forest-status')).toBeVisible()
  await expect(page.locator('.arena-surface')).toContainText('@')

  // It marches east and fights hands-free; wait for the clear.
  await expect(page.getByTestId('forest-done')).toBeVisible({ timeout: 35_000 })
  const cleared = await page.evaluate(
    () => (window as any).__cb3.session.getState().flags['forestCleared'],
  )
  expect(cleared).toBe(true)

  // Back to the map: the village is now revealed (its region is gated on forestCleared).
  await page.getByTestId('forest-done').click()
  await expect(page.locator('.map-zone', { hasText: 'the village' })).toBeVisible()
})

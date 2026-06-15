import { test, expect } from '@playwright/test'

// The mine gate — the fight that grants access to the sugar mines (Act 0, Step 4b). It is the
// "go buy a weapon" wall: a rock-candy sentinel out-reaches grandma's spoon, so the intended
// answer is a forge upgrade. The bow (range 5) clears it from outside its swing; the spoon loses
// the trade and is ejected. The detailed tuning is locked by the unit test (mineGate.test.ts).

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('the candy-cane bow clears the mine gate, opening the descent', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // A player who has been to the forge: the bow, owned and equipped, plus a comfortable HP pool.
  await page.evaluate(() => {
    const s = (window as any).__cb3.session
    s.dispatch((st: any) => ({
      ...st,
      equipped: { ...st.equipped, weapon: 'candyCaneBow' },
      ownedItems: { ...st.ownedItems, candyCaneBow: true },
      flags: { ...st.flags, spoonOwned: true, candyCaneBowOwned: true },
      playerHpCurrent: 25,
      numbers: { ...st.numbers, playerMaxHp: 25 },
    }))
    ;(window as any).__cb3.startMineGate()
  })

  await expect(page.getByTestId('mineGate-status')).toBeVisible()
  await expect(page.locator('.arena-surface')).toContainText('@')

  // The bow plinks the sentinel down from range and the player breaks through.
  await expect(page.getByTestId('mineGate-done')).toBeVisible({ timeout: 60_000 })
  const cleared = await page.evaluate(
    () => (window as any).__cb3.session.getState().flags['mineGateCleared'],
  )
  expect(cleared).toBe(true)

  // Re-entering the mines now runs the DESCENT, not the gate (the cleared branch of startMines).
  await page.evaluate(() => (window as any).__cb3.startMines())
  await expect(page.getByTestId('mines-status')).toBeVisible()
  await expect(page.getByTestId('mineGate-status')).toHaveCount(0)
})

test('the spoon is ejected at the mine gate (the wall holds without a reach upgrade)', async ({ page }) => {
  test.setTimeout(45_000)
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  await page.evaluate(() => {
    const s = (window as any).__cb3.session
    s.dispatch((st: any) => ({
      ...st,
      equipped: { ...st.equipped, weapon: 'woodenSpoon' },
      ownedItems: { ...st.ownedItems, woodenSpoon: true },
      flags: { ...st.flags, spoonOwned: true },
      playerHpCurrent: 25,
      numbers: { ...st.numbers, playerMaxHp: 25 },
    }))
    ;(window as any).__cb3.startMineGate()
  })

  await expect(page.getByTestId('mineGate-status')).toBeVisible()

  // The spoon loses the trade; the host ejects you back to the overworld and the gate stays shut.
  await expect(page.locator('.map-surface')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('mineGate-done')).toHaveCount(0)
  const cleared = await page.evaluate(
    () => (window as any).__cb3.session.getState().flags['mineGateCleared'],
  )
  expect(cleared).toBeFalsy()
})

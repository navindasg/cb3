import { test, expect } from '@playwright/test'

// Save export/import, including a DELIBERATELY corrupted string. The series tradition is a
// shareable, hand-editable save; CB2 silently corrupted on a bad paste. CB3 must never crash
// on garbage and must keep the current save untouched when the import fails.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('a valid exported save round-trips back in', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  const exported = await page.evaluate(() => {
    const s = (window as any).__cb3.session
    s.dispatch((state: any) => ({
      ...state,
      candies: { current: 555, lifetimeAccumulated: 555, historicalMax: 555 },
    }))
    return s.exportSaveString()
  })

  const result = await page.evaluate((str) => {
    const s = (window as any).__cb3.session
    s.dispatch((state: any) => ({
      ...state,
      candies: { current: 1, lifetimeAccumulated: 1, historicalMax: 1 },
    }))
    const r = s.importSaveString(str)
    return { ok: r.ok, candies: s.getState().candies.current }
  }, exported)

  expect(result.ok).toBe(true)
  expect(result.candies).toBe(555)
})

test('a corrupted save string does not crash and keeps the current save', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  const before = await page.evaluate(() => {
    const s = (window as any).__cb3.session
    s.dispatch((state: any) => ({
      ...state,
      candies: { current: 777, lifetimeAccumulated: 777, historicalMax: 777 },
    }))
    return s.getState().candies.current
  })
  expect(before).toBe(777)

  const result = await page.evaluate(() => {
    const s = (window as any).__cb3.session
    const r = s.importSaveString('totally-not-a-valid-save-@@@!!!')
    return { ok: r.ok, reason: r.reason, candies: s.getState().candies.current }
  })

  expect(result.ok).toBe(false)
  expect(result.candies).toBe(777) // current save preserved

  // The page is still alive and interactive.
  await expect(page.getByTestId('eat-candy')).toBeVisible()
})

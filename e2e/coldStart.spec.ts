import { test, expect } from '@playwright/test'

// Cold start: the very first thing the series ever says. A fresh visitor (cleared storage)
// must see "You have 1 candy." on the opening screen.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('cold start shows the opening line', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('opening-line')).toHaveText('You have 1 candy.')
})

test('acknowledging the opener reveals the field controls', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()
  await expect(page.getByTestId('eat-candy')).toBeVisible()
  await expect(page.getByTestId('throw-candy')).toBeVisible()
})

test('the typed-secret input is a real, focusable, labelled field', async ({ page }) => {
  await page.goto('/')
  const secret = page.locator('input.secret-input')
  await expect(secret).toBeVisible()
  await expect(secret).toHaveAttribute('aria-label', /secret/i)
  await secret.focus()
  await expect(secret).toBeFocused()
})

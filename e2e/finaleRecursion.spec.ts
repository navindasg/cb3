import { test, expect } from '@playwright/test'

// The finale choice/ending screens, recursion-guard regression (Act 4 — the choice + all three endings). It
// proves the showChoice() <-> showEnding() pair TERMINATES for every committed endingChosen value — not just
// the hatch/feed scenes, but a committed 'eat' (the terminal night-sky re-entry scene) and a corrupt/forward-
// compat junk string. Both rode the strings z.record passthrough, so either could already be present in a save;
// the old code bounced showChoice -> showEnding -> showChoice forever and hung the tab. Each case here renders a
// terminal scene + a working "back to the map" button; a recursive hang would throw a RangeError out of
// page.evaluate (or time the assertion out), so a green run is the proof there is no recursion. Click-driven
// and deterministic — the committed ending is granted via the test hook (no real fight needed for this path).

const setEndingChosen = (page: import('@playwright/test').Page, value: string) =>
  page.evaluate((v) => {
    ;(window as any).__cb3.session.dispatch((state: any) => ({
      ...state,
      flags: { ...state.flags, mapUnlocked: true, statusBarUnlocked: true, starEaterDefeated: true },
      strings: { ...state.strings, endingChosen: v },
    }))
  }, value)

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test("the choice/ending screens terminate on a committed 'eat' — the night-sky re-entry, no showChoice<->showEnding recursion", async ({
  page,
}) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // A save whose star-eater is beaten AND that carries the 'eat' ending committed (the endingChosen string
  // rides the passthrough, so a forward-compat / re-routed dark save could hold it). In the normal flow the
  // eat path reboots straight into the inverted §367 opener; this exercises the DEFENSIVE re-entry — a
  // committed 'eat' routed back through the choice/ending screens must render the terminal night-sky scene.
  await setEndingChosen(page, 'eat')

  // showChoice() must hop to showEnding(), which must render the eat scene TERMINALLY (never bounce back to
  // the choice). If it recursed this evaluate would throw / hang.
  await page.evaluate(() => (window as any).__cb3.showChoice())
  await expect(page.getByTestId('ending-art')).toBeVisible()
  await expect(page.getByTestId('ending-eat-opening')).toBeVisible()
  await expect(page.getByTestId('ending-to-map')).toBeVisible()

  // Entering showEnding() directly is equally terminal.
  await page.evaluate(() => (window as any).__cb3.showEnding())
  await expect(page.getByTestId('ending-art')).toBeVisible()

  // The night sky is drawn COLD (the §367 inversion), not the warm .glow-sun photosphere.
  await expect(page.getByTestId('ending-art')).toHaveClass(/glow-star/)

  // The only route off it is back to the map — and it works.
  await page.getByTestId('ending-to-map').click()
  await expect(page.getByTestId('ending-art')).toHaveCount(0)
})

test('the choice/ending screens terminate on a CORRUPT endingChosen string — a safe terminal fallback, no recursion', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // A tampered / forward-compat save: endingChosen is present (so endingChosen() reads true) but is not a
  // known ending id (so chosenEnding() is null). The old null-fallback bounced to showChoice() and hung.
  await setEndingChosen(page, 'xyzzy')

  await page.evaluate(() => (window as any).__cb3.showChoice())
  await expect(page.getByTestId('ending-unknown')).toBeVisible()
  await expect(page.getByTestId('ending-to-map')).toBeVisible()

  await page.evaluate(() => (window as any).__cb3.showEnding())
  await expect(page.getByTestId('ending-unknown')).toBeVisible()
})

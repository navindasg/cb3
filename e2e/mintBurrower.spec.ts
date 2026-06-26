import { test, expect } from '@playwright/test'

// The mint burrower (Act 2 — the mint flavor for gummies), end to end. It proves the elegant loop where
// the gummy army farms the very §184 act-gate resource: (1) post-wyrm, the mint planet lets you HARVEST
// mint essence from the frozen wyrm's breath (candies -> mint, a pure faucet that never touches peppermint);
// (2) back at the moon's gummy vat, the learned fusion now offers a MINT-FUSED burrower (worm x licorice +
// mint); (3) those burrowers passively mine PEPPERMINT — proven via the deterministic offline-catch-up
// path (a live producer poll is flaky). Earned Act-2 progress is granted via the test hook.

type Page = import('@playwright/test').Page
const getState = (page: Page) => page.evaluate(() => (window as any).__cb3.session.getState())

test('harvest mint from the wyrm, fuse a mint burrower, and watch it mine peppermint', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-06-26T08:00:00') })
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // A player who freed the frost wyrm, learned flavor fusion, holds the worm mold (the vat), and has a
  // candy + licorice stock.
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
        frostWyrmFreed: true, // the peppermint fields + the wyrm's breath are open
        flavorFusionLearned: true, // the gummy folk taught fusion
        wormMoldOwned: true, // the gummy vat is open
      },
      strings: { ...state.strings, galleonName: 'the Sweet Tooth' },
      candies: { current: 200_000, lifetimeAccumulated: 200_000, historicalMax: 200_000 },
      licorice: { current: 50, lifetimeAccumulated: 50, historicalMax: 50 },
    }))
  })

  // (1) Sail to the mint planet (post-wyrm it is the peppermint fields) and harvest mint from the breath.
  await page.evaluate(() => (window as any).__cb3.showSkyPort())
  await page.getByTestId('skyport-to-mint').click()
  await expect(page.getByTestId('mint-fields')).toBeVisible()
  await expect(page.getByTestId('mint-harvest-blurb')).toBeVisible()
  await page.getByTestId('mint-harvest').click()
  const afterHarvest = await getState(page)
  expect(afterHarvest.mint.current).toBeGreaterThan(0)
  expect(afterHarvest.peppermint.current).toBe(0) // harvest is a pure candy sink — the gate untouched

  // (2) Back at the moon's gummy vat, fuse a mint burrower (the button appears now that mint is in hand).
  await page.evaluate(() => (window as any).__cb3.showMoon())
  await expect(page.getByTestId('moon-vat-section')).toBeVisible()
  await page.getByTestId('moon-vat-fuse-mint').click()
  const afterFuse = await getState(page)
  expect(afterFuse.numbers['gummyMintFusedCount']).toBe(1)
  expect(afterFuse.mint.current).toBeLessThan(afterHarvest.mint.current) // a mint essence was spent

  // (3) The mint burrower mines peppermint — prove it via offline catch-up (deterministic; no live poll).
  const before = (await getState(page)).peppermint.current
  await page.evaluate(() => (window as any).__cb3.session.onHidden())
  await page.clock.fastForward('01:00:00') // an hour away
  await page.evaluate(() => (window as any).__cb3.session.onVisible())
  const after = (await getState(page)).peppermint.current
  expect(after).toBeGreaterThan(before) // the gummy army quietly filled some of the §184 gate
})

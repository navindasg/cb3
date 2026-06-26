import { test, expect } from '@playwright/test'

// The sour kraken (Act 2 — an optional tail, DESIGN §10/§181), end to end. It proves the telegraph-and-sever
// fight that reads the EQUIPPED HAND WEAPON: (1) after first contact (flavor fusion learned) the sour planet
// offers the descent into the gas; (2) with the candy-cane bow equipped — long reach — strikes INTERCEPT
// every winding arm, so spamming strike grinds the kraken down and wins, dropping the kraken crown (worn)
// + a hoard; (3) the drop is farm-proof — descending again shows the calm deep, no second hoard; (4) with
// the short-reach mace, naive all-strike LOSES (you must learn to brace) — the balance reads through to the
// UI. Earned Act-2 progress is granted via the test hook.

type Page = import('@playwright/test').Page
const getState = (page: Page) => page.evaluate(() => (window as any).__cb3.session.getState())

/** Seed a player who has made first contact on the sour planet, with the given weapon equipped. */
const seed = (page: Page, weapon: string) =>
  page.evaluate((weaponId) => {
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
        flavorFusionLearned: true, // first contact made -> the descent is offered
      },
      strings: { ...state.strings, galleonName: 'the Sweet Tooth' },
      equipped: { ...state.equipped, weapon: weaponId },
      candies: { current: 100_000, lifetimeAccumulated: 100_000, historicalMax: 100_000 },
    }))
  }, weapon)

/** From the launched sky port, sail to the sour planet and descend into the gas to the kraken. */
const descend = async (page: Page) => {
  await page.evaluate(() => (window as any).__cb3.showSkyPort())
  await page.getByTestId('skyport-to-sour').click()
  await expect(page.getByTestId('sour-screen')).toBeVisible()
  await page.getByTestId('sour-to-kraken').click()
  await expect(page.getByTestId('kraken-screen')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('the bow intercepts every arm: grind the kraken down, take the crown', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()
  await seed(page, 'candyCaneBow')
  await descend(page)
  await expect(page.getByTestId('kraken-blurb')).toBeVisible()

  // The bow reaches everything, so every strike intercepts the telegraphed arm — just keep striking.
  for (let i = 0; i < 16; i++) {
    if (await page.getByTestId('kraken-won').isVisible().catch(() => false)) break
    await page.getByTestId('kraken-strike').click()
  }
  await expect(page.getByTestId('kraken-won')).toBeVisible()

  const s = await getState(page)
  expect(s.flags['krakenDefeated']).toBe(true)
  expect(s.flags['krakenCrownOwned']).toBe(true)
  expect(s.equipped.hat).toBe('krakenCrown') // auto-equipped trophy hat
  expect(s.candies.current).toBeGreaterThan(100_000) // the hoard spilled

  // Farm-proof: descend again -> the calm deep, and no second hoard.
  const before = (await getState(page)).candies.current
  await page.getByTestId('kraken-to-sour').click()
  await expect(page.getByTestId('sour-screen')).toBeVisible()
  await page.getByTestId('sour-to-kraken').click()
  await expect(page.getByTestId('kraken-calm')).toBeVisible()
  expect((await getState(page)).candies.current).toBe(before)
})

test('the short-reach mace cannot intercept the far arms: naive all-strike loses', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()
  await seed(page, 'jawbreakerMace')
  await descend(page)

  // Mash strike (no bracing). The mace cannot reach the winding far arms, so it eats every blow and is
  // driven off the platform — the fight reads the equipped weapon, and this play loses.
  for (let i = 0; i < 16; i++) {
    if (await page.getByTestId('kraken-lost').isVisible().catch(() => false)) break
    await page.getByTestId('kraken-strike').click()
  }
  await expect(page.getByTestId('kraken-lost')).toBeVisible()
  expect((await getState(page)).flags['krakenDefeated']).toBeFalsy() // no win, no loot
})

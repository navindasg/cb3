import { test, expect } from '@playwright/test'

// The moon worm (Act 1, Increment 4) — Quest 4, end to end. It exercises every new mechanic in the
// running app: the worm-tunnel affordance that surfaces on the moon screen once you have dug past
// the crust, the horizontal boss fight (a reach weapon out-pokes the worm's maw), and the spoils —
// the clear flag, the industrial-licorice drop, the worm mold, and the mining boost the mold grants
// (a subsequent dig pays double). Progress a real session would have earned (the elevator, the
// balloon, a forge whip, a deep candy habit, a moon dug into the cobalt stratum) is set via the hook.

const getState = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as any).__cb3.session.getState())

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('the moon worm: open the tunnels, break the worm, and bank the mold + its mining boost', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // A player on the moon: chrome + map unlocked, the balloon built, a long-reach forge weapon (the
  // licorice whip out-pokes the worm's maw), a deep candy habit (high max HP survives the fight),
  // and a moon already dug into the cobalt stratum with the iron pick (so the tunnels are open).
  await page.evaluate(() => {
    const s = (window as any).__cb3.session
    s.dispatch((state: any) => ({
      ...state,
      flags: { ...state.flags, statusBarUnlocked: true, mapUnlocked: true, balloonBuilt: true, licoriceWhipOwned: true },
      ownedItems: { ...state.ownedItems, licoriceWhip: true },
      equipped: { ...state.equipped, weapon: 'licoriceWhip' },
      lifetimeCandiesEaten: 10000, // derived max HP ~210 — survives the worm
      numbers: { ...state.numbers, moonStratum: 1, moonDigs: 0, moonPickTier: 2 },
      candies: { current: 1_000_000, lifetimeAccumulated: 1_000_000, historicalMax: 1_000_000 },
      rockCandy: { current: 0, lifetimeAccumulated: 0, historicalMax: 0 },
    }))
  })

  // On the moon, the worm tunnels have surfaced (you have dug past the crust). Enter the fight.
  await page.evaluate(() => (window as any).__cb3.showMoon())
  await expect(page.getByTestId('moon-worm-section')).toBeVisible()
  await page.getByTestId('moon-worm-enter').click()

  // The horizontal boss fight: hold the hurry boost to drive the auto-march + the swing.
  await expect(page.getByTestId('worm-status')).toBeVisible()
  await page.getByTestId('worm-hurry').dispatchEvent('pointerdown')

  // The worm bursts: the quest is cleared and its loot is in hand.
  await expect(page.getByTestId('worm-status')).toHaveText('the moon worm bursts', { timeout: 45_000 })
  const cleared = await getState(page)
  expect(cleared.flags['moonWormDefeated']).toBe(true)
  expect(cleared.flags['wormMoldOwned']).toBe(true)
  expect(cleared.ownedItems['wormMold']).toBe(true)
  expect(cleared.licorice.current).toBe(150) // the industrial-grade licorice drop

  // Back on the moon, the worm tunnels now read as cleared, and the mold's boost is live: a cobalt
  // dig (yield 8) pays the doubled 16 rock candy.
  await page.evaluate(() => (window as any).__cb3.showMoon())
  await expect(page.getByTestId('moon-worm-cleared')).toBeVisible()
  const before = (await getState(page)).rockCandy.current
  await page.getByTestId('moon-mine').click()
  const after = (await getState(page)).rockCandy.current
  expect(after - before).toBe(16) // cobalt yield 8 × the worm-mold ×2 boost
})

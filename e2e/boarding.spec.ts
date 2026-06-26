import { test, expect } from '@playwright/test'

// The boarding melee (Act 2 — quest 8's climax, DESIGN §127/§179), end to end. It proves: (1) once the
// broadside arc is won (sourbeardDefeats = 3), answering the Black Lollipop drops to the ON-FOOT melee
// (not a phantom fourth broadside); (2) the guard/lunge fencing reads the equipped weapon and you win by
// reading his cut line (data-line) and guarding it; (3) beating him on deck RETIRES the rival for good and
// drops his tricorn (worn) + the gummy parrot, exactly once (farm-proof — re-entry shows him gone).

type Page = import('@playwright/test').Page
const getState = (page: Page) => page.evaluate(() => (window as any).__cb3.session.getState())

test('board him: read the cuts, beat him on deck, take the tricorn + parrot, retire the rival', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')
  await page.getByTestId('ack-opener').click()

  // A player who has won all three broadsides (sourbeardDefeats = 3) with a heavy blade equipped.
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
      },
      strings: { ...state.strings, galleonName: 'the Sweet Tooth' },
      equipped: { ...state.equipped, weapon: 'jawbreakerMace' },
      numbers: { ...state.numbers, sourbeardDefeats: 3 },
    }))
  })

  // (1) The broadside arc is done -> answering him drops straight to the on-foot melee.
  await page.evaluate(() => (window as any).__cb3.showSkyPort())
  await page.getByTestId('skyport-to-sourbeard').click()
  await expect(page.getByTestId('sourbeard-screen')).toBeVisible()
  await expect(page.getByTestId('sourbeard-board-scene')).toBeVisible()
  await expect(page.getByTestId('sourbeard-board-blurb')).toBeVisible()

  // (2) Read his TRUE cut line (data-line; the player reads the stance by eye) and guard it. The mace's
  // riposte sees him off with clean reads, taking no damage.
  for (let i = 0; i < 30; i++) {
    if (await page.getByTestId('sourbeard-board-won').isVisible().catch(() => false)) break
    const line = await page.getByTestId('sourbeard-board-scene').getAttribute('data-line')
    await page
      .getByTestId(line === 'high' ? 'sourbeard-board-guard-high' : 'sourbeard-board-guard-low')
      .click()
      .catch(() => {})
  }
  await expect(page.getByTestId('sourbeard-board-won')).toBeVisible()

  const s = await getState(page)
  expect(s.flags['sourbeardBoarded']).toBe(true)
  expect(s.flags['sourbeardTricornOwned']).toBe(true)
  expect(s.flags['gummyParrotOwned']).toBe(true)
  expect(s.equipped.hat).toBe('sourbeardTricorn') // the tricorn auto-equips

  // (3) Farm-proof: re-enter -> he is gone (the §17 end), and no second drop.
  await page.getByTestId('sourbeard-to-skyport').click()
  await page.getByTestId('skyport-to-sourbeard').click()
  await expect(page.getByTestId('sourbeard-retired')).toBeVisible()
})

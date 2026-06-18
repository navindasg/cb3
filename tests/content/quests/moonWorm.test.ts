import { createDefaultSave } from '@/engine/state/defaultSave'
import { Scene } from '@/engine/quest/Scene'
import type { Weapon } from '@/engine/quest/Entity'
import { HorizontalDriver } from '@/engine/quest/physics/HorizontalDriver'
import { nearestHostileDistance } from '@/engine/quest/combat'
import { createEntityFactory } from '@/engine/content/entityFactory'
import { applyQuestWin } from '@/engine/quest/questRewards'
import { grantItem } from '@/engine/shop/purchase'
import { miningYieldMultiplier } from '@/engine/content/moonStrata'
import { TEMPLATE_MAP, MOON_WORM } from '@/content/quests/entityTemplates'
import { MOON_WORM_QUEST } from '@/content/quests/moonWorm'
import { playerQuestWeapons } from '@/content/items/playerLoadout'
import { WOODEN_SPOON, CANDY_CANE_BOW, LICORICE_WHIP, WORM_MOLD } from '@/content/items/items'
import { MOON_WORM_DEFEATED_FLAG, WORM_MOLD_OWNED_FLAG } from '@/content/flags'
import type { GameState } from '@/engine/types/GameState'

// The moon worm (Quest 4) — a colossal gummy worm fought in the tunnels under the jawbreaker moon.
// Like the mine sentinel and the thunderhead djinn, it is tuned around REACH: its maw out-reaches a
// melee swing, so a spoon player trades badly while the candy-cane bow (range 5) plinks it from
// outside its bite and never takes a hit. Unlike the one-life mine gate it is FARMABLE (the host
// respawns you at the tunnel mouth), so the gate stings rather than walls. These tests lock that,
// plus the spoils: the clear flag, the industrial-licorice drop, and the mold's mining boost.

const factory = createEntityFactory(TEMPLATE_MAP)
const equip = (weaponId: string): GameState => {
  const s = createDefaultSave()
  return { ...s, equipped: { ...s.equipped, weapon: weaponId } }
}

/**
 * Drive the worm with the host's exact horizontal auto-march logic (advance; hold to fight what is
 * in reach), modelling the FARMABLE death:'respawn': a death does not end the run (the Scene
 * respawns the player and the worm keeps its damage), so we count deaths and play on to the win.
 */
function runWorm(weapons: readonly Weapon[], playerMaxHp: number): { won: boolean; deaths: number } {
  let scene = Scene.start({
    def: { ...MOON_WORM_QUEST, playerMaxHp },
    driver: new HorizontalDriver({ gravityY: 30, moveSpeed: 7, jumpVelocity: 14 }),
    entityFactory: factory,
    playerWeapons: weapons,
  })
  let deaths = 0
  let guard = 0
  while (scene.phase === 'active' && guard++ < 12_000) {
    const player = scene.player
    const reach = player ? player.weapons.reduce((m, w) => Math.max(m, w.range), 0) : 0
    const dist = player ? nearestHostileDistance(player, scene.entities) : Infinity
    const moveX = dist <= reach ? 0 : 1
    const before = scene
    scene = scene.step({ playerInput: { moveX, moveY: 0, jump: false } }, 100)
    if (scene.lastDeath && !before.lastDeath) deaths++ // count a death only on its rising edge
  }
  return { won: scene.phase === 'won', deaths }
}

describe('the moon worm is a reach-tuned (but farmable) boss', () => {
  it('is authored as a horizontal quest in the tunnels', () => {
    expect(MOON_WORM_QUEST.mode).toBe('horizontal')
  })

  it('starts active with the colossal worm and its larvae blocking the tunnel', () => {
    const scene = Scene.start({
      def: MOON_WORM_QUEST,
      driver: new HorizontalDriver({ gravityY: 30, moveSpeed: 7, jumpVelocity: 14 }),
      entityFactory: factory,
    })
    expect(scene.phase).toBe('active')
    expect(scene.entities.some((e) => e.hasTag('moonWorm'))).toBe(true)
    expect(scene.entities.some((e) => e.hasTag('gummyWorm'))).toBe(true) // larvae
  })

  it("nominal reach: the maw out-pokes a melee swing; the bow and whip out-reach the maw", () => {
    // Stat comparison only — what plays out at the cell level is locked by the behavioral tests
    // below (the discrete march means nominal reach ≠ "never bitten"; only the bow clears clean).
    expect(MOON_WORM.attack!.range).toBeGreaterThan(WOODEN_SPOON.weapon!.range)
    expect(CANDY_CANE_BOW.weapon!.range).toBeGreaterThan(MOON_WORM.attack!.range)
    expect(LICORICE_WHIP.weapon!.range).toBeGreaterThan(MOON_WORM.attack!.range)
  })

  it('a candy-cane bow clears the worm without taking a single hit (the clean answer)', () => {
    // Range 5 rests the player well outside the maw (reach 2.7), so the bow plinks untouched.
    const result = runWorm(playerQuestWeapons(equip('candyCaneBow')), 30)
    expect(result.won).toBe(true)
    expect(result.deaths).toBe(0)
  })

  it('a licorice whip wins the fight too — a viable reach answer, just scrappier than the bow', () => {
    // The whip's range (3) only just clears the maw (2.7); the 0.7-cell march overshoots into the
    // bite, so it trades a few hits up close. With a healthy HP pool it still wins outright (where
    // a melee weapon is mauled), which is the point: reach beats melee, and the bow is the premium.
    const result = runWorm(playerQuestWeapons(equip('licoriceWhip')), 240)
    expect(result.won).toBe(true)
  })

  it('a spoon player is mauled at the worm — the reach gate bites (deaths before any win)', () => {
    const result = runWorm(playerQuestWeapons(equip('woodenSpoon')), 30)
    expect(result.deaths).toBeGreaterThan(0)
  })

  it('clearing it sets the defeated flag and drops industrial-grade licorice', () => {
    const after = applyQuestWin(createDefaultSave(), MOON_WORM_QUEST)
    expect(after.flags[MOON_WORM_DEFEATED_FLAG]).toBe(true)
    expect(after.licorice.current).toBe(createDefaultSave().licorice.current + 150)
  })

  it('the worm mold drop turns on the mining boost (the host grants it on victory)', () => {
    // questScreens does grantItem(applyQuestWin(s, MOON_WORM_QUEST), WORM_MOLD) on the win.
    const rewarded = grantItem(applyQuestWin(createDefaultSave(), MOON_WORM_QUEST), WORM_MOLD)
    expect(rewarded.ownedItems['wormMold']).toBe(true)
    expect(rewarded.flags[WORM_MOLD_OWNED_FLAG]).toBe(true)
    expect(miningYieldMultiplier(rewarded)).toBeGreaterThan(1) // the boost is now live
  })

  it('death respawns the player at the tunnel mouth (farmable, lose nothing)', () => {
    let scene = Scene.start({
      def: MOON_WORM_QUEST,
      driver: new HorizontalDriver({ gravityY: 30, moveSpeed: 7, jumpVelocity: 14 }),
      entityFactory: factory,
    })
    scene = scene.step({ playerInput: { moveX: 1, moveY: 0, jump: false } }, 100) // bank the mouth safe zone
    scene = scene.step({ playerInput: { moveX: 0, moveY: 0, jump: false }, playerDamage: 999, deathSource: 'moonWorm' }, 100)
    expect(scene.phase).toBe('active') // respawn, not game over
    expect(scene.lastDeath?.message).toBe('death.moonWorm')
  })

  it('declares a generic death-message fallback', () => {
    expect(MOON_WORM_QUEST.deathMessages.some((m) => m.source === 'generic')).toBe(true)
  })
})
